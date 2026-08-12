import { prisma } from "./prisma.js";
import { generateCustomId } from "./id-generator.js";
import { createNotification } from "./notifications.js";
import { resolveWorkflowAssignee } from "./workflow-automation.js";

function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function daysSince(startDate, targetDate) {
  const start = startOfDay(startDate);
  const target = startOfDay(targetDate);
  return Math.round((target - start) / 86400000);
}

function parseCustomRule(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Whether a schedule step should generate a task on the given calendar day.
 */
export function shouldStepRunOnDate(step, schedule, date) {
  const day = startOfDay(date);
  const scheduleStart = startOfDay(schedule.startDate);

  if (day < scheduleStart) return false;
  if (schedule.endDate && day > startOfDay(schedule.endDate)) return false;

  const weekday = day.getDay(); // 0 = Sunday … 6 = Saturday
  const dayOfMonth = day.getDate();
  const rule = parseCustomRule(schedule.customRule);

  switch (schedule.recurrenceType) {
    case "DAILY":
      return true;

    case "WEEKLY":
      if (step.dayOfWeek != null) return step.dayOfWeek === weekday;
      if (rule?.weekdays?.length) return rule.weekdays.includes(weekday);
      return false;

    case "MONTHLY":
      if (step.dayOfMonth != null) return step.dayOfMonth === dayOfMonth;
      if (rule?.dayOfMonth != null) return rule.dayOfMonth === dayOfMonth;
      return false;

    case "CUSTOM": {
      const interval =
        step.intervalDays ??
        rule?.intervalDays ??
        (rule?.everyDays ? Number(rule.everyDays) : null);

      if (interval && interval > 0) {
        const elapsed = daysSince(scheduleStart, day);
        return elapsed >= 0 && elapsed % interval === 0;
      }

      if (rule?.weekdays?.length) {
        return rule.weekdays.includes(weekday);
      }

      if (step.dayOfWeek != null) return step.dayOfWeek === weekday;
      if (step.dayOfMonth != null) return step.dayOfMonth === dayOfMonth;
      return false;
    }

    default:
      return false;
  }
}

function formatDisplayDate(date) {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function parseHourAndMinute(timeStr) {
  if (!timeStr) return { hours: 9, minutes: 0 };
  const str = String(timeStr).trim();
  const isPM = /pm/i.test(str);
  const isAM = /am/i.test(str);
  const cleaned = str.replace(/[^\d:]/g, "");
  const parts = cleaned.split(":");
  let hours = parseInt(parts[0] || "9", 10);
  let minutes = parseInt(parts[1] || "0", 10);
  if (isNaN(hours)) hours = 9;
  if (isNaN(minutes)) minutes = 0;

  if (isPM && hours < 12) hours += 12;
  if (isAM && hours === 12) hours = 0;

  return { hours, minutes };
}

async function createOccurrenceTask(clientDb, { step, schedule, client, assigneeId, runDate }) {
  const scheduledDate = startOfDay(runDate);

  return prisma.$transaction(
    async (tx) => {
    // 1. Primary check: exact step ID + date
    const existing = await tx.recurringTaskOccurrence.findUnique({
      where: {
        scheduleStepId_scheduledDate: {
          scheduleStepId: step.id,
          scheduledDate,
        },
      },
    });
    if (existing) return { skipped: true, reason: "already_exists", occurrence: existing };

    // 2. Secondary guard: catch step-ID-change after edit (same schedule + label + date = duplicate)
    const duplicateForSchedule = await tx.recurringTaskOccurrence.findFirst({
      where: {
        scheduledDate,
        scheduleStep: {
          scheduleId: schedule.id,
          label: step.label,
        },
      },
      select: { id: true },
    });
    if (duplicateForSchedule) return { skipped: true, reason: "schedule_label_date_exists" };

    // 3. Tertiary guard: check if task with same client institution + step label already exists on this day
    const taskServiceInfo = `${client.institution} - ${step.label}`;
    const existingTaskForDay = await tx.task.findFirst({
      where: {
        serviceInformation: taskServiceInfo,
        startDate: {
          gte: scheduledDate,
          lt: new Date(scheduledDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
      select: { id: true },
    });
    if (existingTaskForDay) return { skipped: true, reason: "task_already_exists_for_day" };

    // Calculate startDate from step.startHour (handles "12:20 PM", "01:20 PM", "09:00", etc.)
    const { hours, minutes } = parseHourAndMinute(step.startHour);
    const taskStartDate = new Date(scheduledDate);
    taskStartDate.setHours(hours, minutes, 0, 0);

    // Only generate if within 1 hour of start time (or already past it, same day)
    const nowMs = Date.now();
    const oneHourBeforeStart = taskStartDate.getTime() - 60 * 60 * 1000;
    if (nowMs < oneHourBeforeStart) {
      return { skipped: true, reason: "too_early" };
    }

    // Calculate deadline from estimatedHours (default 2 hours)
    const estHours = Math.max(0.5, Number(step.estimatedHours) || 2);
    const taskDeadline = new Date(taskStartDate.getTime() + estHours * 60 * 60 * 1000);

    // Determine assignees (deduplicate user IDs)
    let rawAssignees = Array.from(
      new Set(
        (Array.isArray(step.assigneeIds) && step.assigneeIds.length > 0
          ? step.assigneeIds
          : [step.assigneeId ?? assigneeId]
        ).filter(Boolean)
      )
    );

    if (!rawAssignees.length && client.accountManagerId) {
      rawAssignees = [client.accountManagerId];
    }

    if (!rawAssignees.length) {
      return { skipped: true, reason: "no_assignee" };
    }

    const taskTitle = `Today's ${step.label}`;

    // Get primary assignee
    const primaryAssigneeId = rawAssignees[0];
    const primaryAssignee = await tx.staff.findUnique({
      where: { id: primaryAssigneeId },
      select: { id: true, name: true },
    });
    const primaryTaskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });

    // CREATE PRIMARY TASK FIRST inside transaction
    const createdPrimaryTask = await tx.task.create({
      data: {
        id: primaryTaskId,
        description: taskTitle,
        status: "pending",
        priority: "normal",
        department: step.department || "General",
        startDate: taskStartDate,
        deadline: taskDeadline,
        originalDeadline: taskDeadline,
        progress: 0,
        workflowStage: "pending",
        sortOrder: step.stepOrder,
        assgineeId: primaryAssigneeId,
        supervisor: step.supervisor ?? "",
        serviceInformation: taskServiceInfo,
        isPersonal: false,
      },
    });

    await tx.clientTask.create({
      data: { clientId: client.id, taskId: createdPrimaryTask.id },
    });

    // CREATE OCCURRENCE SECOND: if duplicate step+date exists, transaction automatically rolls back task creation!
    let primaryOccurrence;
    try {
      primaryOccurrence = await tx.recurringTaskOccurrence.create({
        data: {
          scheduleStepId: step.id,
          scheduledDate,
          taskId: primaryTaskId,
        },
      });
    } catch (err) {
      if (err.code === "P2002") {
        throw new Error("CONCURRENT_DUPLICATE_SKIPPED");
      }
      throw err;
    }

    try {
      await createNotification({
        taskId: createdPrimaryTask.id,
        taskName: taskTitle,
        assigneeName: primaryAssignee.name ?? "",
        deadline: createdPrimaryTask.deadline,
        type: "new-assignment",
        userId: primaryAssigneeId,
      });
    } catch (err) {
      console.error("Failed to notify primary assignee for recurring task:", err);
    }

    // Process extra assignees if step has multiple distinct assignees
    for (let idx = 1; idx < rawAssignees.length; idx++) {
      const extraAssigneeId = rawAssignees[idx];
      const extraAssignee = await tx.staff.findUnique({
        where: { id: extraAssigneeId },
        select: { id: true, name: true },
      });
      if (!extraAssignee) continue;

      const extraTaskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
      const extraTask = await tx.task.create({
        data: {
          id: extraTaskId,
          description: taskTitle,
          status: "pending",
          priority: "normal",
          department: step.department || "General",
          startDate: taskStartDate,
          deadline: taskDeadline,
          originalDeadline: taskDeadline,
          progress: 0,
          workflowStage: "pending",
          sortOrder: step.stepOrder,
          assgineeId: extraAssigneeId,
          supervisor: step.supervisor ?? "",
          serviceInformation: taskServiceInfo,
          isPersonal: false,
        },
      });

      await tx.clientTask.create({
        data: { clientId: client.id, taskId: extraTask.id },
      });

      try {
        await createNotification({
          taskId: extraTask.id,
          taskName: taskTitle,
          assigneeName: extraAssignee.name ?? "",
          deadline: extraTask.deadline,
          type: "new-assignment",
          userId: extraAssigneeId,
        });
      } catch (err) {
        console.error("Failed to notify extra assignee:", err);
      }
    }

    return { skipped: false, occurrence: primaryOccurrence, task: createdPrimaryTask };
  }, { timeout: 15000 });
}

/**
 * Generate today's (or given date's) recurring task instances for all active schedules.
 */
export async function generateDailyRecurringTasks({
  runDate = new Date(),
  scheduleId = null,
  tx = null,
} = {}) {
  const run = async (client) => {
    const where = {
      isActive: true,
      ...(scheduleId ? { id: scheduleId } : {}),
    };

    const schedules = await client.recurringSchedule.findMany({
      where,
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        client: {
          select: {
            id: true,
            institution: true,
            accountManagerId: true,
            isActive: true,
          },
        },
      },
    });

    const results = {
      runDate: startOfDay(runDate).toISOString(),
      created: 0,
      skipped: 0,
      errors: [],
      tasks: [],
    };

    for (const schedule of schedules) {
      if (!schedule.client?.isActive) continue;

      for (const step of schedule.steps) {
        try {
          if (!shouldStepRunOnDate(step, schedule, runDate)) continue;

          const outcome = await createOccurrenceTask(client, {
            step,
            schedule,
            client: schedule.client,
            runDate,
          });

          if (outcome.skipped) {
            results.skipped += 1;
          } else {
            results.created += 1;
            results.tasks.push({
              taskId: outcome.task.id,
              description: outcome.task.description,
              assigneeId: outcome.task.assgineeId,
              scheduleId: schedule.id,
              stepId: step.id,
            });
          }
        } catch (err) {
          if (err.message === "CONCURRENT_DUPLICATE_SKIPPED") {
            results.skipped += 1;
          } else {
            results.errors.push({
              scheduleId: schedule.id,
              stepId: step.id,
              message: err.message,
            });
          }
        }
      }
    }

    return results;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run, { timeout: 60000 });
}
