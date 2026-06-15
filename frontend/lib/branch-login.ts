import { BranchBranding } from "./branch-branding";

export function formatBranchLoginPathFromRecord(branch: {
  slug?: string | null;
  usesRootLogin?: boolean;
  isMain?: boolean;
}) {
  if (branch.usesRootLogin || branch.isMain) return "/";
  return branch.slug ? `/${branch.slug}` : "/";
}

export function canSuperadminUseAnyLogin(
  user?: { role?: string; branchId?: string | null } | null,
) {
  return user?.role === "superadmin" && !user?.branchId;
}
