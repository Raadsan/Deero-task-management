export function isMainBranch(
  portfolio?: { usesRootLogin?: boolean } | null,
) {
  return Boolean(portfolio?.usesRootLogin);
}

const BRANCH_SCOPED_ROLES = new Set([
  "portfolio admin",
  "portfolio manager",
  "employee",
  "manager",
]);

export function normalizeRoleName(role?: string | null) {
  return String(role ?? "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBranchScopedRole(role?: string | null) {
  return BRANCH_SCOPED_ROLES.has(normalizeRoleName(role));
}

export const BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES = [
  "admin",
  "employee",
  "manager",
] as const;

export function canManageRolePermissions(
  actorRole?: string | null,
  targetRoleName?: string | null,
) {
  const actor = normalizeRoleName(actorRole);
  const target = normalizeRoleName(targetRoleName);

  if (actor === "superadmin") return true;
  if (actor === "portfolio admin") {
    return BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES.includes(
      target as (typeof BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES)[number],
    );
  }
  return false;
}

export function isGlobalScopeRole(role?: string | null, portfolioId?: string | null) {
  if (isSuperadminRole(role)) return true;
  const normalizedRole = normalizeRoleName(role);
  if (!portfolioId) return true;
  if (isBranchScopedRole(normalizedRole)) return false;
  return false;
}

export function isSuperadminRole(role?: string | null) {
  return normalizeRoleName(role) === "superadmin";
}

export function seesAllBranchesForUser(
  role?: string | null,
  portfolio?: { usesRootLogin?: boolean } | null,
  portfolioId?: string | null,
) {
  const normalizedRole = normalizeRoleName(role);
  if (isSuperadminRole(normalizedRole)) return true;
  if (!portfolioId) return true;
  if (isBranchScopedRole(normalizedRole)) return false;
  return isMainBranch(portfolio);
}
