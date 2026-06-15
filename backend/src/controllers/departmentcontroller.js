import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";

const departmentInclude = {
  branch: {
    select: { id: true, name: true },
  },
};

export const getAllDepartments = async (req, res) => {
  const { branchId, activeOnly } = req.query;

  try {
    const departments = await prisma.department.findMany({
      where: {
        ...(branchId ? { branchId: String(branchId) } : {}),
        ...(activeOnly === "true" ? { isActive: true } : {}),
      },
      include: departmentInclude,
      orderBy: [{ branch: { name: "asc" } }, { name: "asc" }],
    });

    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDepartmentById = async (req, res) => {
  const { id } = req.params;

  try {
    const department = await prisma.department.findUnique({
      where: { id },
      include: departmentInclude,
    });

    if (!department) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createDepartment = async (req, res) => {
  const { name, description, isActive, branchId } = req.body;

  try {
    const trimmedName = String(name ?? "").trim();
    const trimmedBranchId = String(branchId ?? "").trim();

    if (!trimmedBranchId) {
      return res.status(400).json({ success: false, error: "Branch is required" });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Department name is required" });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: trimmedBranchId },
      select: { id: true },
    });
    if (!branch) {
      return res.status(400).json({ success: false, error: "Branch not found" });
    }

    const existing = await prisma.department.findFirst({
      where: { name: trimmedName, branchId: trimmedBranchId },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Department name already exists for this branch",
      });
    }

    const id = await generateCustomId({ entityTybe: "departments" });
    const department = await prisma.department.create({
      data: {
        id,
        name: trimmedName,
        description: description?.trim() || null,
        isActive: isActive !== false,
        branchId: trimmedBranchId,
      },
      include: departmentInclude,
    });

    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, branchId } = req.body;

  try {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    const trimmedName = String(name ?? existing.name).trim();
    const trimmedBranchId = String(branchId ?? existing.branchId).trim();

    if (!trimmedBranchId) {
      return res.status(400).json({ success: false, error: "Branch is required" });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Department name is required" });
    }

    const duplicate = await prisma.department.findFirst({
      where: {
        name: trimmedName,
        branchId: trimmedBranchId,
        NOT: { id },
      },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "Department name already exists for this branch",
      });
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: trimmedName,
        description: description === undefined ? undefined : description?.trim() || null,
        isActive: isActive !== undefined ? !!isActive : undefined,
        branchId: trimmedBranchId,
      },
      include: departmentInclude,
    });

    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }

    const usersCount = await prisma.user.count({
      where: {
        branchId: existing.branchId,
        department: existing.name,
      },
    });

    if (usersCount > 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete department while users are assigned to it",
      });
    }

    await prisma.department.delete({ where: { id } });
    res.json({ success: true, message: "Department deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
