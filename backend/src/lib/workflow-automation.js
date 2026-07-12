import { prisma } from "./prisma.js";
import { generateCustomId } from "./id-generator.js";

/**
 * Resolve the default workflow template for a client type or content type.
 */
export async function findWorkflowTemplate(
  { clientType, contentType },
  tx = prisma,
) {
  if (contentType) {
    const byContent = await tx.workflowTemplate.findFirst({
      where: { contentType, isActive: true, isDefault: true },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (byContent) return byContent;
  }

  if (clientType) {
    const byClient = await tx.workflowTemplate.findFirst({
      where: { clientType, isActive: true, isDefault: true },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (byClient) return byClient;
  }

  return null;
}

function addDays(base, days) {
  if (!days || !base) return base ?? null;
  const d = new Date(base);
  d.setDate(d.getDate() + Number(days));
  return d;
}

/**
 * Generate tasks from a workflow template inside a transaction.
 */
export async function generateTasksFromTemplate(
  tx,
  {
    template,
    clientId,
    assigneeId,
    projectId = null,
    contentRequestId = null,
    contentCycleId = null,
    agreementId = null,
    startDate = new Date(),
    serviceInformation = "",
  },
) {
  if (!template?.steps?.length) return [];
  if (!assigneeId) {
    throw new Error("assigneeId is required to generate workflow tasks");
  }

  const created = [];
  let cursor = new Date(startDate);

  for (const step of template.steps) {
    const taskId = await generateCustomId({ entityTybe: "tasks", prisma: tx });
    const deadline = addDays(cursor, step.estimatedDays ?? 1);
    if (deadline) cursor = deadline;

    const task = await tx.task.create({
      data: {
        id: taskId,
        description: step.description || step.taskName,
        status: "pending",
        priority: step.defaultPriority ?? "normal",
        department: step.department || "General",
        deadline,
        progress: 0,
        workflowStage: step.workflowStage ?? "pending",
        sortOrder: step.stepOrder,
        assgineeId: assigneeId,
        serviceInformation: serviceInformation || step.taskName,
        projectId,
        contentRequestId,
        contentCycleId,
        agreementId,
        workflowStepId: step.id,
      },
    });

    if (clientId) {
      await tx.clientTask.create({
        data: { clientId, taskId: task.id },
      });
    }

    created.push(task);
  }

  return created;
}

/**
 * Pick assignee: explicit id, account manager, or session user.
 */
export async function resolveWorkflowAssignee(
  { assigneeId, accountManagerId, fallbackUserId },
  tx = prisma,
) {
  const id = assigneeId || accountManagerId || fallbackUserId;
  if (!id) return null;

  const user = await tx.user.findUnique({
    where: { id },
    select: { id: true },
  });
  return user?.id ?? null;
}

const PROJECT_STATUS_ORDER = [
  "LEAD",
  "PENDING_PAYMENT",
  "ACTIVE",
  "REVIEW",
  "COMPLETED",
  "CANCELLED",
];

export function nextProjectStatus(current) {
  const idx = PROJECT_STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx >= PROJECT_STATUS_ORDER.length - 2) return null;
  return PROJECT_STATUS_ORDER[idx + 1];
}

const CONTENT_REQUEST_STATUS_ORDER = [
  "DRAFT",
  "PLANNING",
  "PRODUCTION",
  "EDITING",
  "REVIEW",
  "APPROVED",
  "SCHEDULED",
  "PUBLISHED",
  "COMPLETED",
];

export function nextContentRequestStatus(current) {
  const idx = CONTENT_REQUEST_STATUS_ORDER.indexOf(current);
  if (idx < 0 || idx >= CONTENT_REQUEST_STATUS_ORDER.length - 1) return null;
  return CONTENT_REQUEST_STATUS_ORDER[idx + 1];
}

export function weekBounds(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { periodStart: start, periodEnd: end };
}
