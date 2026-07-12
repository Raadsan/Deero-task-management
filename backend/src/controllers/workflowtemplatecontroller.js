import { prisma } from "../lib/prisma.js";
import { DEFAULT_WORKFLOW_TEMPLATES } from "../data/default-workflow-templates.js";
import { generateCustomId } from "../lib/id-generator.js";

export const getAllWorkflowTemplates = async (req, res) => {
  try {
    const { clientType, contentType } = req.query;
    const templates = await prisma.workflowTemplate.findMany({
      where: {
        isActive: true,
        ...(clientType ? { clientType: String(clientType) } : {}),
        ...(contentType ? { contentType: String(contentType) } : {}),
      },
      include: {
        steps: { orderBy: { stepOrder: "asc" } },
        _count: { select: { steps: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json({ success: true, data: templates });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getWorkflowTemplateById = async (req, res) => {
  try {
    const template = await prisma.workflowTemplate.findUnique({
      where: { id: req.params.id },
      include: { steps: { orderBy: { stepOrder: "asc" } } },
    });
    if (!template) {
      return res.status(404).json({ success: false, error: "Template not found" });
    }
    res.json({ success: true, data: template });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const seedWorkflowTemplates = async (req, res) => {
  try {
    const created = [];

    for (const definition of DEFAULT_WORKFLOW_TEMPLATES) {
      const existing = await prisma.workflowTemplate.findFirst({
        where: { name: definition.name, isDefault: true },
      });
      if (existing) continue;

      const id = await generateCustomId({ entityTybe: "workflow_templates" });
      const template = await prisma.workflowTemplate.create({
        data: {
          id,
          name: definition.name,
          description: definition.description,
          clientType: definition.clientType,
          contentType: definition.contentType,
          isDefault: true,
          isActive: true,
          steps: {
            create: definition.steps.map((step) => ({
              stepOrder: step.stepOrder,
              taskName: step.taskName,
              department: step.department ?? "General",
              defaultPriority: step.defaultPriority ?? "normal",
              estimatedDays: step.estimatedDays ?? null,
              workflowStage: step.workflowStage ?? "pending",
            })),
          },
        },
        include: { steps: true },
      });
      created.push(template);
    }

    res.json({
      success: true,
      message: `Seeded ${created.length} templates`,
      data: created,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
