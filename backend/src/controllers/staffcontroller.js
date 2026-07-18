import { prisma } from "../lib/prisma.js";
import { auth } from "../lib/auth.js";
import { deleteUserFileFromDisk, saveUserFile } from "../lib/user-files.js";
import {
  denyIfOutOfScope,
  getScope,
  resolveWritableBranchId,
  userBranchWhere,
} from "../lib/portfolio-scope.js";

const staffListCache = new Map();
const STAFF_LIST_CACHE_MS = 5 * 60 * 1000;

function clearStaffListCache() {
  staffListCache.clear();
}

async function actorCanViewSalary(scope) {
  if (String(scope.user?.role ?? "").toLowerCase() === "superadmin") return true;
  if (!scope.user?.roleId) return false;
  const role = await prisma.role.findUnique({
    where: { id: scope.user.roleId },
    select: { canViewSalary: true },
  });
  return role?.canViewSalary === true;
}

function hideSalary(users, allowed) {
  if (allowed) return users;
  if (Array.isArray(users)) return users.map(({ salary, ...user }) => user);
  if (!users) return users;
  const { salary, ...user } = users;
  return user;
}

export const getAllStaff = async (req, res) => {
  try {
    const scope = getScope(req);
    const canViewSalary = await actorCanViewSalary(scope);
    const cacheKey = scope.seesAllBranches ? "all" : scope.portfolioId || "none";
    const cached = staffListCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < STAFF_LIST_CACHE_MS) {
      return res.json({ success: true, data: hideSalary(cached.data, canViewSalary) });
    }
    const users = await prisma.staff.findMany({
      where: userBranchWhere(scope),
      orderBy: {
        createdAt: "desc",
      },
      include: {
        portfolio: {
          select: { id: true, name: true },
        },
      },
    });
    staffListCache.set(cacheKey, { createdAt: Date.now(), data: users });
    res.json({ success: true, data: hideSalary(users, canViewSalary) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStaffById = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const canViewSalary = await actorCanViewSalary(scope);
    const user = await prisma.staff.findUnique({
      where: { id },
      include: {
        portfolio: {
          select: { id: true, name: true, location: true },
        },
        userFiles: {
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!user) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, user.portfolioId)) return;
    res.json({ success: true, data: hideSalary(user, canViewSalary) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createStaff = async (req, res) => {
  const { name, email, password, role, gender, salary, portfolioId, banned } = req.body;
  try {
    if (salary !== undefined && salary !== null && salary !== "" && !/^\d+(\.\d{1,2})?$/.test(String(salary))) {
      return res.status(400).json({
        success: false,
        message: "Salary must be a valid amount",
      });
    }
    const scope = getScope(req);
    const resolvedBranchId =
      portfolioId === null || portfolioId === undefined || portfolioId === ""
        ? null
        : resolveWritableBranchId(scope, portfolioId);
    const existingUser = await prisma.staff.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ success: false, message: "Email already exists" });
    }

    // Use better-auth to create user so password is hashed
    const result = await auth.api.createUser({
      body: {
        name,
        email,
        password,
        role: role || "user",
      },
      headers: req.headers,
    });

    // Update additional fields
    let resolvedRoleId = req.body.roleId || null;
    if (!resolvedRoleId && role) {
      const dynamicRole = await prisma.role.findFirst({
        where: { name: String(role).trim().toLowerCase() },
      });
      resolvedRoleId = dynamicRole?.id ?? null;
    }

    const updatedUser = await prisma.staff.update({
      where: { id: result.user.id },
      data: {
        gender,
        salary: salary ? String(salary) : null,
        portfolioId: resolvedBranchId,
        banned: banned === true,
        roleId: resolvedRoleId,
        role: role || "user",
      },
    });

    clearStaffListCache();
    res.status(201).json({ success: true, data: updatedUser });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateStaff = async (req, res) => {
  const { id } = req.params;
  const { name, email, role, gender, salary, portfolioId, banned, roleId } =
    req.body;
  try {
    if (
      salary !== undefined &&
      salary !== null && salary !== "" && !/^\d+(\.\d{1,2})?$/.test(String(salary))
    ) {
      return res.status(400).json({
        success: false,
        message: "Salary must be a valid amount",
      });
    }
    const scope = getScope(req);
    const existing = await prisma.staff.findUnique({
      where: { id },
      select: { portfolioId: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, existing.portfolioId)) return;

    const resolvedBranchId =
      portfolioId === undefined
        ? undefined
        : portfolioId === null || portfolioId === ""
          ? null
          : resolveWritableBranchId(scope, portfolioId);

    let resolvedRoleId = roleId || null;
    if (!resolvedRoleId && role) {
      const dynamicRole = await prisma.role.findFirst({
        where: { name: String(role).trim().toLowerCase() },
      });
      resolvedRoleId = dynamicRole?.id ?? null;
    }

    const user = await prisma.staff.update({
      where: { id },
      data: {
        name,
        email,
        role,
        gender,
        salary: salary === undefined ? undefined : salary ? String(salary) : null,
        portfolioId: resolvedBranchId,
        ...(banned !== undefined ? { banned: !!banned } : {}),
        ...(role !== undefined ? { roleId: resolvedRoleId } : {}),
      },
      include: {
        portfolio: {
          select: { id: true, name: true },
        },
      },
    });
    clearStaffListCache();
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
export const deleteStaff = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const existing = await prisma.staff.findUnique({
      where: { id },
      select: { portfolioId: true },
    });
    if (!existing) {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, existing.portfolioId)) return;

    await prisma.staff.delete({
      where: { id },
    });
    clearStaffListCache();
    res.json({ success: true, message: "Staff deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getStaffFiles = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const user = await prisma.staff.findUnique({
      where: { id },
      select: { portfolioId: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, user.portfolioId)) return;

    const files = await prisma.userFiles.findMany({
      where: { userId: id },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, data: files });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const uploadStaffFiles = async (req, res) => {
  const { id } = req.params;
  const { files } = req.body;

  try {
    const scope = getScope(req);
    const user = await prisma.staff.findUnique({ where: { id }, select: { id: true, portfolioId: true } });
    if (!user) {
      return res.status(404).json({ success: false, error: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, user.portfolioId)) return;

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ success: false, error: "No files provided" });
    }

    if (files.length > 5) {
      return res.status(400).json({ success: false, error: "You can upload up to 5 files at a time" });
    }

    const saved = [];
    for (const file of files) {
      const documentType = String(file.documentType ?? "").trim();
      if (documentType) {
        const existing = await prisma.userFiles.findMany({
          where: { userId: id, name: documentType },
        });
        for (const old of existing) {
          await deleteUserFileFromDisk(old.url);
          await prisma.userFiles.delete({ where: { id: old.id } });
        }
      }

      const stored = await saveUserFile(id, {
        ...file,
        name: documentType ? `${documentType}.pdf` : file.name,
      });
      const record = await prisma.userFiles.create({
        data: {
          userId: id,
          url: stored.url,
          name: documentType || stored.name,
          fileSize: stored.fileSize,
        },
      });
      saved.push(record);
    }

    res.status(201).json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteStaffFile = async (req, res) => {
  const { id, fileId } = req.params;

  try {
    const scope = getScope(req);
    const user = await prisma.staff.findUnique({
      where: { id },
      select: { portfolioId: true },
    });
    if (!user) {
      return res.status(404).json({ success: false, error: "Staff not found" });
    }
    if (denyIfOutOfScope(res, scope, user.portfolioId)) return;

    const file = await prisma.userFiles.findFirst({
      where: { id: fileId, userId: id },
    });

    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    await deleteUserFileFromDisk(file.url);
    await prisma.userFiles.delete({ where: { id: fileId } });

    res.json({ success: true, message: "File deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
