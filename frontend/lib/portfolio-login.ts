import { BranchBranding } from "./portfolio-branding";

export function formatBranchLoginPathFromRecord(portfolio: {
  slug?: string | null;
  usesRootLogin?: boolean;
}) {
  if (portfolio.usesRootLogin) return "/";
  return portfolio.slug ? `/${portfolio.slug}` : "/";
}

export function canSuperadminUseAnyLogin(
  user?: { role?: string; portfolioId?: string | null } | null,
) {
  return user?.role === "superadmin" && !user?.portfolioId;
}
