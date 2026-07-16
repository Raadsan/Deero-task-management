"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  createNavMenu,
  createNavSubMenu,
  deleteNavMenu,
  deleteNavSubMenu,
  getAllNavMenus,
  NavMenuItem,
  NavSubMenuItem,
  seedNavMenus,
  updateNavMenu,
  updateNavSubMenu,
} from "@/lib/actions/config.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { getLucideIcon } from "@/lib/lucide-icons";
import { cn } from "@/lib/utils";
import { Edit, Eye, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import ConfigInfoField from "./ConfigInfoField";
import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  preventConfigDialogClose,
} from "./config-dialog-styles";

type FormMode = "create-menu" | "create-sub" | "edit-menu" | "edit-sub";
type StatusFilter = "all" | "active" | "inactive";
type SubMenuFilter = "all" | "with" | "without";

type ViewRecord = {
  kind: "menu" | "sub";
  id: string;
  title: string;
  url: string;
  icon?: string | null;
  order: number;
  isActive: boolean;
  parentTitle?: string;
};

type MenuGroup = {
  menu: NavMenuItem;
  visibleSubs: NavSubMenuItem[];
  showMenuRow: boolean;
};

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        dashboardStatusBadgeClass,
        active ? getTaskStatusBadgeClass("completed") : getTaskStatusBadgeClass("overdue"),
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function matchesStatus(isActive: boolean, filter: StatusFilter) {
  if (filter === "all") return true;
  return filter === "active" ? isActive : !isActive;
}

function matchesSearch(text: string, query: string) {
  return !query || text.toLowerCase().includes(query);
}

function ActionButtons({
  onView,
  onEdit,
  onDelete,
}: {
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex justify-end gap-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={actionBtnView}
        onClick={onView}
        title="View"
      >
        <Eye className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={actionBtnEdit}
        onClick={onEdit}
        title="Edit"
      >
        <Edit className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={actionBtnDelete}
        onClick={onDelete}
        title="Delete"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

export default function MenusConfigPage() {
  const { data, isLoading } = useSWR(SWR_CACH_KEYS.navMenus.key, getAllNavMenus);
  const { mutate } = useSWRConfig();
  const menus = (data?.data as NavMenuItem[]) ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [subMenuFilter, setSubMenuFilter] = useState<SubMenuFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>("create-menu");
  const [viewRecord, setViewRecord] = useState<ViewRecord | null>(null);
  const [editingId, setEditingId] = useState("");
  const [parentMenuId, setParentMenuId] = useState("");
  const [parentMenuTitle, setParentMenuTitle] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [icon, setIcon] = useState("LayoutDashboard");
  const [order, setOrder] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
    type: "menu" | "sub";
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const autoSeedAttempted = useRef(false);

  const isSubForm = formMode === "create-sub" || formMode === "edit-sub";
  const IconPreview = getLucideIcon(icon);

  const filteredGroups = useMemo(() => {
    const query = search.trim().toLowerCase();

    return menus
      .map((menu): MenuGroup | null => {
        const items = menu.items || menu.subMenus || [];
        const hasSubs = items.length > 0;

        if (subMenuFilter === "with" && !hasSubs) return null;
        if (subMenuFilter === "without" && hasSubs) return null;

        const menuActive = menu.isActive !== false;
        const menuMatchesQuery =
          !query ||
          matchesSearch(menu.title, query) ||
          matchesSearch(menu.url, query) ||
          (menu.icon ? matchesSearch(menu.icon, query) : false);

        const menuMatchesStatus = matchesStatus(menuActive, statusFilter);
        const visibleSubs = items.filter((sub) => {
          const subActive = sub.isActive !== false;
          const subMatchesQuery =
            !query ||
            matchesSearch(sub.title, query) ||
            matchesSearch(sub.url, query);
          return matchesStatus(subActive, statusFilter) && subMatchesQuery;
        });

        const showMenuRow =
          (menuMatchesStatus && menuMatchesQuery) ||
          (visibleSubs.length > 0 && (!query || menuMatchesQuery));

        if (!showMenuRow && visibleSubs.length === 0) return null;

        return { menu, visibleSubs, showMenuRow };
      })
      .filter((group): group is MenuGroup => group !== null);
  }, [menus, search, statusFilter, subMenuFilter]);

  const flatRows = useMemo(() => {
    const rows: Array<
      | { type: "menu"; menu: NavMenuItem }
      | { type: "sub"; menu: NavMenuItem; sub: NavSubMenuItem }
    > = [];

    for (const group of filteredGroups) {
      if (group.showMenuRow) {
        rows.push({ type: "menu", menu: group.menu });
      }
      for (const sub of group.visibleSubs) {
        rows.push({ type: "sub", menu: group.menu, sub });
      }
    }

    return rows;
  }, [filteredGroups]);

  const totalPages = Math.ceil(flatRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return flatRows.slice(start, start + pageSize);
  }, [flatRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, subMenuFilter, pageSize]);

  useEffect(() => {
    if (isLoading || autoSeedAttempted.current || menus.length > 0) return;
    autoSeedAttempted.current = true;
    void handleSeed({ silent: true });
  }, [isLoading, menus.length]);

  async function refreshMenus() {
    await mutate(SWR_CACH_KEYS.navMenus.key);
    window.dispatchEvent(new CustomEvent("sidebar-menu-updated"));
  }

  async function handleSeed(options?: { silent?: boolean }) {
    setSeeding(true);
    try {
      const result = await seedNavMenus();
      if (result.success) {
        if (!options?.silent) toast.success("Default menus synced");
        await refreshMenus();
      } else if (!options?.silent) {
        toast.error(result.errors?.message ?? "Sync failed");
      }
    } finally {
      setSeeding(false);
    }
  }

  function closeForm() {
    if (isSaving) return;
    setFormOpen(false);
  }

  function closeView() {
    setViewOpen(false);
  }

  function openAddMenu() {
    setFormMode("create-menu");
    setEditingId("");
    setParentMenuId("");
    setParentMenuTitle("");
    setTitle("");
    setUrl("");
    setIcon("LayoutDashboard");
    setOrder(menus.length + 1);
    setIsActive(true);
    setFormOpen(true);
  }

  function openViewMenu(menu: NavMenuItem) {
    setViewRecord({
      kind: "menu",
      id: menu.id,
      title: menu.title,
      url: menu.url,
      icon: menu.icon,
      order: menu.order,
      isActive: menu.isActive !== false,
    });
    setViewOpen(true);
  }

  function openViewSub(sub: NavSubMenuItem, parentTitle: string) {
    setViewRecord({
      kind: "sub",
      id: sub.id,
      title: sub.title,
      url: sub.url,
      order: sub.order,
      isActive: sub.isActive !== false,
      parentTitle,
    });
    setViewOpen(true);
  }

  function openEditMenu(menu: NavMenuItem) {
    setFormMode("edit-menu");
    setEditingId(menu.id);
    setParentMenuId("");
    setParentMenuTitle("");
    setTitle(menu.title);
    setUrl(menu.url);
    setIcon(menu.icon || "LayoutDashboard");
    setOrder(menu.order);
    setIsActive(menu.isActive !== false);
    setFormOpen(true);
  }

  function openEditSub(sub: NavSubMenuItem, menu: NavMenuItem) {
    setFormMode("edit-sub");
    setEditingId(sub.id);
    setParentMenuId(menu.id);
    setParentMenuTitle(menu.title);
    setTitle(sub.title);
    setUrl(sub.url);
    setOrder(sub.order);
    setIsActive(sub.isActive !== false);
    setFormOpen(true);
  }

  function openAddSub(menu: NavMenuItem) {
    setFormMode("create-sub");
    setEditingId("");
    setParentMenuId(menu.id);
    setParentMenuTitle(menu.title);
    setTitle("");
    setUrl("");
    setOrder((menu.items?.length ?? menu.subMenus?.length ?? 0) + 1);
    setIsActive(true);
    setFormOpen(true);
  }

  async function saveForm() {
    if (!title.trim() || !url.trim()) {
      toast.error("Title and URL are required");
      return;
    }

    setIsSaving(true);
    try {
      let result;

      if (formMode === "create-menu") {
        result = await createNavMenu({
          title: title.trim(),
          url: url.trim(),
          icon,
          order,
        });
      } else if (formMode === "edit-menu") {
        result = await updateNavMenu(editingId, {
          title: title.trim(),
          url: url.trim(),
          icon,
          order,
          isActive,
        });
      } else if (formMode === "create-sub") {
        result = await createNavSubMenu({
          menuId: parentMenuId,
          title: title.trim(),
          url: url.trim(),
          order,
        });
      } else {
        result = await updateNavSubMenu(editingId, {
          title: title.trim(),
          url: url.trim(),
          order,
          isActive,
        });
      }

      if (result.success) {
        toast.success(
          formMode.startsWith("edit") ? "Menu updated" : "Menu created",
        );
        await refreshMenus();
        setFormOpen(false);
      } else {
        toast.error(result.errors?.message ?? "Save failed");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMenu(id: string) {
    setIsDeleting(true);
    const result = await deleteNavMenu(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Menu deleted");
      setDeleteTarget(null);
      await refreshMenus();
    }
  }

  async function handleDeleteSub(id: string) {
    setIsDeleting(true);
    const result = await deleteNavSubMenu(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Sub-menu deleted");
      setDeleteTarget(null);
      await refreshMenus();
    }
  }

  const formTitle =
    formMode === "create-menu"
      ? "Add Menu"
      : formMode === "create-sub"
        ? "Add Sub-menu"
        : formMode === "edit-menu"
          ? "Edit Menu"
          : "Edit Sub-menu";

  const formDescription =
    formMode === "create-menu"
      ? "Create a new sidebar menu item."
      : formMode === "create-sub"
        ? `Add a sub-menu under ${parentMenuTitle || "parent menu"}.`
        : formMode === "edit-menu"
          ? "Update menu details, order, and status."
          : "Update sub-menu details, order, and status.";

  return (
    <ManagementPageShell title="Sidebar Menus">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-6 py-3">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("w-16", configCompactSelectClass)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <select
            value={subMenuFilter}
            onChange={(e) => setSubMenuFilter(e.target.value as SubMenuFilter)}
            className={cn(configCompactSelectClass, "w-40")}
          >
            <option value="all">All menus</option>
            <option value="with">With sub-menus</option>
            <option value="without">Without sub-menus</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(configCompactSelectClass, "w-36")}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search menus..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(configCompactInputClass, "pl-9")}
            />
          </div>

          <Button variant="outline" onClick={() => handleSeed()} disabled={seeding} className="h-9">
            {seeding ? <Loader2 className="size-4 animate-spin" /> : null}
            Sync
          </Button>
          <Button onClick={openAddMenu} className={cn(btnCreatePage, "h-9 px-4 text-sm")}>
            <Plus className="size-4" /> Add Menu
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Order</TableHead>
                <TableHead className={dashboardTableHeadClass}>Title</TableHead>
                <TableHead className={dashboardTableHeadClass}>URL</TableHead>
                <TableHead className={dashboardTableHeadClass}>Icon</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading || seeding ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      {seeding ? "Syncing sidebar menus..." : "Loading..."}
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginatedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No menus match your filters
                  </TableCell>
                </TableRow>
              ) : (
                paginatedRows.map((row) => {
                  if (row.type === "menu") {
                    const menu = row.menu;
                    const MenuIcon = getLucideIcon(menu.icon);
                    const menuActive = menu.isActive !== false;

                    return (
                      <TableRow key={menu.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>{menu.order}</TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <MenuIcon className="size-4" />
                            <span className={dashboardTextPrimary}>{menu.title}</span>
                          </div>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{menu.url}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          {menu.icon || "—"}
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <StatusBadge active={menuActive} />
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <ActionButtons
                            onView={() => openViewMenu(menu)}
                            onEdit={() => openEditMenu(menu)}
                            onDelete={() =>
                              setDeleteTarget({
                                id: menu.id,
                                name: menu.title,
                                type: "menu",
                              })
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  }

                  const { menu, sub } = row;
                  const subActive = sub.isActive !== false;

                  return (
                    <TableRow key={sub.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>{sub.order}</TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="pl-6 text-sm text-zinc-700">{sub.title}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>{sub.url}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>—</TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <StatusBadge active={subActive} />
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <ActionButtons
                          onView={() => openViewSub(sub, menu.title)}
                          onEdit={() => openEditSub(sub, menu)}
                          onDelete={() =>
                            setDeleteTarget({
                              id: sub.id,
                              name: sub.title,
                              type: "sub",
                            })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {flatRows.length === 0
              ? "0 of 0"
              : `${Math.min(flatRows.length, (currentPage - 1) * pageSize + 1)}-${Math.min(flatRows.length, currentPage * pageSize)} of ${flatRows.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 hover:bg-zinc-50 disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 hover:bg-zinc-50 disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          if (!open) closeView();
          else setViewOpen(true);
        }}
      >
        <DialogContent
          className={configDialogShellClass}
          onInteractOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>
              {viewRecord?.kind === "sub" ? "Sub-menu Details" : "Menu Details"}
            </DialogTitle>
            <DialogDescription>Sidebar menu information</DialogDescription>
          </DialogHeader>
          {viewRecord ? (
            <div className={cn(configDialogBodyClass, "space-y-3")}>
              {viewRecord.parentTitle ? (
                <ConfigInfoField label="Parent menu" value={viewRecord.parentTitle} />
              ) : null}
              <ConfigInfoField label="Title" value={viewRecord.title} />
              <ConfigInfoField label="URL" value={viewRecord.url} />
              {viewRecord.kind === "menu" ? (
                <ConfigInfoField
                  label="Icon"
                  value={
                    viewRecord.icon ? (
                      <span className="flex items-center gap-2">
                        {(() => {
                          const VIcon = getLucideIcon(viewRecord.icon);
                          return <VIcon className="size-4" />;
                        })()}
                        {viewRecord.icon}
                      </span>
                    ) : (
                      "—"
                    )
                  }
                />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfigInfoField label="Order" value={viewRecord.order} />
                <ConfigInfoField
                  label="Status"
                  value={<StatusBadge active={viewRecord.isActive} />}
                />
              </div>
            </div>
          ) : null}
          <div className={configDialogFooterClass}>
            <Button type="button" onClick={closeView}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={formOpen}
        onOpenChange={(open) => {
          if (!open) closeForm();
          else setFormOpen(true);
        }}
      >
        <DialogContent
          className={configDialogShellClass}
          onInteractOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>{formTitle}</DialogTitle>
            <DialogDescription>{formDescription}</DialogDescription>
          </DialogHeader>
          <div className={configDialogBodyClass}>
            {isSubForm && parentMenuTitle ? (
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                Parent: <span className="font-medium text-zinc-800">{parentMenuTitle}</span>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Title</label>
              <input
                className={configCompactInputClass}
                placeholder="Menu title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">URL</label>
              <input
                className={configCompactInputClass}
                placeholder="e.g. /staff"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </div>
            {!isSubForm ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Icon</label>
                <input
                  className={configCompactInputClass}
                  placeholder="Lucide icon name"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                />
                <div className="flex items-center gap-2 text-sm text-zinc-500">
                  <IconPreview className="size-4" /> Preview
                </div>
              </div>
            ) : null}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Order</label>
              <input
                className={configCompactInputClass}
                type="number"
                placeholder="Order"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
            </div>
            {formMode.startsWith("edit") ? (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">Status</label>
                <select
                  className={configCompactSelectClass}
                  value={isActive ? "active" : "inactive"}
                  onChange={(e) => setIsActive(e.target.value === "active")}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            ) : null}
            {formMode === "edit-menu" ? (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const menu = menus.find((item) => item.id === editingId);
                  if (!menu) return;
                  setFormOpen(false);
                  openAddSub(menu);
                }}
              >
                <Plus className="size-4" /> Add Sub-menu
              </Button>
            ) : null}
          </div>
          <div className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={saveForm} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : formMode.startsWith("create") ? (
                "Add"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget?.type === "sub" ? "Delete sub-menu" : "Delete menu"}
        description={
          deleteTarget?.type === "sub"
            ? "Are you sure you want to delete this sub-menu? This action cannot be undone."
            : "Delete this menu and all its sub-menus? This action cannot be undone."
        }
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (!deleteTarget) return;
          if (deleteTarget.type === "sub") {
            await handleDeleteSub(deleteTarget.id);
            return;
          }
          await handleDeleteMenu(deleteTarget.id);
        }}
      >
        {deleteTarget ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p>
              <span className="font-medium text-zinc-800">
                {deleteTarget.type === "sub" ? "Sub-menu" : "Menu"}:
              </span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
