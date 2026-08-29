import { prisma } from "../../../lib/prisma.js";

export const getNotifications = async (req, res) => {
  const { userId } = req.query;
  try {
    let notifications = [];
    if (userId) {
      notifications = await prisma.$queryRawUnsafe(
        `SELECT id, taskId, taskName, assigneeName, deadline, type, userId, isSeen,
                CONCAT(DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s'), '+03:00') AS createdAt
         FROM notifications
         WHERE userId = ?
         ORDER BY createdAt DESC
         LIMIT 50`,
        String(userId),
      );
    } else {
      notifications = await prisma.$queryRawUnsafe(
        `SELECT id, taskId, taskName, assigneeName, deadline, type, userId, isSeen,
                CONCAT(DATE_FORMAT(createdAt, '%Y-%m-%dT%H:%i:%s'), '+03:00') AS createdAt
         FROM notifications
         ORDER BY createdAt DESC
         LIMIT 50`,
      );
    }
    res.json({ success: true, data: notifications });
  } catch (error) {
    console.error("Notifications error:", error.message);
    res.json({ success: true, data: [] });
  }
};

export const markAsSeen = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE notifications SET isSeen = 1 WHERE id = ?`,
      id,
    );
    res.json({ success: true });
  } catch (error) {
    res.json({ success: true });
  }
};
