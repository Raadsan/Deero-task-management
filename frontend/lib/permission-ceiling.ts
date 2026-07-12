export type PermissionFlags = {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type MenuPermissionState = {
  menu: PermissionFlags;
  submenus: Record<string, PermissionFlags>;
};

const EMPTY_PERM: PermissionFlags = {
  canView: false,
  canAdd: false,
  canEdit: false,
  canDelete: false,
};

export function intersectPermissionFlags(
  requested: PermissionFlags,
  ceiling: PermissionFlags,
): PermissionFlags {
  return {
    canView: requested.canView && ceiling.canView,
    canAdd: requested.canAdd && ceiling.canAdd,
    canEdit: requested.canEdit && ceiling.canEdit,
    canDelete: requested.canDelete && ceiling.canDelete,
  };
}

export function buildPermissionCeilingFromMenus(
  menus: Array<{
    id: string;
    permissions?: Partial<PermissionFlags>;
    items?: Array<{ id: string; permissions?: Partial<PermissionFlags> }>;
    subMenus?: Array<{ id: string; permissions?: Partial<PermissionFlags> }>;
  }>,
): Record<string, MenuPermissionState> {
  const ceiling: Record<string, MenuPermissionState> = {};

  menus.forEach((menu) => {
    const items = menu.items || menu.subMenus || [];
    const submenus: Record<string, PermissionFlags> = {};

    items.forEach((sub) => {
      submenus[sub.id] = {
        canView: Boolean(sub.permissions?.canView),
        canAdd: Boolean(sub.permissions?.canAdd),
        canEdit: Boolean(sub.permissions?.canEdit),
        canDelete: Boolean(sub.permissions?.canDelete),
      };
    });

    ceiling[menu.id] = {
      menu: {
        canView: Boolean(menu.permissions?.canView),
        canAdd: Boolean(menu.permissions?.canAdd),
        canEdit: Boolean(menu.permissions?.canEdit),
        canDelete: Boolean(menu.permissions?.canDelete),
      },
      submenus,
    };
  });

  return ceiling;
}

export function clampPermissionState(
  state: Record<string, MenuPermissionState>,
  ceiling: Record<string, MenuPermissionState>,
): Record<string, MenuPermissionState> {
  const next: Record<string, MenuPermissionState> = {};

  Object.entries(state).forEach(([menuId, perm]) => {
    const menuCeiling = ceiling[menuId]?.menu ?? EMPTY_PERM;
    const submenus: Record<string, PermissionFlags> = {};

    Object.entries(perm.submenus).forEach(([subMenuId, sub]) => {
      const subCeiling = ceiling[menuId]?.submenus[subMenuId] ?? EMPTY_PERM;
      submenus[subMenuId] = intersectPermissionFlags(sub, subCeiling);
    });

    next[menuId] = {
      menu: intersectPermissionFlags(perm.menu, menuCeiling),
      submenus,
    };
  });

  return next;
}

export function canGrantPermission(
  ceiling: PermissionFlags | undefined,
  field: keyof PermissionFlags,
) {
  return Boolean(ceiling?.[field]);
}

export function hasAnyPermission(flags?: Partial<PermissionFlags>) {
  if (!flags) return false;
  return Boolean(
    flags.canView || flags.canAdd || flags.canEdit || flags.canDelete,
  );
}

export function filterMenusForActorCeiling<
  T extends {
    id: string;
    items?: Array<{ id: string }>;
    subMenus?: Array<{ id: string }>;
  },
>(
  menus: T[],
  ceiling: Record<string, MenuPermissionState>,
): T[] {
  return menus
    .map((menu) => {
      const items = menu.items || menu.subMenus || [];
      const menuCeiling = ceiling[menu.id]?.menu;

      if (!items.length) {
        return hasAnyPermission(menuCeiling) ? menu : null;
      }

      const visibleItems = items.filter((sub) =>
        hasAnyPermission(ceiling[menu.id]?.submenus[sub.id]),
      );

      if (!hasAnyPermission(menuCeiling) && !visibleItems.length) {
        return null;
      }

      return {
        ...menu,
        items: visibleItems,
        subMenus: visibleItems,
      };
    })
    .filter((menu): menu is T => menu !== null);
}

export function getGrantableMenuIds(
  ceiling: Record<string, MenuPermissionState>,
): Set<string> {
  return new Set(
    Object.entries(ceiling)
      .filter(([menuId, entry]) => {
        if (hasAnyPermission(entry.menu)) return true;
        return Object.values(entry.submenus).some((sub) => hasAnyPermission(sub));
      })
      .map(([menuId]) => menuId),
  );
}

export function filterPermissionStateToGrantableMenus(
  state: Record<string, MenuPermissionState>,
  ceiling: Record<string, MenuPermissionState>,
): Record<string, MenuPermissionState> {
  const grantableMenuIds = getGrantableMenuIds(ceiling);
  const next: Record<string, MenuPermissionState> = {};

  grantableMenuIds.forEach((menuId) => {
    if (!state[menuId]) return;
    const menuCeiling = ceiling[menuId];
    const submenus: Record<string, PermissionFlags> = {};

    Object.entries(state[menuId].submenus).forEach(([subMenuId, sub]) => {
      if (hasAnyPermission(menuCeiling?.submenus[subMenuId])) {
        submenus[subMenuId] = sub;
      }
    });

    next[menuId] = {
      menu: state[menuId].menu,
      submenus,
    };
  });

  return next;
}

export function shouldShowParentMenuRow(
  menuId: string,
  ceiling: Record<string, MenuPermissionState> | null,
) {
  if (!ceiling) return true;
  return hasAnyPermission(ceiling[menuId]?.menu);
}
