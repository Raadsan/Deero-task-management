import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";
import {
  findWorkflowTemplate,
  generateTasksFromTemplate,
  resolveWorkflowAssignee,
  weekBounds,
} from "../lib/workflow-automation.js";
import { generateDailyRecurringTasks } from "../lib/recurring-task-generator.js";

const scheduleInclude = {
  client: { select: { id: true, institution: true, accountManagerId: true } },
  portfolio: { select: { id: true, name: true } },
  steps: { orderBy: { stepOrder: "asc" } },
  _count: { select: { cycles: true } },
};

function recurringWhere(scope, extra = {}) {
  const portfolioId = scope.portfolioId && !scope.seesAllBranches ? scope.portfolioId : null;
  return mergeWhere(portfolioId ? { portfolioId } : {}, extra);
}

async function findAccessibleSchedule(scope, id, include = scheduleInclude) {
  const row = await prisma.recurringSchedule.findFirst({
    where: { id, ...recurringWhere(scope) },
    include,
  });
  if (!row) return null;

  const client = await prisma.client.findFirst({
    where: mergeWhere({ id: row.clientId }, clientBranchWhere(scope)),
    select: { id: true },
  });
  return client ? row : null;
}

export const getAllRecurringSchedules = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId, isActive } = req.query;

    const schedules = await prisma.recurringSchedule.findMany({
      where: recurringWhere(scope, {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(isActive !== undefined ? { isActive: isActive === "true" } : {}),
      }),
      include: scheduleInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: schedules });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRecurringScheduleById = async (req, res) => {
  try {
    const scope = getScope(req);
    const schedule = await findAccessibleSchedule(scope, req.params.id, {
      ...scheduleInclude,
      cycles: {
        orderBy: { cycleNumber: "desc" },
        take: 12,
        include: { _count: { select: { tasks: true } } },
      },
    });

    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const VALID_CONTENT_TYPES = [
  "VIDEO",
  "GRAPHIC_DESIGN",
  "PHOTOGRAPHY",
  "SOCIAL_MEDIA_POST",
  "MARKETING_CAMPAIGN",
  "OTHER",
];

export const createRecurringSchedule = async (req, res) => {
  const data = req.body;
  try {
    const scope = getScope(req);
    const portfolioId = resolveWritableBranchId(scope, data.portfolioId);

    const client = await prisma.client.findFirst({
      where: mergeWhere({ id: data.clientId }, clientBranchWhere(scope)),
    });
    if (!client) {
      return res.status(404).json({ success: false, error: "Client not found" });
    }

    const contentType = VALID_CONTENT_TYPES.includes(data.contentType)
      ? data.contentType
      : "OTHER";

    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "recurring_schedules", prisma: tx });
      const schedule = await tx.recurringSchedule.create({
        data: {
          id,
          name: String(data.name ?? "").trim(),
          recurrenceType: data.recurrenceType ?? "WEEKLY",
          customRule: data.customRule ?? null,
          contentType,
          startDate: new Date(data.startDate ?? Date.now()),
          endDate: data.endDate ? new Date(data.endDate) : null,
          isActive: data.isActive !== false,
          autoGenerateTasks: data.autoGenerateTasks !== false,
          clientId: client.id,
          portfolioId: portfolioId ?? client.portfolioId ?? null,
          steps: {
            create: (data.steps ?? []).map((step, index) => {
              const stepCt = VALID_CONTENT_TYPES.includes(step.contentType)
                ? step.contentType
                : null;
              return {
                dayOfWeek: step.dayOfWeek != null ? Number(step.dayOfWeek) : null,
                dayOfMonth: step.dayOfMonth != null ? Number(step.dayOfMonth) : null,
                intervalDays: step.intervalDays != null ? Number(step.intervalDays) : null,
                stepOrder: step.stepOrder ?? index + 1,
                label: step.label ?? `Step ${index + 1}`,
                contentType: stepCt,
                department: step.department ?? null,
                supervisor: step.supervisor ?? "",
                assigneeId: step.assigneeId ?? data.assigneeId ?? null,
                templateId: step.templateId ?? null,
              };
            }),
          },
        },
        include: { steps: true },
      });

      let dailyGeneration = null;
      if (data.autoGenerateTasks !== false) {
        try {
          dailyGeneration = await generateDailyRecurringTasks({
            runDate: new Date(),
            scheduleId: schedule.id,
            tx,
          });
        } catch (genErr) {
          console.error("Auto task generation on schedule create warning:", genErr.message);
        }
      }

      return { schedule, dailyGeneration };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error("createRecurringSchedule error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

async function generateCycleForSchedule(tx, { schedule, client, scope, assigneeId }) {
  const lastCycle = await tx.contentCycle.findFirst({
    where: { scheduleId: schedule.id },
    orderBy: { cycleNumber: "desc" },
  });
  const cycleNumber = (lastCycle?.cycleNumber ?? 0) + 1;
  const { periodStart, periodEnd } = weekBounds(new Date());

  const cycleId = await generateCustomId({ entityTybe: "content_cycles", prisma: tx });
  const cycle = await tx.contentCycle.create({
    data: {
      id: cycleId,
      cycleNumber,
      periodStart,
      periodEnd,
      status: "PLANNED",
      scheduleId: schedule.id,
      clientId: client.id,
    },
  });

  const assignee = await resolveWorkflowAssignee(
    {
      assigneeId,
      accountManagerId: client.accountManagerId,
      fallbackUserId: scope.user?.id,
    },
    tx,
  );

  const tasks = [];
  if (assignee) {
    for (const step of schedule.steps ?? []) {
      const template = step.templateId
        ? await tx.workflowTemplate.findUnique({
            where: { id: step.templateId },
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          })
        : await findWorkflowTemplate(
            { contentType: step.contentType ?? schedule.contentType },
            tx,
          );

      if (!template) {
        const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
        const task = await tx.task.create({
          data: {
            id: taskId,
            description: step.label,
            status: "pending",
            priority: "normal",
            department: step.department || "General",
            progress: 0,
            workflowStage: "pending",
            sortOrder: step.stepOrder,
            assgineeId: assignee,
            serviceInformation: `${schedule.name} — ${step.label}`,
            contentCycleId: cycle.id,
          },
        });
        await tx.clientTask.create({ data: { clientId: client.id, taskId: task.id } });
        tasks.push(task);
        continue;
      }

      const batch = await generateTasksFromTemplate(tx, {
        template,
        clientId: client.id,
        assigneeId: assignee,
        contentCycleId: cycle.id,
        startDate: periodStart,
        serviceInformation: `${schedule.name} — ${step.label}`,
      });
      tasks.push(...batch);
    }
  }

  return { cycle, tasks };
}

export const generateRecurringCycle = async (req, res) => {
  const { id } = req.params;
  const data = req.body ?? {};
  try {
    const scope = getScope(req);
    const schedule = await findAccessibleSchedule(scope, id, {
      ...scheduleInclude,
      steps: { orderBy: { stepOrder: "asc" } },
    });
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const client = await prisma.client.findUnique({ where: { id: schedule.clientId } });
    const result = await prisma.$transaction((tx) =>
      generateCycleForSchedule(tx, {
        schedule,
        client,
        scope,
        assigneeId: data.assigneeId,
      }),
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRecurringCycles = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const schedule = await findAccessibleSchedule(scope, id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const cycles = await prisma.contentCycle.findMany({
      where: { scheduleId: id },
      orderBy: { cycleNumber: "desc" },
      include: { _count: { select: { tasks: true } } },
    });

    res.json({ success: true, data: cycles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const toggleRecurringSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleSchedule(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const schedule = await prisma.recurringSchedule.update({
      where: { id },
      data: { isActive: !existing.isActive },
      include: scheduleInclude,
    });

    res.json({ success: true, data: schedule });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRecurringOccurrences = async (req, res) => {
  try {
    const scope = getScope(req);
    const schedule = await findAccessibleSchedule(scope, req.params.id, {
      steps: { select: { id: true, label: true, dayOfWeek: true } },
    });
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const stepIds = schedule.steps.map((step) => step.id);
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const occurrences = await prisma.recurringTaskOccurrence.findMany({
      where: { scheduleStepId: { in: stepIds } },
      include: {
        scheduleStep: { select: { id: true, label: true, dayOfWeek: true, stepOrder: true } },
        task: {
          include: {
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [{ scheduledDate: "desc" }, { createdAt: "desc" }],
      take: limit,
    });

    res.json({ success: true, data: occurrences });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const runRecurringDailyGeneration = async (req, res) => {
  try {
    const scope = getScope(req);
    const schedule = await findAccessibleSchedule(scope, req.params.id);
    if (!schedule) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const runDate = req.body?.date ? new Date(req.body.date) : new Date();
    const result = await generateDailyRecurringTasks({
      runDate,
      scheduleId: schedule.id,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateRecurringSchedule = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleSchedule(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    const contentType = data.contentType && VALID_CONTENT_TYPES.includes(data.contentType)
      ? data.contentType
      : existing.contentType;

    const result = await prisma.$transaction(async (tx) => {
      if (Array.isArray(data.steps)) {
        await tx.recurringScheduleStep.deleteMany({
          where: { scheduleId: id },
        });
      }

      const schedule = await tx.recurringSchedule.update({
        where: { id },
        data: {
          name: data.name !== undefined ? String(data.name).trim() : existing.name,
          recurrenceType: data.recurrenceType ?? existing.recurrenceType,
          contentType,
          startDate: data.startDate ? new Date(data.startDate) : existing.startDate,
          endDate: data.endDate !== undefined ? (data.endDate ? new Date(data.endDate) : null) : existing.endDate,
          isActive: data.isActive !== undefined ? Boolean(data.isActive) : existing.isActive,
          autoGenerateTasks: data.autoGenerateTasks !== undefined ? Boolean(data.autoGenerateTasks) : existing.autoGenerateTasks,
          ...(Array.isArray(data.steps)
            ? {
                steps: {
                  create: data.steps.map((step, index) => {
                    const stepCt = VALID_CONTENT_TYPES.includes(step.contentType)
                      ? step.contentType
                      : null;
                    return {
                      dayOfWeek: step.dayOfWeek != null ? Number(step.dayOfWeek) : null,
                      dayOfMonth: step.dayOfMonth != null ? Number(step.dayOfMonth) : null,
                      intervalDays: step.intervalDays != null ? Number(step.intervalDays) : null,
                      stepOrder: step.stepOrder ?? index + 1,
                      label: step.label ?? `Step ${index + 1}`,
                      contentType: stepCt,
                      department: step.department ?? null,
                      supervisor: step.supervisor ?? "",
                      assigneeId: step.assigneeId ?? null,
                    };
                  }),
                },
              }
            : {}),
        },
        include: scheduleInclude,
      });

      return schedule;
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error("updateRecurringSchedule error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteRecurringSchedule = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleSchedule(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Schedule not found" });
    }

    await prisma.recurringSchedule.delete({
      where: { id },
    });

    res.json({ success: true, message: "Schedule deleted" });
  } catch (error) {
    console.error("deleteRecurringSchedule error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};
