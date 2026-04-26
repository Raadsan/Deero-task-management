import { prisma } from "../lib/prisma.js";

export const getAllRoles = async (req, res) => {
  try {
    const roles = await prisma.role.findMany({
      include: { _count: { select: { users: true } } },
    });
    res.json({ success: true, data: roles });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createRole = async (req, res) => {
  const { name } = req.body;
  try {
    const role = await prisma.role.create({
      data: { name: name.toLowerCase() },
    });
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteRole = async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.role.delete({ where: { id } });
    res.json({ success: true, message: "Role deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
