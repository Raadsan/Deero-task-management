import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

const id = process.argv[2];
if (!id) {
  console.error("Usage: node scripts/try-delete-project.mjs <projectId>");
  process.exit(1);
}

try {
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
  console.log("OK deleted", id);
} catch (e) {
  console.error("FAIL:", e.message);
  process.exit(1);
} finally {
  await prisma.$disconnect();
}