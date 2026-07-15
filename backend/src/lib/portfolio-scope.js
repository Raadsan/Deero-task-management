import { prisma } from "./prisma.js";

export function isMainBranch(portfolio) {
  return Boolean(portfolio?.usesRootLogin);
}

let cachedMainBranch = null;
let cachedMainBranchAt = 0;
const MAIN_BRANCH_CACHE_MS = 30_000;

export async function getMainBranch() {
  const now = Date.now();
  if (cachedMainBranch && now - cachedMainBranchAt < MAIN_BRANCH_CACHE_MS) {
    return cachedMainBranch;
  }
  cachedMainBranch = await prisma.portfolio.findFirst({
    where: { usesRootLogin: true, isActive: true },
    select: { id: true, usesRootLogin: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  cachedMainBranchAt = now;
  return cachedMainBranch;
}

export function clearMainBranchCache() {
  cachedMainBranch = null;
  cachedMainBranchAt = 0;
}

export async function resolveEffectiveBranchId(user) {
  if (user?.portfolioId) return user.portfolioId;
  const mainBranch = await getMainBranch();
  return mainBranch?.id ?? null;
}

async function shouldNotifyUserForBranch(user, eventBranchId, mainBranch) {
  if (!eventBranchId) return true;

  const role = normalizeRoleName(user.role);

  if (role === "superadmin") {
    if (!user.portfolioId) return true;
    if (mainBranch && user.portfolioId === mainBranch.id) return true;
    return user.portfolioId === eventBranchId;
  }

  if (!user.portfolioId) return true;

  if (mainBranch && user.portfolioId === mainBranch.id) return true;

  if (isBranchScopedRole(role)) {
    return user.portfolioId === eventBranchId;
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: user.portfolioId },
    select: { usesRootLogin: true },
  });
  if (isMainBranch(portfolio)) return true;
  return user.portfolioId === eventBranchId;
}

export async function filterUsersForBranchNotification(users, eventBranchId) {
  const mainBranch = await getMainBranch();
  const eligible = [];
  for (const user of users) {
    if (await shouldNotifyUserForBranch(user, eventBranchId, mainBranch)) {
      eligible.push(user);
    }
  }
  return eligible;
}

const BRANCH_SCOPED_ROLES = new Set([
  "portfolio admin",
  "portfolio manager",
  "employee",
  "manager",
]);

const BRANCH_ADMIN_MANAGEABLE_ROLES = new Set(["admin", "employee", "manager"]);

function normalizeRoleName(roleName) {
  return String(roleName ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBranchScopedRole(roleName) {
  return BRANCH_SCOPED_ROLES.has(normalizeRoleName(roleName));
}

export function isSuperadminScope(scope) {
  return normalizeRoleName(scope?.user?.role) === "superadmin";
}

export function canManageBranches(scope) {
  return isSuperadminScope(scope) || scope.seesAllBranches;
}

export function canManageRolePermissions(actorRole, targetRoleName) {
  const actor = normalizeRoleName(actorRole);
  const target = normalizeRoleName(targetRoleName);

  if (actor === "superadmin") return true;
  if (actor === "portfolio admin") {
    return BRANCH_ADMIN_MANAGEABLE_ROLES.has(target);
  }
  return false;
}

export function auditLogBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};
  return { user: { portfolioId } };
}

export async function resolveBranchScopeFromSession(session) {
  if (!session?.user?.id) {
    return {
      authenticated: false,
      seesAllBranches: true,
      portfolioId: null,
      user: null,
    };
  }

  const dbUser = await prisma.staff.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roleId: true,
      portfolioId: true,
    },
  });

  const user = dbUser ? { ...session.user, ...dbUser } : session.user;
  const role = normalizeRoleName(user.role);

  if (role === "superadmin") {
    if (user.portfolioId) {
      const portfolio = await prisma.portfolio.findUnique({
        where: { id: user.portfolioId },
        select: { id: true, usesRootLogin: true },
      });
      const onMainBranch = !portfolio || isMainBranch(portfolio);
      return {
        authenticated: true,
        seesAllBranches: onMainBranch,
        portfolioId: user.portfolioId,
        user,
      };
    }

    const mainBranch = await getMainBranch();
    return {
      authenticated: true,
      seesAllBranches: true,
      portfolioId: mainBranch?.id ?? null,
      user,
    };
  }

  if (!user.portfolioId) {
    if (isBranchScopedRole(role)) {
      return {
        authenticated: true,
        seesAllBranches: false,
        portfolioId: null,
        user,
      };
    }
    return {
      authenticated: true,
      seesAllBranches: true,
      portfolioId: null,
      user,
    };
  }

  if (isBranchScopedRole(role)) {
    return {
      authenticated: true,
      seesAllBranches: false,
      portfolioId: user.portfolioId,
      user,
    };
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { id: user.portfolioId },
    select: { id: true, usesRootLogin: true },
  });

  if (!portfolio || isMainBranch(portfolio)) {
    return {
      authenticated: true,
      seesAllBranches: true,
      portfolioId: user.portfolioId,
      user,
    };
  }

  return {
    authenticated: true,
    seesAllBranches: false,
    portfolioId: user.portfolioId,
    user,
  };
}

export function getScope(req) {
  return (
    req.branchScope ?? {
      authenticated: false,
      seesAllBranches: true,
      portfolioId: null,
      user: null,
    }
  );
}

export function resolveWritableBranchId(scope, requestedBranchId) {
  if (isSuperadminScope(scope) || scope.seesAllBranches) {
    return requestedBranchId || null;
  }
  return scope.portfolioId;
}

export function isWithinBranchScope(scope, targetBranchId) {
  if (isSuperadminScope(scope) || scope.seesAllBranches) return true;
  if (!scope.portfolioId || !targetBranchId) return false;
  return scope.portfolioId === targetBranchId;
}

export function denyIfOutOfScope(res, scope, targetBranchId) {
  if (isWithinBranchScope(scope, targetBranchId)) return false;
  res.status(403).json({
    success: false,
    error: "Forbidden: outside your portfolio scope",
  });
  return true;
}

function scopedBranchId(scope) {
  if (scope.seesAllBranches) return undefined;
  if (!scope.portfolioId) return "__no_branch__";
  return scope.portfolioId;
}

export function branchListWhere(scope) {
  if (isSuperadminScope(scope)) return {};
  const portfolioId = scopedBranchId(scope);
  return portfolioId ? { id: portfolioId } : {};
}

export function userBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  return portfolioId ? { portfolioId } : {};
}

export function directBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  return portfolioId ? { portfolioId } : {};
}

export function clientBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};

  return {
    OR: [
      { portfolioId },
      {
        serviceAgreements: {
          some: { service: { portfolioId } },
        },
      },
      {
        clientService: {
          some: { service: { portfolioId } },
        },
      },
    ],
  };
}

export function projectBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};
  return { portfolioId };
}

export function contractBranchWhere(scope) {
  return projectBranchWhere(scope);
}

export function taskBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};

  return {
    AND: [
      { user: { portfolioId } },
      {
        OR: [
          { clientTask: { none: {} } },
          {
            clientTask: {
              some: {
                Client: {
                  OR: [
                    {
                      serviceAgreements: {
                        some: { service: { portfolioId } },
                      },
                    },
                    {
                      clientService: {
                        some: { service: { portfolioId } },
                      },
                    },
                  ],
                },
              },
            },
          },
        ],
      },
    ],
  };
}

export function incomeTransactionBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};

  return {
    serviceAgreement: {
      service: { portfolioId },
    },
  };
}

export function expenseTransactionBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};

  return {
    user: { portfolioId },
  };
}

export function salaryBranchWhere(scope) {
  const portfolioId = scopedBranchId(scope);
  if (!portfolioId) return {};

  return {
    OR: [
      { recieverUser: { portfolioId } },
      { registeredUser: { portfolioId } },
    ],
  };
}

export function mergeWhere(...clauses) {
  const parts = clauses.filter(
    (clause) => clause && Object.keys(clause).length > 0,
  );
  if (!parts.length) return {};
  if (parts.length === 1) return parts[0];
  return { AND: parts };
}
