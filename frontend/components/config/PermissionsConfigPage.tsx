"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfigRole,
  getConfigRoles,
  getRolePermissionMatrix,
  NavMenuItem,
  seedNavMenus,
  updateRolePermissions,
} from "@/lib/apis/configApi";
import { authClient } from "@/lib/auth-client";
import {
  BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES,
  canManageRolePermissions,
} from "@/lib/portfolio-access";
import {
  buildPermissionCeilingFromMenus,
  canGrantPermission,
  clampPermissionState,
  filterMenusForActorCeiling,
  filterPermissionStateToGrantableMenus,
  PermissionFlags,
  shouldShowParentMenuRow,
} from "@/lib/permission-ceiling";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  dashboardCardClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Loader2, RefreshCw, Save, Shield } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import { configCompactSelectClass } from "./config-dialog-styles";

type PermState = {
  canView: boolean;
  canAdd: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type MenuPermState = {
  menu: PermState;
  submenus: Record<string, PermState>;
};

const permCols: { key: keyof PermState; label: string }[] = [
  { key: "canView", label: "View" },
  { key: "canAdd", label: "Add" },
  { key: "canEdit", label: "Edit" },
  { key: "canDelete", label: "Delete" },
];

function matrixToPermissions(menus: NavMenuItem[]) {
  const next: Record<string, MenuPermState> = {};
  menus.forEach((menu) => {
    const items = menu.items || menu.subMenus || [];
    const subMap: Record<string, PermState> = {};
    items.forEach((sm) => {
      subMap[sm.id] = {
        canView: sm.permissions?.canView ?? false,
        canAdd: sm.permissions?.canAdd ?? false,
        canEdit: sm.permissions?.canEdit ?? false,
        canDelete: sm.permissions?.canDelete ?? false,
      };
    });
    next[menu.id] = {
      menu: {
        canView: menu.permissions?.canView ?? false,
        canAdd: menu.permissions?.canAdd ?? false,
        canEdit: menu.permissions?.canEdit ?? false,
        canDelete: menu.permissions?.canDelete ?? false,
      },
      submenus: subMap,
    };
  });
  return next;
}

export default function PermissionsConfigPage() {
  const session = authClient.useSession();
  const currentRole = String(session.data?.user.role ?? "").toLowerCase();
  const isSuperadmin = currentRole === "superadmin";
  const isBranchAdmin = currentRole === "portfolio admin";
  const isBranchManager = currentRole === "portfolio manager";
  const usesPermissionCeiling = isBranchAdmin || isBranchManager;
  const canManagePermissions = isSuperadmin || isBranchAdmin;
  const { data: rolesRes } = useSWR(SWR_CACH_KEYS.configRoles.key, getConfigRoles);
  const { mutate: globalMutate } = useSWRConfig();

  const roles = (rolesRes?.data as ConfigRole[]) ?? [];
  const activeRoles = useMemo(
    () => roles.filter((role) => role.isActive !== false),
    [roles],
  );
  const manageableRoles = useMemo(() => {
    if (isSuperadmin) return activeRoles;
    if (isBranchAdmin) {
      return activeRoles.filter((role) =>
        BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES.includes(
          role.name.toLowerCase() as (typeof BRANCH_ADMIN_MANAGEABLE_ROLE_NAMES)[number],
        ),
      );
    }
    return activeRoles.filter((role) => role.name.toLowerCase() === currentRole);
  }, [activeRoles, currentRole, isSuperadmin, isBranchAdmin]);

  const sessionUser = session.data?.user as
    | { role?: string; roleId?: string | null }
    | undefined;

  const actorRoleId = useMemo(() => {
    if (sessionUser?.roleId) return sessionUser.roleId;
    if (!sessionUser?.role) return "";
    const match = activeRoles.find(
      (role) => role.name.toLowerCase() === sessionUser.role!.toLowerCase(),
    );
    return match?.id ?? "";
  }, [activeRoles, sessionUser?.role, sessionUser?.roleId]);

  const {
    data: actorMatrixRes,
    isLoading: loadingActorPerms,
  } = useSWR(
    usesPermissionCeiling && actorRoleId
      ? ["permissions-matrix", "actor", actorRoleId]
      : null,
    () => getRolePermissionMatrix(actorRoleId),
    { revalidateOnFocus: false },
  );

  const actorCeiling = useMemo(() => {
    if (!usesPermissionCeiling) return null;
    const menus = (actorMatrixRes?.data as NavMenuItem[]) ?? [];
    return buildPermissionCeilingFromMenus(menus);
  }, [actorMatrixRes?.data, usesPermissionCeiling]);

  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [permissions, setPermissions] = useState<Record<string, MenuPermState>>({});
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const {
    data: matrixRes,
    isLoading: loadingPerms,
    mutate: mutateMatrix,
  } = useSWR(
    selectedRoleId ? ["permissions-matrix", selectedRoleId] : null,
    () => getRolePermissionMatrix(selectedRoleId),
    { revalidateOnFocus: false },
  );

  const allMenus = useMemo(
    () => (matrixRes?.data as NavMenuItem[]) ?? [],
    [matrixRes?.data],
  );

  const visibleMenus = useMemo(() => {
    if (!actorCeiling) return allMenus;
    return filterMenusForActorCeiling(allMenus, actorCeiling);
  }, [allMenus, actorCeiling]);

  const selectedRole = manageableRoles.find((role) => role.id === selectedRoleId);
  const canEditSelectedRole = Boolean(
    selectedRole && canManageRolePermissions(currentRole, selectedRole.name),
  );

  useEffect(() => {
    if (!manageableRoles.length) return;
    const isCurrentValid = manageableRoles.some((role) => role.id === selectedRoleId);
    if (!selectedRoleId || !isCurrentValid) {
      const preferred = isSuperadmin
        ? manageableRoles.find((role) => role.name.toLowerCase() === "superadmin") ??
          manageableRoles[0]
        : manageableRoles[0];
      setSelectedRoleId(preferred.id);
    }
  }, [manageableRoles, selectedRoleId, isSuperadmin]);

  useEffect(() => {
    if (!allMenus.length) {
      setPermissions({});
      return;
    }
    const next = matrixToPermissions(allMenus);
    if (actorCeiling) {
      setPermissions(clampPermissionState(next, actorCeiling));
      return;
    }
    setPermissions(next);
  }, [allMenus, actorCeiling]);

  function getGrantablePerm(
    menuId: string,
    field: keyof PermState,
    subMenuId?: string,
  ): PermissionFlags | undefined {
    if (isSuperadmin) {
      return {
        canView: true,
        canAdd: true,
        canEdit: true,
        canDelete: true,
      };
    }
    if (!actorCeiling) return undefined;
    if (subMenuId) {
      return actorCeiling[menuId]?.submenus[subMenuId];
    }
    return actorCeiling[menuId]?.menu;
  }

  function canToggle(
    menuId: string,
    field: keyof PermState,
    subMenuId?: string,
  ) {
    if (!canEditSelectedRole) return false;
    return canGrantPermission(getGrantablePerm(menuId, field, subMenuId), field);
  }

  async function handleRefresh(options?: { silent?: boolean }) {
    setRefreshing(true);
    try {
      await seedNavMenus();
      await mutateMatrix();
      await globalMutate(SWR_CACH_KEYS.navMenus.key);
      window.dispatchEvent(new CustomEvent("sidebar-menu-updated"));
      if (!options?.silent) {
        toast.success("Menus refreshed from database");
      }
    } catch {
      if (!options?.silent) {
        toast.error("Failed to refresh menus");
      }
    } finally {
      setRefreshing(false);
    }
  }

  function toggle(menuId: string, field: keyof PermState, subMenuId?: string) {
    if (!canToggle(menuId, field, subMenuId)) return;

    setPermissions((prev) => {
      const copy = { ...prev };
      if (!copy[menuId]) return prev;

      if (subMenuId) {
        const sub = { ...copy[menuId].submenus[subMenuId] };
        const nextVal = !sub[field];
        sub[field] = nextVal;
        if (field === "canView" && !nextVal) {
          sub.canAdd = sub.canEdit = sub.canDelete = false;
        }
        const menu = { ...copy[menuId].menu };
        if (nextVal && !menu.canView) {
          menu.canView = true;
        }
        copy[menuId] = {
          ...copy[menuId],
          menu,
          submenus: { ...copy[menuId].submenus, [subMenuId]: sub },
        };
      } else {
        const menu = { ...copy[menuId].menu };
        const nextVal = !menu[field];
        menu[field] = nextVal;

        const updatedSubmenus = { ...copy[menuId].submenus };

        if (field === "canView") {
          if (nextVal) {
            // Turning View ON on the module makes the module and all submenus full
            if (canToggle(menuId, "canAdd")) menu.canAdd = true;
            if (canToggle(menuId, "canEdit")) menu.canEdit = true;
            if (canToggle(menuId, "canDelete")) menu.canDelete = true;

            for (const sId of Object.keys(updatedSubmenus)) {
              const sCopy = { ...updatedSubmenus[sId] };
              if (canToggle(menuId, "canView", sId)) sCopy.canView = true;
              if (canToggle(menuId, "canAdd", sId)) sCopy.canAdd = true;
              if (canToggle(menuId, "canEdit", sId)) sCopy.canEdit = true;
              if (canToggle(menuId, "canDelete", sId)) sCopy.canDelete = true;
              updatedSubmenus[sId] = sCopy;
            }
          } else {
            // Turning View OFF unchecks all permissions for parent and submenus
            menu.canAdd = menu.canEdit = menu.canDelete = false;
            for (const sId of Object.keys(updatedSubmenus)) {
              updatedSubmenus[sId] = {
                canView: false,
                canAdd: false,
                canEdit: false,
                canDelete: false,
              };
            }
          }
        } else {
          // For other fields (canAdd, canEdit, canDelete) on parent module
          if (nextVal && !menu.canView) {
            menu.canView = true;
          }
          for (const sId of Object.keys(updatedSubmenus)) {
            const sCopy = { ...updatedSubmenus[sId] };
            if (canToggle(menuId, field, sId)) {
              sCopy[field] = nextVal;
              if (nextVal && !sCopy.canView) {
                sCopy.canView = true;
              }
            }
            updatedSubmenus[sId] = sCopy;
          }
        }

        copy[menuId] = {
          ...copy[menuId],
          menu,
          submenus: updatedSubmenus,
        };
      }
      return copy;
    });
  }

  async function handleSave() {
    if (!selectedRoleId) return;
    setSaving(true);
    try {
      const payloadSource = actorCeiling
        ? filterPermissionStateToGrantableMenus(
            clampPermissionState(permissions, actorCeiling),
            actorCeiling,
          )
        : permissions;

      const payload = Object.entries(payloadSource).map(([menuId, perm]) => ({
        menuId,
        ...perm.menu,
        submenus: Object.entries(perm.submenus).map(([subMenuId, sub]) => ({
          subMenuId,
          ...sub,
        })),
      }));

      const result = await updateRolePermissions(selectedRoleId, payload);
      if (result.success) {
        toast.success("Permissions saved");
        await mutateMatrix();
        await globalMutate(SWR_CACH_KEYS.navMenus.key);
        window.dispatchEvent(
          new CustomEvent("sidebar-menu-updated", {
            detail: { roleId: selectedRoleId },
          }),
        );
      } else {
        toast.error(result.errors?.message ?? "Failed to save permissions");
      }
    } finally {
      setSaving(false);
    }
  }

  const isLoading =
    loadingPerms || refreshing || (usesPermissionCeiling && loadingActorPerms);

  return (
    <ManagementPageShell title="Permissions">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-50 px-6 py-3">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Shield className="size-4 text-primary" />
            <span>
              Managing permissions for{" "}
              <span className="font-semibold text-zinc-800">
                {selectedRole?.name ?? "—"}
              </span>
            </span>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={isLoading || !isSuperadmin}
            className="h-9"
            title="Refresh menus from database"
          >
            {refreshing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="space-y-1">
              <label className="sr-only">Role</label>
              <select
                className={cn(configCompactSelectClass, "w-44")}
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
                disabled={isLoading || !canManagePermissions}
              >
                {manageableRoles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              onClick={handleSave}
              disabled={saving || isLoading || !selectedRoleId || !canEditSelectedRole}
              className="h-9"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <Save className="size-4" /> Save Permissions
                </>
              )}
            </Button>
          </div>
        </div>
        {!canManagePermissions && (
          <div className="border-b border-zinc-100 bg-amber-50 px-6 py-2 text-xs text-amber-700">
            You do not have permission to update role permissions.
          </div>
        )}
        {(isBranchAdmin || isBranchManager) && (
          <div className="border-b border-zinc-100 bg-sky-50 px-6 py-2 text-xs text-sky-700">
            {isBranchAdmin
              ? "Portfolio admin can manage admin, employee, and manager roles only, and only sees menus you have permission for."
              : "You only see menus you have permission for."}
          </div>
        )}

        <div className={dashboardTableWrapClass}>
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 px-6 py-10 text-zinc-500">
              <Loader2 className="size-4 animate-spin" />
              Loading permissions from database...
            </div>
          ) : (
            <Table>
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={dashboardTableHeadClass}>Menu</TableHead>
                  {permCols.map((col) => (
                    <TableHead key={col.key} className={dashboardTableHeadClass}>
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleMenus.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      {matrixRes?.success === false
                        ? "Could not load menus — check backend connection and click Refresh"
                        : actorCeiling
                          ? "No menus available for your permission level"
                          : "No menus in database — click Refresh to sync sidebar menus"}
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleMenus.map((menu) => {
                    const perm = permissions[menu.id];
                    const items = menu.items || menu.subMenus || [];
                    const showParent = shouldShowParentMenuRow(menu.id, actorCeiling);
                    return (
                      <Fragment key={menu.id}>
                        {showParent ? (
                        <TableRow className={dashboardTableBodyRowClass}>
                          <TableCell className={dashboardTableCellClass}>
                            <span className={dashboardTextPrimary}>{menu.title}</span>
                            <span className={cn(dashboardTextSecondary, "ml-2 text-xs")}>
                              {menu.url}
                            </span>
                          </TableCell>
                          {permCols.map((col) => (
                            <TableCell key={col.key} className={dashboardTableCellClass}>
                              <input
                                type="checkbox"
                                className="size-4 rounded border-zinc-300 accent-primary"
                                checked={perm?.menu[col.key] ?? false}
                                disabled={!canToggle(menu.id, col.key)}
                                onChange={() => toggle(menu.id, col.key)}
                              />
                            </TableCell>
                          ))}
                        </TableRow>
                        ) : null}
                        {items.map((sub) => (
                          <TableRow key={sub.id} className={dashboardTableBodyRowClass}>
                            <TableCell className={dashboardTableCellClass}>
                              <span className="pl-4 text-sm text-zinc-700">
                                {sub.title}
                              </span>
                            </TableCell>
                            {permCols.map((col) => (
                              <TableCell key={col.key} className={dashboardTableCellClass}>
                                <input
                                  type="checkbox"
                                  className="size-4 rounded border-zinc-300 accent-primary"
                                  checked={perm?.submenus[sub.id]?.[col.key] ?? false}
                                  disabled={!canToggle(menu.id, col.key, sub.id)}
                                  onChange={() => toggle(menu.id, col.key, sub.id)}
                                />
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </ManagementPageShell>
  );
}
