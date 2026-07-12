import type { CSSProperties } from "react";

export type BranchBranding = {
  id: string;
  name: string;
  slug?: string | null;
  logoUrl?: string | null;
  iconLogoUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
};

export const DEFAULT_BRANCH_BRANDING: BranchBranding = {
  id: "default",
  name: "Deero",
  primaryColor: "#651210",
  secondaryColor: "#ec4724",
};

/** App routes that must not be treated as branch slugs */
export const RESERVED_BRANCH_SLUGS = new Set([
  "auth",
  "users",
  "clients",
  "contracts",
  "payments",
  "reports",
  "recurring-schedules",
  "tasks",
  "services",
  "branches",
  "departments",
  "payments",
  "my-tasks",
  "profile",
  "invoice",
  "api",
  "settings",
  "config",
  "notifications",
  "b",
  "enterprise",
]);

export function isReservedBranchSlug(slug: string) {
  return RESERVED_BRANCH_SLUGS.has(slug.toLowerCase());
}

export function slugifyBranchName(name: string) {
  return normalizeBranchSlug(name);
}

/** Preserve case for branch URLs */
export function normalizeBranchSlug(value: string) {
  const trimmed = String(value ?? "").trim();
  if (trimmed === "/") return "";
  return trimmed
    .replace(/^\//, "")
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function isRootLoginPath(value?: string | null) {
  return String(value ?? "").trim() === "/";
}

export function formatBranchLoginPath(branch: {
  usesRootLogin?: boolean;
  slug?: string | null;
}) {
  if (branch.usesRootLogin) return "/";
  return branch.slug ? `/${branch.slug}` : "—";
}

export function getBranchSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/?$/);
  if (!match?.[1]) return null;
  const slug = match[1];
  if (isReservedBranchSlug(slug)) return null;
  return slug;
}

export function resolveBranchLogoUrl(logoUrl?: string | null) {
  if (!logoUrl) return null;
  if (logoUrl.startsWith("http://") || logoUrl.startsWith("https://")) {
    return logoUrl;
  }
  if (logoUrl.startsWith("/uploads")) {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
    return `${apiUrl}${logoUrl}`;
  }
  return logoUrl;
}

export function buildBranchThemeVariables(
  branding?: BranchBranding | null,
): Record<string, string> {
  const theme = branding ?? DEFAULT_BRANCH_BRANDING;
  const primary = theme.primaryColor;
  const secondary = theme.secondaryColor;

  return {
    "--branch-primary": primary,
    "--branch-secondary": secondary,
    "--color-brand-primary": primary,
    "--color-brand-secondary": secondary,
    "--color-primary": primary,
    "--color-secondary": secondary,
    "--color-sidebar": primary,
    "--color-sidebar-accent": secondary,
    "--color-sidebar-ring": secondary,
    "--chart-primary": primary,
    "--chart-secondary": secondary,
  };
}

export function getBranchThemeStyle(
  branding?: BranchBranding | null,
): CSSProperties {
  return buildBranchThemeVariables(branding) as CSSProperties;
}

export function getBranchThemeCssText(branding?: BranchBranding | null) {
  const vars = buildBranchThemeVariables(branding);
  return Object.entries(vars)
    .map(([key, value]) => `${key}:${value}`)
    .join(";");
}

export function applyBranchBranding(branding?: BranchBranding | null) {
  if (typeof document === "undefined") return;
  const vars = buildBranchThemeVariables(branding);
  const root = document.documentElement;
  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }
}

export function clearBranchBranding() {
  applyBranchBranding(DEFAULT_BRANCH_BRANDING);
}

/** Branch login URL: /deero-advert */
export function getBranchPathUrl(slug: string, baseUrl?: string) {
  const origin =
    baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  return `${origin}/${slug}`;
}
