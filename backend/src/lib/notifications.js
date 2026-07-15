import { prisma } from "./prisma.js";
import {
  filterUsersForBranchNotification,
  getMainBranch,
} from "./portfolio-scope.js";

function createNotificationId() {
  return Math.random().toString(36).substring(2, 15);
}

export async function createNotification({
  taskId,
  taskName,
  assigneeName,
  deadline,
  type,
  userId,
}) {
  const notifId = createNotificationId();
  await prisma.$executeRawUnsafe(
    `INSERT INTO notifications (id, taskId, taskName, assigneeName, deadline, type, userId, isSeen) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    notifId,
    taskId,
    taskName,
    assigneeName,
    deadline instanceof Date ? deadline : new Date(deadline),
    type,
    userId,
    0,
  );
}

export async function createNotificationForAdmins({
  taskId,
  taskName,
  assigneeName,
  deadline,
  type,
  excludeUserId,
  portfolioId,
}) {
  const admins = await prisma.staff.findMany({
    where: {
      role: { in: ["admin", "superadmin"] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true, portfolioId: true, role: true },
  });

  let eventBranchId = portfolioId ?? null;
  if (!eventBranchId && excludeUserId) {
    const actor = await prisma.staff.findUnique({
      where: { id: excludeUserId },
      select: { portfolioId: true },
    });
    eventBranchId = actor?.portfolioId ?? null;
  }
  if (!eventBranchId) {
    const mainBranch = await getMainBranch();
    eventBranchId = mainBranch?.id ?? null;
  }

  const recipients = await filterUsersForBranchNotification(
    admins,
    eventBranchId,
  );

  for (const admin of recipients) {
    try {
      await createNotification({
        taskId,
        taskName,
        assigneeName,
        deadline,
        type,
        userId: admin.id,
      });
    } catch (err) {
      console.error("Failed to create notification for admin:", admin.id, err);
    }
  }
}
