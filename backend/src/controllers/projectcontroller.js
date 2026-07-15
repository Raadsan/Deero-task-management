import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  clientBranchWhere,
  denyIfOutOfScope,
  getScope,
  mergeWhere,
  projectBranchWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";
import {
  findWorkflowTemplate,
  generateTasksFromTemplate,
  nextProjectStatus,
  resolveWorkflowAssignee,
} from "../lib/workflow-automation.js";

const projectInclude = {
  client: { select: { id: true, institution: true, clientType: true } },
  portfolio: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
  _count: { select: { tasks: true, contentRequests: true } },
};

async function findAccessibleProject(scope, id, include = projectInclude) {
  return prisma.project.findFirst({
    where: mergeWhere({ id }, projectBranchWhere(scope)),
    include,
  });
}

export const getAllProjects = async (req, res) => {
  try {
    const scope = getScope(req);
    const { clientId, status, portfolioId } = req.query;

    const where = mergeWhere(projectBranchWhere(scope), {
      ...(clientId ? { clientId: String(clientId) } : {}),
      ...(status ? { status: String(status) } : {}),
      ...(portfolioId ? { portfolioId: String(portfolioId) } : {}),
    });

    const projects = await prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ success: true, data: projects });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const scope = getScope(req);
    const project = await findAccessibleProject(scope, req.params.id, {
      ...projectInclude,
      tasks: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: { user: { select: { id: true, name: true } } },
      },
      serviceAgreements: {
        include: { service: true, subService: true },
      },
    });

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createProject = async (req, res) => {
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
    if (portfolioId && denyIfOutOfScope(res, scope, portfolioId)) return;

    const result = await prisma.$transaction(async (tx) => {
      const id = await generateCustomId({ entityTybe: "projects", prisma: tx });
      const project = await tx.project.create({
        data: {
          id,
          name: String(data.name ?? "").trim(),
          description: data.description ?? null,
          projectType: data.projectType ?? "OTHER",
          status: data.status ?? "LEAD",
          priority: data.priority ?? "medium",
          startDate: data.startDate ? new Date(data.startDate) : null,
          dueDate: data.dueDate ? new Date(data.dueDate) : null,
          clientId: client.id,
          portfolioId: portfolioId ?? client.portfolioId ?? null,
          createdById: scope.user?.id ?? null,
        },
      });

      let tasks = [];
      if (data.autoGenerateTasks !== false) {
        const template =
          data.templateId
            ? await tx.workflowTemplate.findUnique({
                where: { id: data.templateId },
                include: { steps: { orderBy: { stepOrder: "asc" } } },
              })
            : await findWorkflowTemplate(
                { clientType: "ONE_TIME", contentType: data.projectType },
                tx,
              );

        const assigneeId = await resolveWorkflowAssignee(
          {
            assigneeId: data.assigneeId,
            accountManagerId: client.accountManagerId,
            fallbackUserId: scope.user?.id,
          },
          tx,
        );

        if (template && assigneeId) {
          tasks = await generateTasksFromTemplate(tx, {
            template,
            clientId: client.id,
            assigneeId,
            projectId: project.id,
            startDate: project.startDate ?? new Date(),
            serviceInformation: project.name,
          });
        }
      }

      return { project, tasks };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateProject = async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleProject(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: String(data.name).trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.projectType !== undefined ? { projectType: data.projectType } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.startDate !== undefined
          ? { startDate: data.startDate ? new Date(data.startDate) : null }
          : {}),
        ...(data.dueDate !== undefined
          ? { dueDate: data.dueDate ? new Date(data.dueDate) : null }
          : {}),
      },
      include: projectInclude,
    });

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const advanceProjectStatus = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleProject(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const next = nextProjectStatus(existing.status);
    if (!next) {
      return res.status(400).json({ success: false, error: "Cannot advance project status" });
    }

    const project = await prisma.project.update({
      where: { id },
      data: { status: next },
      include: projectInclude,
    });

    res.json({ success: true, data: project });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const generateProjectTasks = async (req, res) => {
  const { id } = req.params;
  const data = req.body ?? {};
  try {
    const scope = getScope(req);
    const project = await prisma.project.findFirst({
      where: mergeWhere({ id }, projectBranchWhere(scope)),
      include: { client: true },
    });
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const tasks = await prisma.$transaction(async (tx) => {
      const template =
        data.templateId
          ? await tx.workflowTemplate.findUnique({
              where: { id: data.templateId },
              include: { steps: { orderBy: { stepOrder: "asc" } } },
            })
          : await findWorkflowTemplate(
              { clientType: "ONE_TIME", contentType: project.projectType },
              tx,
            );

      if (!template) {
        throw new Error("No workflow template found");
      }

      const assigneeId = await resolveWorkflowAssignee(
        {
          assigneeId: data.assigneeId,
          accountManagerId: project.client.accountManagerId,
          fallbackUserId: scope.user?.id,
        },
        tx,
      );
      if (!assigneeId) {
        throw new Error("No assignee available for task generation");
      }

      return generateTasksFromTemplate(tx, {
        template,
        clientId: project.clientId,
        assigneeId,
        projectId: project.id,
        startDate: project.startDate ?? new Date(),
        serviceInformation: project.name,
      });
    });

    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteProject = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await findAccessibleProject(scope, id);
    if (!existing) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    await prisma.project.delete({ where: { id } });
    res.json({ success: true, message: "Project deleted" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
