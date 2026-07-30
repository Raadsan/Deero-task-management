import type { ConfigRole } from "@/lib/apis/configApi";

export function formatRoleLabel(roleName: string) {
  const trimmed = String(roleName ?? "").trim();
  if (!trimmed) return "—";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function buildUserRoleOptions(
  roles: ConfigRole[] | undefined,
  currentRole?: string | null,
) {
  const activeRoles = (roles ?? []).filter((role) => role.isActive !== false);
  const roleNames = activeRoles.map((role) => role.name);

  if (currentRole && !roleNames.includes(currentRole)) {
    roleNames.push(currentRole);
  }

  return roleNames.map((name) => ({
    value: name,
    label: formatRoleLabel(name),
  }));
}

export function resolveConfigRoleId(
  roles: ConfigRole[] | undefined,
  roleName: string,
) {
  const normalized = String(roleName ?? "").trim().toLowerCase();
  if (!normalized) return undefined;

  return (roles ?? []).find(
    (role) => role.name.trim().toLowerCase() === normalized,
  )?.id;
}

const LEGACY_SIDEBAR_ROLES = new Set(["admin", "user", "superadmin"]);

export function isLegacySidebarRole(roleName?: string | null) {
  return LEGACY_SIDEBAR_ROLES.has(String(roleName ?? "").trim().toLowerCase());
}
