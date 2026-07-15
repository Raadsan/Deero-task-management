import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  denyIfOutOfScope,
  directBranchWhere,
  getScope,
  mergeWhere,
  resolveWritableBranchId,
} from "../lib/portfolio-scope.js";

const departmentInclude = {
  portfolio: {
    select: { id: true, name: true },
  },
};

export const getAllDepartments = async (req, res) => {
  const { activeOnly } = req.query;

  try {
    const scope = getScope(req);
    const departments = await prisma.department.findMany({
      where: mergeWhere(
        directBranchWhere(scope),
        activeOnly === "true" ? { isActive: true } : {},
      ),
      include: departmentInclude,
      orderBy: [{ portfolio: { name: "asc" } }, { name: "asc" }],
    });

    res.json({ success: true, data: departments });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getDepartmentById = async (req, res) => {
  const { id } = req.params;

  try {
    const scope = getScope(req);
    const department = await prisma.department.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
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
  const { name, description, isActive, portfolioId } = req.body;

  try {
    const scope = getScope(req);
    const trimmedName = String(name ?? "").trim();
    const trimmedBranchId = resolveWritableBranchId(scope, portfolioId);

    if (!trimmedBranchId) {
      return res.status(400).json({ success: false, error: "Portfolio is required" });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Department name is required" });
    }

    const portfolio = await prisma.portfolio.findUnique({
      where: { id: trimmedBranchId },
      select: { id: true },
    });
    if (!portfolio) {
      return res.status(400).json({ success: false, error: "Portfolio not found" });
    }

    const existing = await prisma.department.findFirst({
      where: { name: trimmedName, portfolioId: trimmedBranchId },
    });
    if (existing) {
      return res.status(400).json({
        success: false,
        error: "Department name already exists for this portfolio",
      });
    }

    const id = await generateCustomId({ entityTybe: "departments" });
    const department = await prisma.department.create({
      data: {
        id,
        name: trimmedName,
        description: description?.trim() || null,
        isActive: isActive !== false,
        portfolioId: trimmedBranchId,
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
  const { name, description, isActive, portfolioId } = req.body;

  try {
    const scope = getScope(req);
    const existing = await prisma.department.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }
    if (denyIfOutOfScope(res, scope, existing.portfolioId)) return;

    const trimmedName = String(name ?? existing.name).trim();
    const trimmedBranchId = resolveWritableBranchId(
      scope,
      portfolioId ?? existing.portfolioId,
    );

    if (!trimmedBranchId) {
      return res.status(400).json({ success: false, error: "Portfolio is required" });
    }
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Department name is required" });
    }

    const duplicate = await prisma.department.findFirst({
      where: {
        name: trimmedName,
        portfolioId: trimmedBranchId,
        NOT: { id },
      },
    });
    if (duplicate) {
      return res.status(400).json({
        success: false,
        error: "Department name already exists for this portfolio",
      });
    }

    const department = await prisma.department.update({
      where: { id },
      data: {
        name: trimmedName,
        description: description === undefined ? undefined : description?.trim() || null,
        isActive: isActive !== undefined ? !!isActive : undefined,
        portfolioId: trimmedBranchId,
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
    const scope = getScope(req);
    const existing = await prisma.department.findFirst({
      where: mergeWhere({ id }, directBranchWhere(scope)),
    });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Department not found" });
    }
    if (denyIfOutOfScope(res, scope, existing.portfolioId)) return;

    const usersCount = await prisma.staff.count({
      where: {
        portfolioId: existing.portfolioId,
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
