import { prisma } from "./prisma.js";

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
}) {
  const admins = await prisma.user.findMany({
    where: {
      role: { in: ["admin", "superadmin"] },
      ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
    },
    select: { id: true },
  });

  for (const admin of admins) {
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
