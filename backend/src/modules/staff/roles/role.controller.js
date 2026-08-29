import { prisma } from "../../../lib/prisma.js";
import { logAudit } from "../../../lib/auditHelper.js";

let cachedRolesList = null;

export function clearRolesCache() {
  cachedRolesList = null;
}

export const getAllRoles = async (req, res) => {
  try {
    if (cachedRolesList) {
      return res.json({ success: true, data: cachedRolesList });
    }
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
      orderBy: { name: "asc" },
    });
    cachedRolesList = roles;
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createRole = async (req, res) => {
  const { name, description, isActive, canViewSalary } = req.body;
  try {
    const normalized = String(name ?? "").trim().toLowerCase();
    if (!normalized) {
      return res.status(400).json({ success: false, error: "Role name is required" });
    }

    const role = await prisma.role.create({
      data: {
        name: normalized,
        description: description?.trim() || null,
        isActive: isActive !== false,
        canViewSalary: canViewSalary === true,
      },
    });

    clearRolesCache();
    await logAudit({
      userId: req.body.userId,
      action: "Created",
      entity: "Role",
      entityId: role.id,
      description: `Created role "${role.name}"`,
    });

    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateRole = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, canViewSalary } = req.body;
  try {
    const role = await prisma.role.update({
      where: { id },
      data: {
        ...(name ? { name: String(name).trim().toLowerCase() } : {}),
        ...(description !== undefined
          ? { description: description?.trim() || null }
          : {}),
        ...(isActive !== undefined ? { isActive: !!isActive } : {}),
        ...(canViewSalary !== undefined ? { canViewSalary: !!canViewSalary } : {}),
      },
    });

    clearRolesCache();
    await logAudit({
      userId: req.body.userId,
      action: "Updated",
      entity: "Role",
      entityId: role.id,
      description: `Updated role "${role.name}"`,
    });

    res.json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      return res.status(404).json({ success: false, error: "Role not found" });
    }
    if (role._count.users > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete role assigned to users",
      });
    }

    await prisma.role.delete({ where: { id } });
    clearRolesCache();
    await logAudit({
      userId: req.body?.userId,
      action: "Deleted",
      entity: "Role",
      entityId: id,
      description: `Deleted role "${role.name}"`,
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
