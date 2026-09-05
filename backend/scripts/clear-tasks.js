import { PrismaClient } from "../lib/generated/prisma/index.js";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function clearTasks() {
  console.log("Connecting to database at:", process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@"));

  try {
    const taskCount = await prisma.task.count();
    const transferCount = await prisma.taskTransferHistory.count();
    const clientTaskCount = await prisma.clientTask.count();
    const occurrenceCount = await prisma.recurringTaskOccurrence.count();
    const taskNotificationCount = await prisma.notification.count({
      where: { taskId: { not: null } },
    });

    console.log(`Current counts before clearing:`);
    console.log(`- Tasks: ${taskCount}`);
    console.log(`- Task Transfer History: ${transferCount}`);
    console.log(`- ClientTasks links: ${clientTaskCount}`);
    console.log(`- Recurring Task Occurrences: ${occurrenceCount}`);
    console.log(`- Task Notifications: ${taskNotificationCount}`);

    console.log("\nStarting deletion in transactional order...");

    const deletedNotifications = await prisma.notification.deleteMany({
      where: { taskId: { not: null } },
    });
    console.log(`✓ Deleted ${deletedNotifications.count} task notifications.`);

    const deletedOccurrences = await prisma.recurringTaskOccurrence.deleteMany({});
    console.log(`✓ Deleted ${deletedOccurrences.count} recurring task occurrences.`);

    const deletedTransfers = await prisma.taskTransferHistory.deleteMany({});
    console.log(`✓ Deleted ${deletedTransfers.count} transfer history records.`);

    const deletedClientTasks = await prisma.clientTask.deleteMany({});
    console.log(`✓ Deleted ${deletedClientTasks.count} clienttask links.`);

    const deletedTasks = await prisma.task.deleteMany({});
    console.log(`✓ Deleted ${deletedTasks.count} tasks.`);

    const deletedCounters = await prisma.counter.deleteMany({
      where: { entity: "tasks" },
    });
    console.log(`✓ Reset ${deletedCounters.count} task counter sequences.`);

    console.log("\n==========================================");
    console.log("SUCCESS: All tasks and related task records have been completely cleared!");
    console.log("Staff, Clients, Services, Portfolios, and Recurring Schedules were NOT modified.");
    console.log("==========================================");
  } catch (error) {
    console.error("Error while clearing tasks:", error);
  } finally {
    await prisma.$disconnect();
  }
}

clearTasks();
