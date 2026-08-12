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

async function createOccurrenceTask(tx, { step, schedule, client, assigneeId, runDate }) {
  const scheduledDate = startOfDay(runDate);
  const existing = await tx.recurringTaskOccurrence.findUnique({
    where: {
      scheduleStepId_scheduledDate: {
        scheduleStepId: step.id,
        scheduledDate,
      },
    },
  });
  if (existing) return { skipped: true, reason: "already_exists", occurrence: existing };

  // Calculate startDate from step.startHour (default "09:00")
  const startHourStr = step.startHour || "09:00";
  const [hoursStr, minsStr] = String(startHourStr).split(":");
  const taskStartDate = new Date(scheduledDate);
  taskStartDate.setHours(Number(hoursStr) || 9, Number(minsStr) || 0, 0, 0);

  // Calculate deadline from estimatedHours (default 2 hours)
  const estHours = Math.max(0.5, Number(step.estimatedHours) || 2);
  const taskDeadline = new Date(taskStartDate.getTime() + estHours * 60 * 60 * 1000);

  // Determine assignees (single or multiple)
  let rawAssignees = Array.isArray(step.assigneeIds) && step.assigneeIds.length > 0
    ? step.assigneeIds
    : [step.assigneeId ?? assigneeId].filter(Boolean);

  if (!rawAssignees.length && client.accountManagerId) {
    rawAssignees = [client.accountManagerId];
  }

  if (!rawAssignees.length) {
    return { skipped: true, reason: "no_assignee" };
  }

  const dateLabel = formatDisplayDate(scheduledDate);
  const taskTitle = `Today's ${step.label}`;

  let createdPrimaryTask = null;
  let primaryOccurrence = null;

  for (let idx = 0; idx < rawAssignees.length; idx++) {
    const targetAssigneeId = rawAssignees[idx];
    const assignee = await tx.staff.findUnique({
      where: { id: targetAssigneeId },
      select: { id: true, name: true },
    });
    if (!assignee) continue;

    const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
    const task = await tx.task.create({
      data: {
        id: taskId,
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
        assgineeId: targetAssigneeId,
        supervisor: step.supervisor ?? "",
        serviceInformation: `${client.institution} - ${step.label}`,
        isPersonal: false,
      },
    });

    await tx.clientTask.create({
      data: { clientId: client.id, taskId: task.id },
    });

    if (idx === 0) {
      createdPrimaryTask = task;
      primaryOccurrence = await tx.recurringTaskOccurrence.create({
        data: {
          scheduleStepId: step.id,
          scheduledDate,
          taskId: task.id,
        },
        include: { task: true },
      });
    }

    try {
      await createNotification({
        taskId: task.id,
        taskName: taskTitle,
        assigneeName: assignee.name ?? "",
        deadline: task.deadline,
        type: "new-assignment",
        userId: targetAssigneeId,
      });
    } catch (err) {
      console.error("Failed to notify assignee for recurring task:", err);
    }
  }

  if (!createdPrimaryTask) {
    return { skipped: true, reason: "no_valid_assignees" };
  }

  return { skipped: false, occurrence: primaryOccurrence, task: createdPrimaryTask };
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
      autoGenerateTasks: true,
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
          results.errors.push({
            scheduleId: schedule.id,
            stepId: step.id,
            message: err.message,
          });
        }
      }
    }

    return results;
  };

  if (tx) return run(tx);
  return prisma.$transaction(run, { timeout: 60000 });
}
