import { prisma } from "./prisma.js";

export async function logAudit({ userId, action, entity, entityId, description }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action,
        entity,
        entityId: entityId ? String(entityId) : null,
        description: description || null,
      },
    });
  } catch (error) {
    console.error("Failed to create audit log:", error);
  }
}
