import { prisma } from "../lib/prisma.js";
import { generateCustomId } from "../lib/id-generator.js";
import {
  isReservedBranchSlug,
  normalizeBranchSlug,
  saveBranchLogo,
} from "../lib/branch-logo.js";
import { branchListWhere, canManageBranches, clearMainBranchCache, denyIfOutOfScope, getScope } from "../lib/branch-scope.js";

const publicBranchSelect = {
  id: true,
  name: true,
  slug: true,
  logoUrl: true,
  iconLogoUrl: true,
  primaryColor: true,
  secondaryColor: true,
  usesRootLogin: true,
};

async function ensureUniqueSlug(baseSlug, excludeId) {
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await prisma.branch.findFirst({
      where: {
        slug,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: { id: true },
    });

    if (!existing) return slug;
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }
}

async function resolveBranchSlug({ name, slug, excludeId }) {
  if (isRootLoginPath(slug)) {
    throw new Error('Use "/" as the only root login path via branch URL field');
  }
  const raw = slug !== undefined && slug !== null ? slug : name;
  const base = normalizeBranchSlug(raw);
  if (!base) return null;
  if (isReservedBranchSlug(base)) {
    throw new Error(`"${base}" is a reserved URL path`);
  }
  return ensureUniqueSlug(base, excludeId);
}

function isRootLoginPath(value) {
  if (value === undefined || value === null) return false;
  return String(value).trim() === "/";
}

async function clearOtherRootLoginBranches(excludeId) {
  await prisma.branch.updateMany({
    where: {
      usesRootLogin: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { usesRootLogin: false },
  });
}

async function assertRootLoginAvailable(excludeId) {
  const existing = await prisma.branch.findFirst({
    where: {
      usesRootLogin: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });

  if (existing) {
    throw new Error(
      `"/" is already used by branch "${existing.name}". Only one branch can use /.`,
    );
  }
}

async function assignRootLogin(updateData, excludeId) {
  await assertRootLoginAvailable(excludeId);
  await clearOtherRootLoginBranches(excludeId);
  updateData.usesRootLogin = true;
  updateData.slug = null;
  return updateData;
}

export const getAllBranches = async (req, res) => {
  try {
    const scope = getScope(req);
    const branches = await prisma.branch.findMany({
      where: branchListWhere(scope),
      orderBy: [{ usesRootLogin: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { users: true } },
      },
    });

    res.json({ success: true, data: branches });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getBranchById = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const branch = await prisma.branch.findFirst({
      where: { id, ...branchListWhere(scope) },
      include: {
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: true,
          },
        },
        _count: { select: { users: true } },
      },
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function branchLoginPath(branch) {
  if (!branch) return null;
  if (branch.usesRootLogin) return "/";
  return branch.slug ? `/${branch.slug}` : null;
}

export const validateBranchLogin = async (req, res) => {
  const { userBranchId, loginBranchId, userRole } = req.body;

  if (userRole === "superadmin" && !userBranchId) {
    return res.json({ success: true, data: { branchId: loginBranchId || null } });
  }

  if (!userBranchId) {
    return res.status(403).json({
      success: false,
      error: "This account has no branch assigned",
    });
  }

  const userBranch = await prisma.branch.findUnique({
    where: { id: userBranchId },
    select: {
      id: true,
      slug: true,
      usesRootLogin: true,
      isActive: true,
    },
  });

  if (!userBranch?.isActive) {
    return res.status(403).json({
      success: false,
      error: "Your branch is not active",
    });
  }

  if (loginBranchId && loginBranchId === userBranchId) {
    return res.json({ success: true, data: { branchId: userBranchId } });
  }

  return res.status(403).json({
    success: false,
    error: `Please sign in at ${branchLoginPath(userBranch)}`,
    loginPath: branchLoginPath(userBranch),
  });
};

export const getBranchLoginPath = async (req, res) => {
  const { branchId } = req.params;
  try {
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: {
        id: true,
        slug: true,
        usesRootLogin: true,
        isActive: true,
      },
    });
    if (!branch) {
      return res.status(404).json({ success: false, error: "Branch not found" });
    }
    res.json({
      success: true,
      data: { path: branchLoginPath(branch), branchId: branch.id },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPublicBranchBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const branch = await prisma.branch.findFirst({
      where: { slug, isActive: true, usesRootLogin: false },
      select: publicBranchSelect,
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRootLoginBranchBranding = async (req, res) => {
  try {
    const branch = await prisma.branch.findFirst({
      where: {
        isActive: true,
        usesRootLogin: true,
      },
      select: publicBranchSelect,
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: "Root login branch not found" });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** @deprecated Use getRootLoginBranchBranding */
export const getMainBranchBranding = getRootLoginBranchBranding;

export const getBranchBrandingById = async (req, res) => {
  const { id } = req.params;
  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
      select: publicBranchSelect,
    });
    if (!branch) {
      return res.status(404).json({ success: false, message: "Branch not found" });
    }
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createBranch = async (req, res) => {
  const scope = getScope(req);
  if (!canManageBranches(scope)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: branch management is restricted",
    });
  }

  const {
    name,
    slug,
    description,
    location,
    phone,
    logoData,
    iconLogoData,
    primaryColor,
    secondaryColor,
    isActive,
    useRootLogin,
  } = req.body;

  try {
    const trimmedName = String(name ?? "").trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Branch name is required" });
    }

    const id = await generateCustomId({ entityTybe: "branches" });
    const wantsRootLogin = !!useRootLogin || isRootLoginPath(slug);

    let branchSlug = null;
    let usesRootLogin = false;

    if (wantsRootLogin) {
      await assertRootLoginAvailable();
      await clearOtherRootLoginBranches();
      usesRootLogin = true;
    } else {
      branchSlug = await resolveBranchSlug({ name: trimmedName, slug });
    }

    let logoUrl = null;
    let iconLogoUrl = null;
    if (logoData) logoUrl = await saveBranchLogo(id, logoData, "logo");
    if (iconLogoData) iconLogoUrl = await saveBranchLogo(id, iconLogoData, "icon");

    const branch = await prisma.branch.create({
      data: {
        id,
        name: trimmedName,
        slug: branchSlug,
        description: description || null,
        location: location || null,
        phone: phone || null,
        logoUrl,
        iconLogoUrl,
        usesRootLogin,
        primaryColor: primaryColor || "#651210",
        secondaryColor: secondaryColor || "#ec4724",
        isActive: isActive !== false,
      },
    });

    clearMainBranchCache();
    res.status(201).json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updateBranch = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  if (!canManageBranches(scope)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: branch management is restricted",
    });
  }

  const {
    name,
    slug,
    description,
    location,
    phone,
    logoData,
    iconLogoData,
    primaryColor,
    secondaryColor,
    isActive,
    clearSlug,
    useRootLogin,
  } = req.body;

  try {
    const existing = await prisma.branch.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Branch not found" });
    }

    const trimmedName = String(name ?? existing.name).trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Branch name is required" });
    }

    const updateData = {
      name: trimmedName,
      description: description ?? null,
      location: location ?? null,
      phone: phone ?? null,
      primaryColor: primaryColor || "#651210",
      secondaryColor: secondaryColor || "#ec4724",
      isActive,
    };

    const wantsRootLogin = !!useRootLogin || isRootLoginPath(slug);

    if (wantsRootLogin) {
      await assignRootLogin(updateData, id);
    } else if (useRootLogin === false && existing.usesRootLogin) {
      updateData.usesRootLogin = false;
    } else if (clearSlug || slug === "" || slug === null) {
      if (existing.slug && !existing.slugClearedOnce) {
        updateData.slug = null;
        updateData.slugClearedOnce = true;
        updateData.usesRootLogin = false;
      } else if (!existing.slug) {
        updateData.slug = null;
        updateData.usesRootLogin = false;
      } else {
        return res.status(400).json({
          success: false,
          error: "Branch URL can only be removed once",
        });
      }
    } else if (slug !== undefined && slug !== null && String(slug).trim()) {
      if (existing.slugClearedOnce) {
        return res.status(400).json({
          success: false,
          error: "Cannot set a URL after it was removed",
        });
      }
      updateData.slug = await resolveBranchSlug({
        name: trimmedName,
        slug,
        excludeId: id,
      });
      updateData.usesRootLogin = false;
    }

    if (logoData) {
      updateData.logoUrl = await saveBranchLogo(id, logoData, "logo");
    }
    if (iconLogoData) {
      updateData.iconLogoUrl = await saveBranchLogo(id, iconLogoData, "icon");
    }

    const branch = await prisma.branch.update({
      where: { id },
      data: updateData,
    });

    clearMainBranchCache();
    res.json({ success: true, data: branch });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deleteBranch = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    if (!canManageBranches(scope)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: branch management is restricted",
      });
    }

    const branch = await prisma.branch.findUnique({ where: { id } });
    if (branch?.usesRootLogin) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the root login branch",
      });
    }
    await prisma.branch.delete({ where: { id } });
    res.json({ success: true, message: "Branch deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
