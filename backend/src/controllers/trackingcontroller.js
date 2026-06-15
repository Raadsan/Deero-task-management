import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/auditHelper.js";

export const getAllLogs = async (req, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 500,
    });
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export async function logAction(userId, action, entity, entityId, description) {
  await logAudit({ userId, action, entity, entityId, description });
}
