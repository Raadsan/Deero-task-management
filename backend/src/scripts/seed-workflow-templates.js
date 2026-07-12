import "dotenv/config";
import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import { DEFAULT_WORKFLOW_TEMPLATES } from "../data/default-workflow-templates.js";

async function ensureTemplate(definition) {
  const existing = await prisma.workflowTemplate.findFirst({
    where: {
      name: definition.name,
      isDefault: true,
    },
    include: { steps: true },
  });

  if (existing) {
    console.log(`  = Template exists: ${definition.name}`);
    return existing;
  }

  const id = await generateCustomId({ entityTybe: "workflow_templates" });
  const template = await prisma.workflowTemplate.create({
    data: {
      id,
      name: definition.name,
      description: definition.description,
      clientType: definition.clientType,
      contentType: definition.contentType,
      isDefault: definition.isDefault,
      isActive: true,
      steps: {
        create: definition.steps.map((step) => ({
          stepOrder: step.stepOrder,
          taskName: step.taskName,
          description: step.description ?? null,
          department: step.department ?? "General",
          defaultPriority: step.defaultPriority ?? "normal",
          estimatedDays: step.estimatedDays ?? null,
          workflowStage: step.workflowStage ?? "pending",
        })),
      },
    },
    include: { steps: true },
  });

  console.log(`  + Template: ${definition.name} (${template.steps.length} steps)`);
  return template;
}

async function main() {
  console.log("Seeding workflow templates...\n");

  for (const definition of DEFAULT_WORKFLOW_TEMPLATES) {
    await ensureTemplate(definition);
  }

  const count = await prisma.workflowTemplate.count({ where: { isDefault: true } });
  console.log(`\nDone. Default templates: ${count}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
