import { BranchBranding } from "./branch-branding";

export function formatBranchLoginPathFromRecord(branch: {
  slug?: string | null;
  usesRootLogin?: boolean;
}) {
  if (branch.usesRootLogin) return "/";
  return branch.slug ? `/${branch.slug}` : "/";
}

export function canSuperadminUseAnyLogin(
  user?: { role?: string; branchId?: string | null } | null,
) {
  return user?.role === "superadmin" && !user?.branchId;
}
