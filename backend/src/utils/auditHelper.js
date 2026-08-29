import { prisma } from "../lib/prisma.js";

export const logAudit = async (req, action, entity, entityId, description) => {
  try {
    const userId = req?.user?.id || req?.session?.user?.id || null;
    await prisma.auditLog.create({
      data: {
        userId,
        action: String(action || "UNKNOWN"),
        entity: String(entity || "SYSTEM"),
        entityId: entityId ? String(entityId) : null,
        description: description ? String(description) : null,
      },
    });
  } catch (error) {
    // Non-blocking audit failure
    console.warn("[audit-log] Warning: Failed to write audit log:", error.message);
  }
};
