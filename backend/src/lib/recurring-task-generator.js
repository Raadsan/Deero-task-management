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

  const resolvedAssignee = await resolveWorkflowAssignee(
    {
      assigneeId: step.assigneeId ?? assigneeId,
      accountManagerId: client.accountManagerId,
    },
    tx,
  );
  if (!resolvedAssignee) {
    return { skipped: true, reason: "no_assignee" };
  }

  const assignee = await tx.user.findUnique({
    where: { id: resolvedAssignee },
    select: { id: true, name: true },
  });

  const dateLabel = formatDisplayDate(scheduledDate);
  const taskTitle = `Today's ${step.label}`;
  const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });

  const task = await tx.task.create({
    data: {
      id: taskId,
      description: taskTitle,
      status: "pending",
      priority: "normal",
      department: step.department || "General",
      deadline: endOfDay(scheduledDate),
      progress: 0,
      workflowStage: "pending",
      sortOrder: step.stepOrder,
      assgineeId: resolvedAssignee,
      supervisor: step.supervisor ?? "",
      serviceInformation: `${client.institution} — ${schedule.name} (${dateLabel})`,
      isPersonal: false,
    },
  });

  await tx.clientTask.create({
    data: { clientId: client.id, taskId: task.id },
  });

  const occurrence = await tx.recurringTaskOccurrence.create({
    data: {
      scheduleStepId: step.id,
      scheduledDate,
      taskId: task.id,
    },
    include: { task: true },
  });

  try {
    await createNotification({
      taskId: task.id,
      taskName: taskTitle,
      assigneeName: assignee?.name ?? "",
      deadline: task.deadline,
      type: "new-assignment",
      userId: resolvedAssignee,
    });
  } catch (err) {
    console.error("Failed to notify assignee for recurring task:", err);
  }

  return { skipped: false, occurrence, task };
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
