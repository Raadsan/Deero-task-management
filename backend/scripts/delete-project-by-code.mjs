/**
 * One-off: delete a project and its tasks by projectCode (e.g. PRJ-0004).
 * Usage: node scripts/delete-project-by-code.mjs PRJ-0004
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const code = String(process.argv[2] || "").trim();
if (!code) {
  console.error("Usage: node scripts/delete-project-by-code.mjs <projectCode>");
  process.exit(1);
}

async function deleteProjectById(id, name, taskCount) {
  await prisma.$transaction(async (tx) => {
    const taskRows = await tx.task.findMany({
      where: { projectId: id },
      select: { id: true },
    });
    const taskIds = taskRows.map((row) => row.id);
    if (taskIds.length) {
      await tx.clientTask.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.taskTransferHistory.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.recurringTaskOccurrence.deleteMany({ where: { taskId: { in: taskIds } } });
      await tx.task.deleteMany({ where: { id: { in: taskIds } } });
    }

    await tx.contract.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await tx.contentRequest.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await tx.incomeServiceAgreement.updateMany({ where: { projectId: id }, data: { projectId: null } });
    await tx.project.update({ where: { id }, data: { contractId: null } });
    await tx.project.delete({ where: { id } });
  }, { timeout: 120_000 });

  console.log(`Deleted project "${name}" (${id}) and ${taskCount} tasks.`);
}

const project = await prisma.project.findFirst({
  where: { projectCode: code },
  select: { id: true, name: true, projectCode: true },
});

if (!project) {
  console.error(`No project found with projectCode ${code}`);
  process.exit(1);
}

const tasksBefore = await prisma.task.count({ where: { projectId: project.id } });
console.log(`Found ${project.name} (${project.id}), tasks: ${tasksBefore}`);

try {
  await deleteProjectById(project.id, project.name, tasksBefore);
} catch (error) {
  console.error("Delete failed:", error.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}