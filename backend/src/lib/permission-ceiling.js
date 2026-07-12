import { prisma } from "./prisma.js";

function permFlags(entry) {
  return {
    canView: Boolean(entry?.canView),
    canAdd: Boolean(entry?.canAdd),
    canEdit: Boolean(entry?.canEdit),
    canDelete: Boolean(entry?.canDelete),
  };
}

function intersectPerm(requested, ceiling) {
  return {
    canView: Boolean(requested.canView && ceiling.canView),
    canAdd: Boolean(requested.canAdd && ceiling.canAdd),
    canEdit: Boolean(requested.canEdit && ceiling.canEdit),
    canDelete: Boolean(requested.canDelete && ceiling.canDelete),
  };
}

const EMPTY_PERM = {
  canView: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
};

function hasAnyPermission(flags) {
  return Boolean(flags?.canView || flags?.canAdd || flags?.canEdit || flags?.canDelete);
}

export function getGrantableMenuIds(ceiling) {
  const ids = new Set();
  for (const [menuId, flags] of Object.entries(ceiling.menus ?? {})) {
    if (hasAnyPermission(flags)) ids.add(menuId);
  }
  for (const [key, flags] of Object.entries(ceiling.submenus ?? {})) {
    if (!hasAnyPermission(flags)) continue;
    const menuId = key.split(":")[0];
    if (menuId) ids.add(menuId);
  }
  return ids;
}

export function accessListToPayload(accessList) {
  return accessList.map((access) => ({
    menuId: access.menuId,
    ...permFlags(access),
    submenus: (access.subAccess || []).map((sub) => ({
      subMenuId: sub.subMenuId,
      ...permFlags(sub),
    })),
  }));
}

export function mergeScopedPermissionUpdate(incoming, existingPayload, ceiling) {
  const grantableMenuIds = getGrantableMenuIds(ceiling);
  const incomingByMenuId = new Map(
    clampPermissionsPayload(incoming, ceiling).map((item) => [item.menuId, item]),
  );
  const merged = [];

  for (const existing of existingPayload) {
    if (grantableMenuIds.has(existing.menuId)) {
      const updated = incomingByMenuId.get(existing.menuId);
      if (updated) merged.push(updated);
      continue;
    }
    merged.push(existing);
  }

  for (const [menuId, incomingItem] of incomingByMenuId) {
    if (!grantableMenuIds.has(menuId)) continue;
    if (!merged.some((item) => item.menuId === menuId)) {
      merged.push(incomingItem);
    }
  }

  return merged;
}

export async function loadRolePermissionCeiling(roleId) {
  if (!roleId) {
    return { menus: {}, submenus: {} };
  }

  const accessList = await prisma.roleMenuAccess.findMany({
    where: { roleId },
    include: { subAccess: true },
  });

  const menus = {};
  const submenus = {};

  for (const access of accessList) {
    menus[access.menuId] = permFlags(access);
    for (const sub of access.subAccess) {
      submenus[`${access.menuId}:${sub.subMenuId}`] = permFlags(sub);
    }
  }

  return { menus, submenus };
}

export function clampPermissionsPayload(permissions, ceiling) {
  return (permissions || []).map((menuPerm) => {
    const menuCeiling = ceiling.menus[menuPerm.menuId] ?? EMPTY_PERM;
    const clampedMenu = intersectPerm(menuPerm, menuCeiling);
    const submenus = (menuPerm.submenus || []).map((sub) => {
      const subCeiling =
        ceiling.submenus[`${menuPerm.menuId}:${sub.subMenuId}`] ?? EMPTY_PERM;
      return {
        ...sub,
        ...intersectPerm(sub, subCeiling),
      };
    });

    return {
      ...menuPerm,
      ...clampedMenu,
      submenus,
    };
  });
}
