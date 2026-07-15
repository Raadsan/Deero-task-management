import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  getScope,
  mergeWhere,
  projectBranchWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";
import {
  findWorkflowTemplate,
  generateTasksFromTemplate,
  nextContentRequestStatus,
  resolveWorkflowAssignee,
} from "../lib/workflow-automation.js";

const requestInclude = {
  client: { select: { id: true, institution: true, clientType: true, accountManagerId: true } },
  project: { select: { id: true, name: true } },
  portfolio: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  assignees: {
    include: { user: { select: { id: true, name: true, role: true } } },
  },
  _count: { select: { tasks: true } },
};

function contentRequestWhere(scope, extra = {}) {
  const portfolioId = scope.portfolioId && !scope.seesAllBranches ? scope.portfolioId : null;
  return mergeWhere(
    portfolioId ? { portfolioId } : {},
    extra,
  );
}

async function findAccessibleRequest(scope, id, include = requestInclude) {
  const row = await prisma.contentRequest.findFirst({
    where: { id, ...contentRequestWhere(scope) },
    include,
  });
  if (!row) return null;

  const client = await prisma.client.findFirst({
    where: mergeWhere({ id: row.clientId }, clientBranchWhere(scope)),
    select: { id: true },
  });
  return client ? row : null;
}

export const getAllContentRequests = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId, status, contentType } = req.query;

    const requests = await prisma.contentRequest.findMany({
      where: contentRequestWhere(scope, {
        ...(clientId ? { clientId: String(clientId) } : {}),
        ...(status ? { status: String(status) } : {}),
        ...(contentType ? { contentType: String(contentType) } : {}),
      }),
      include: requestInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: requests });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getContentRequestById = async (req, res) => {
  try {
    const scope = getScope(req);
    const row = await findAccessibleRequest(scope, req.params.id, {
      ...requestInclude,
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { id: true, name: true } } },
      },
    });

    if (!row) {
      return res.status(404).json({ success: false, error: "Content request not found" });
    }

    res.json({ success: true, data: row });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createContentRequest = async (req, res) => {
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

    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "content_requests", prisma: tx });
      const request = await tx.contentRequest.create({
        data: {
          id,
          title: String(data.title ?? "").trim(),
          description: data.description ?? null,
          contentType: data.contentType ?? "OTHER",
          status: data.status ?? "PLANNING",
          deadline: data.deadline ? new Date(data.deadline) : null,
          clientId: client.id,
          projectId: data.projectId ?? null,
          portfolioId: portfolioId ?? client.portfolioId ?? null,
          createdById: scope.user?.id ?? null,
        },
      });

      const assigneeIds = Array.isArray(data.assigneeIds) ? data.assigneeIds : [];
      for (const userId of assigneeIds) {
        await tx.contentRequestAssignee.create({
          data: {
            contentRequestId: request.id,
            userId,
            role: data.assigneeRole ?? null,
          },
        });
      }

      let tasks = [];
      if (data.autoGenerateTasks !== false) {
        const template = await findWorkflowTemplate(
          { contentType: request.contentType },
          tx,
        );

        const primaryAssignee =
          assigneeIds[0] ??
          (await resolveWorkflowAssignee(
            {
              assigneeId: data.assigneeId,
              accountManagerId: client.accountManagerId,
              fallbackUserId: scope.user?.id,
            },
            tx,
          ));

        if (template && primaryAssignee) {
          tasks = await generateTasksFromTemplate(tx, {
            template,
            clientId: client.id,
            assigneeId: primaryAssignee,
            contentRequestId: request.id,
            projectId: request.projectId,
            startDate: new Date(),
            serviceInformation: request.title,
          });
        }
      }

      return { request, tasks };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateContentRequest = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleRequest(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Content request not found" });
    }

    const request = await prisma.contentRequest.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: String(data.title).trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.contentType !== undefined ? { contentType: data.contentType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.deadline !== undefined
          ? { deadline: data.deadline ? new Date(data.deadline) : null }
          : {}),
        ...(data.projectId !== undefined ? { projectId: data.projectId } : {}),
      },
      include: requestInclude,
    });

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const patchContentRequestStatus = async (req, res) => {
  const { id } = req.params;
  const { status, advance } = req.body ?? {};
  try {
    const scope = getScope(req);
    const existing = await findAccessibleRequest(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Content request not found" });
    }

    const nextStatus = advance ? nextContentRequestStatus(existing.status) : status;
    if (!nextStatus) {
      return res.status(400).json({ success: false, error: "Invalid status transition" });
    }

    const request = await prisma.contentRequest.update({
      where: { id },
      data: { status: nextStatus },
      include: requestInclude,
    });

    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const addContentRequestAssignees = async (req, res) => {
  const { id } = req.params;
  const { assigneeIds = [], role } = req.body ?? {};
  try {
    const scope = getScope(req);
    const existing = await findAccessibleRequest(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Content request not found" });
    }

    await prisma.$transaction(
      assigneeIds.map((userId) =>
        prisma.contentRequestAssignee.upsert({
          where: {
            contentRequestId_userId: { contentRequestId: id, userId },
          },
          create: { contentRequestId: id, userId, role: role ?? null },
          update: { role: role ?? null },
        }),
      ),
    );

    const request = await findAccessibleRequest(scope, id);
    res.json({ success: true, data: request });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const generateContentRequestTasks = async (req, res) => {
  const { id } = req.params;
  const data = req.body ?? {};
  try {
    const scope = getScope(req);
    const request = await findAccessibleRequest(scope, id, {
      ...requestInclude,
      assignees: true,
    });
    if (!request) {
      return res.status(404).json({ success: false, error: "Content request not found" });
    }

    const tasks = await prisma.$transaction(async (tx) => {
      const template = data.templateId
        ? await tx.workflowTemplate.findUnique({
            where: { id: data.templateId },
            include: { steps: { orderBy: { stepOrder: "asc" } } },
          })
        : await findWorkflowTemplate({ contentType: request.contentType }, tx);

      if (!template) throw new Error("No workflow template found");

      const assigneeId = await resolveWorkflowAssignee(
        {
          assigneeId: data.assigneeId ?? request.assignees?.[0]?.userId,
          accountManagerId: request.client.accountManagerId,
          fallbackUserId: scope.user?.id,
        },
        tx,
      );
      if (!assigneeId) throw new Error("No assignee available");

      return generateTasksFromTemplate(tx, {
        template,
        clientId: request.clientId,
        assigneeId,
        contentRequestId: request.id,
        projectId: request.projectId,
        startDate: new Date(),
        serviceInformation: request.title,
      });
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
