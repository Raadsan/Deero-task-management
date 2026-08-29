import { prisma } from "../../../lib/prisma.js";
import { generateCustomId } from "../../../lib/id-generator.js";
import {
  isReservedBranchSlug,
  normalizeBranchSlug,
  saveBranchLogo,
} from "../../../lib/portfolio-logo.js";
import { branchListWhere, canManageBranches, clearMainBranchCache, denyIfOutOfScope, getScope } from "../../../lib/portfolio-scope.js";

// In-memory cache to reduce DB hits on every page load
const brandingCache = new Map();
const BRANDING_CACHE_MS = 60_000; // 60 seconds

function getBrandingCached(key) {
  const entry = brandingCache.get(key);
  if (entry && Date.now() - entry.createdAt < BRANDING_CACHE_MS) return entry.data;
  return null;
}

function setBrandingCached(key, data) {
  brandingCache.set(key, { createdAt: Date.now(), data });
  if (brandingCache.size > 500) {
    brandingCache.delete(brandingCache.keys().next().value);
  }
}

export function clearBrandingCache() {
  brandingCache.clear();
}

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
    const existing = await prisma.portfolio.findFirst({
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
    throw new Error('Use "/" as the only root login path via portfolio URL field');
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
  await prisma.portfolio.updateMany({
    where: {
      usesRootLogin: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    data: { usesRootLogin: false },
  });
}

async function assertRootLoginAvailable(excludeId) {
  const existing = await prisma.portfolio.findFirst({
    where: {
      usesRootLogin: true,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true, name: true },
  });

  if (existing) {
    throw new Error(
      `"/" is already used by portfolio "${existing.name}". Only one portfolio can use /.`,
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

export const getAllPortfolios = async (req, res) => {
  try {
    const scope = getScope(req);
    const portfolios = await prisma.portfolio.findMany({
      where: branchListWhere(scope),
      orderBy: [{ usesRootLogin: "desc" }, { createdAt: "desc" }],
      include: {
        _count: { select: { users: true } },
      },
    });

    res.json({ success: true, data: portfolios });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPortfolioById = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    const portfolio = await prisma.portfolio.findFirst({
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
    if (!portfolio) {
      return res.status(404).json({ success: false, message: "Portfolio not found" });
    }
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

function branchLoginPath(portfolio) {
  if (!portfolio) return null;
  if (portfolio.usesRootLogin) return "/";
  return portfolio.slug ? `/${portfolio.slug}` : null;
}

export const validatePortfolioLogin = async (req, res) => {
  const { userBranchId, loginBranchId, userRole } = req.body;

  if (userRole === "superadmin" && !userBranchId) {
    return res.json({ success: true, data: { portfolioId: loginBranchId || null } });
  }

  if (!userBranchId) {
    return res.status(403).json({
      success: false,
      error: "This account has no portfolio assigned",
    });
  }

  const userBranch = await prisma.portfolio.findUnique({
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
      error: "Your portfolio is not active",
    });
  }

  if (loginBranchId && loginBranchId === userBranchId) {
    return res.json({ success: true, data: { portfolioId: userBranchId } });
  }

  return res.status(403).json({
    success: false,
    error: `Please sign in at ${branchLoginPath(userBranch)}`,
    loginPath: branchLoginPath(userBranch),
  });
};

export const getPortfolioLoginPath = async (req, res) => {
  const { portfolioId } = req.params;
  try {
    const portfolio = await prisma.portfolio.findUnique({
      where: { id: portfolioId },
      select: {
        id: true,
        slug: true,
        usesRootLogin: true,
        isActive: true,
      },
    });
    if (!portfolio) {
      return res.status(404).json({ success: false, error: "Portfolio not found" });
    }
    res.json({
      success: true,
      data: { path: branchLoginPath(portfolio), portfolioId: portfolio.id },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getPublicPortfolioBySlug = async (req, res) => {
  const { slug } = req.params;
  try {
    const portfolio = await prisma.portfolio.findFirst({
      where: { slug, isActive: true, usesRootLogin: false },
      select: publicBranchSelect,
    });
    if (!portfolio) {
      return res.status(404).json({ success: false, message: "Portfolio not found" });
    }
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const getRootLoginPortfolioBranding = async (req, res) => {
  try {
    const cached = getBrandingCached("root-login");
    if (cached) return res.json({ success: true, data: cached });

    const portfolio = await prisma.portfolio.findFirst({
      where: {
        isActive: true,
        usesRootLogin: true,
      },
      select: publicBranchSelect,
    });
    if (!portfolio) {
      return res.status(404).json({ success: false, message: "Root login portfolio not found" });
    }
    setBrandingCached("root-login", portfolio);
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

/** @deprecated Use getRootLoginPortfolioBranding */
export const getMainBranchBranding = getRootLoginPortfolioBranding;

export const getPortfolioBrandingById = async (req, res) => {
  const { id } = req.params;
  try {
    const cached = getBrandingCached(`branding:${id}`);
    if (cached) return res.json({ success: true, data: cached });

    const portfolio = await prisma.portfolio.findUnique({
      where: { id },
      select: publicBranchSelect,
    });
    if (!portfolio) {
      return res.status(404).json({ success: false, message: "Portfolio not found" });
    }
    setBrandingCached(`branding:${id}`, portfolio);
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const createPortfolio = async (req, res) => {
  const scope = getScope(req);
  if (!canManageBranches(scope)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: portfolio management is restricted",
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
      return res.status(400).json({ success: false, error: "Portfolio name is required" });
    }

    const id = await generateCustomId({ entityTybe: "portfolios" });
    const wantsRootLogin = !!useRootLogin || isRootLoginPath(slug);

    let portfolioSlug = null;
    let usesRootLogin = false;

    if (wantsRootLogin) {
      await assertRootLoginAvailable();
      await clearOtherRootLoginBranches();
      usesRootLogin = true;
    } else {
      portfolioSlug = await resolveBranchSlug({ name: trimmedName, slug });
    }

    let logoUrl = null;
    let iconLogoUrl = null;
    if (logoData) logoUrl = await saveBranchLogo(id, logoData, "logo");
    if (iconLogoData) iconLogoUrl = await saveBranchLogo(id, iconLogoData, "icon");

    const portfolio = await prisma.portfolio.create({
      data: {
        id,
        name: trimmedName,
        slug: portfolioSlug,
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
    res.status(201).json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const updatePortfolio = async (req, res) => {
  const { id } = req.params;
  const scope = getScope(req);
  if (!canManageBranches(scope)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: portfolio management is restricted",
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
    const existing = await prisma.portfolio.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ success: false, error: "Portfolio not found" });
    }

    const trimmedName = String(name ?? existing.name).trim();
    if (!trimmedName) {
      return res.status(400).json({ success: false, error: "Portfolio name is required" });
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
          error: "Portfolio URL can only be removed once",
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

    const portfolio = await prisma.portfolio.update({
      where: { id },
      data: updateData,
    });

    clearMainBranchCache();
    res.json({ success: true, data: portfolio });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

export const deletePortfolio = async (req, res) => {
  const { id } = req.params;
  try {
    const scope = getScope(req);
    if (!canManageBranches(scope)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: portfolio management is restricted",
      });
    }

    const portfolio = await prisma.portfolio.findUnique({ where: { id } });
    if (portfolio?.usesRootLogin) {
      return res.status(400).json({
        success: false,
        error: "Cannot delete the root login portfolio",
      });
    }
    await prisma.portfolio.delete({ where: { id } });
    res.json({ success: true, message: "Portfolio deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
