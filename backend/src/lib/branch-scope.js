import { prisma } from "./prisma.js";

export function isMainBranch(branch) {
  return Boolean(branch?.usesRootLogin);
}

let cachedMainBranch = null;
let cachedMainBranchAt = 0;
const MAIN_BRANCH_CACHE_MS = 30_000;

export async function getMainBranch() {
  const now = Date.now();
  if (cachedMainBranch && now - cachedMainBranchAt < MAIN_BRANCH_CACHE_MS) {
    return cachedMainBranch;
  }
  cachedMainBranch = await prisma.branch.findFirst({
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
  if (user?.branchId) return user.branchId;
  const mainBranch = await getMainBranch();
  return mainBranch?.id ?? null;
}

async function shouldNotifyUserForBranch(user, eventBranchId, mainBranch) {
  if (!eventBranchId) return true;

  const role = normalizeRoleName(user.role);

  if (role === "superadmin") {
    if (!user.branchId) return true;
    if (mainBranch && user.branchId === mainBranch.id) return true;
    return user.branchId === eventBranchId;
  }

  if (!user.branchId) return true;

  if (mainBranch && user.branchId === mainBranch.id) return true;

  if (isBranchScopedRole(role)) {
    return user.branchId === eventBranchId;
  }

  const branch = await prisma.branch.findUnique({
    where: { id: user.branchId },
    select: { usesRootLogin: true },
  });
  if (isMainBranch(branch)) return true;
  return user.branchId === eventBranchId;
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
  "branch admin",
  "branch manager",
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
  if (actor === "branch admin") {
    return BRANCH_ADMIN_MANAGEABLE_ROLES.has(target);
  }
  return false;
}

export function auditLogBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};
  return { user: { branchId } };
}

export async function resolveBranchScopeFromSession(session) {
  if (!session?.user?.id) {
    return {
      authenticated: false,
      seesAllBranches: true,
      branchId: null,
      user: null,
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      roleId: true,
      branchId: true,
    },
  });

  const user = dbUser ? { ...session.user, ...dbUser } : session.user;
  const role = normalizeRoleName(user.role);

  if (role === "superadmin") {
    if (user.branchId) {
      const branch = await prisma.branch.findUnique({
        where: { id: user.branchId },
        select: { id: true, usesRootLogin: true },
      });
      const onMainBranch = !branch || isMainBranch(branch);
      return {
        authenticated: true,
        seesAllBranches: onMainBranch,
        branchId: user.branchId,
        user,
      };
    }

    const mainBranch = await getMainBranch();
    return {
      authenticated: true,
      seesAllBranches: true,
      branchId: mainBranch?.id ?? null,
      user,
    };
  }

  if (!user.branchId) {
    if (isBranchScopedRole(role)) {
      return {
        authenticated: true,
        seesAllBranches: false,
        branchId: null,
        user,
      };
    }
    return {
      authenticated: true,
      seesAllBranches: true,
      branchId: null,
      user,
    };
  }

  if (isBranchScopedRole(role)) {
    return {
      authenticated: true,
      seesAllBranches: false,
      branchId: user.branchId,
      user,
    };
  }

  const branch = await prisma.branch.findUnique({
    where: { id: user.branchId },
    select: { id: true, usesRootLogin: true },
  });

  if (!branch || isMainBranch(branch)) {
    return {
      authenticated: true,
      seesAllBranches: true,
      branchId: user.branchId,
      user,
    };
  }

  return {
    authenticated: true,
    seesAllBranches: false,
    branchId: user.branchId,
    user,
  };
}

export function getScope(req) {
  return (
    req.branchScope ?? {
      authenticated: false,
      seesAllBranches: true,
      branchId: null,
      user: null,
    }
  );
}

export function resolveWritableBranchId(scope, requestedBranchId) {
  if (isSuperadminScope(scope) || scope.seesAllBranches) {
    return requestedBranchId || null;
  }
  return scope.branchId;
}

export function isWithinBranchScope(scope, targetBranchId) {
  if (isSuperadminScope(scope) || scope.seesAllBranches) return true;
  if (!scope.branchId || !targetBranchId) return false;
  return scope.branchId === targetBranchId;
}

export function denyIfOutOfScope(res, scope, targetBranchId) {
  if (isWithinBranchScope(scope, targetBranchId)) return false;
  res.status(403).json({
    success: false,
    error: "Forbidden: outside your branch scope",
  });
  return true;
}

function scopedBranchId(scope) {
  if (scope.seesAllBranches) return undefined;
  if (!scope.branchId) return "__no_branch__";
  return scope.branchId;
}

export function branchListWhere(scope) {
  if (isSuperadminScope(scope)) return {};
  const branchId = scopedBranchId(scope);
  return branchId ? { id: branchId } : {};
}

export function userBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  return branchId ? { branchId } : {};
}

export function directBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  return branchId ? { branchId } : {};
}

export function clientBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};

  return {
    OR: [
      { branchId },
      {
        serviceAgreements: {
          some: { service: { branchId } },
        },
      },
      {
        clientService: {
          some: { service: { branchId } },
        },
      },
    ],
  };
}

export function projectBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};
  return { branchId };
}

export function contractBranchWhere(scope) {
  return projectBranchWhere(scope);
}

export function taskBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};

  return {
    AND: [
      { user: { branchId } },
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
                        some: { service: { branchId } },
                      },
                    },
                    {
                      clientService: {
                        some: { service: { branchId } },
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
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};

  return {
    serviceAgreement: {
      service: { branchId },
    },
  };
}

export function expenseTransactionBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};

  return {
    user: { branchId },
  };
}

export function salaryBranchWhere(scope) {
  const branchId = scopedBranchId(scope);
  if (!branchId) return {};

  return {
    OR: [
      { recieverUser: { branchId } },
      { registeredUser: { branchId } },
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
