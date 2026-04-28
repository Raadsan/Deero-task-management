import { prisma } from "../lib/prisma.js";

export const getNotifications = async (req, res) => {
  const { userId } = req.query; 
  try {
    const notifications = await prisma.$queryRawUnsafe(
      `SELECT * FROM notifications WHERE userId = ? AND isSeen = 0 ORDER BY createdAt DESC`,
      userId
    );
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const markAsSeen = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE notifications SET isSeen = 1 WHERE id = ?`,
      id
    );
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
