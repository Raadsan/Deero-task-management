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
  ConfigRole,
  createConfigRole,
  deleteConfigRole,
  getConfigRoles,
  updateConfigRole,
} from "@/lib/apis/configApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
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
import { cn } from "@/lib/utils";
import { Edit, Eye, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import ConfigInfoField from "@/components/config/ConfigInfoField";
import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  configTextareaClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";

type StatusFilter = "all" | "active" | "inactive";

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

export default function RolesConfigRoute() {
  const { data, isLoading } = useSWR(SWR_CACH_KEYS.configRoles.key, getConfigRoles);
  const { mutate } = useSWRConfig();
  const roles = (data?.data as ConfigRole[]) ?? [];

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRole, setViewRole] = useState<ConfigRole | null>(null);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<ConfigRole | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [canViewSalary, setCanViewSalary] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filteredRoles = useMemo(() => {
    const query = search.trim().toLowerCase();
    return roles.filter((role) => {
      const active = role.isActive !== false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!query) return true;
      return (
        role.name.toLowerCase().includes(query) ||
        (role.description ?? "").toLowerCase().includes(query)
      );
    });
  }, [roles, search, statusFilter]);

  function closeForm() {
    if (isSaving) return;
    setFormOpen(false);
  }

  function closeView() {
    setViewOpen(false);
  }

  function openCreate() {
    setMode("create");
    setSelected(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setCanViewSalary(false);
    setFormOpen(true);
  }

  function openView(role: ConfigRole) {
    setViewRole(role);
    setViewOpen(true);
  }

  function openEdit(role: ConfigRole) {
    setMode("edit");
    setSelected(role);
    setName(role.name);
    setDescription(role.description ?? "");
    setIsActive(role.isActive !== false);
    setCanViewSalary(role.canViewSalary === true);
    setFormOpen(true);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Role name is required");
      return;
    }
    setIsSaving(true);
    try {
      const result =
        mode === "create"
          ? await createConfigRole({
              name: name.trim(),
              description: description.trim(),
              isActive,
              canViewSalary,
            })
          : await updateConfigRole(selected!.id, {
              name: name.trim(),
              description: description.trim(),
              isActive,
              canViewSalary,
            });
      if (result.success) {
        toast.success(mode === "create" ? "Role created" : "Role updated");
        await mutate(SWR_CACH_KEYS.configRoles.key);
        setFormOpen(false);
      } else {
        toast.error(result.errors?.message ?? "Failed to save role");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setIsDeleting(true);
    const result = await deleteConfigRole(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Role deleted");
      setDeleteTarget(null);
      await mutate(SWR_CACH_KEYS.configRoles.key);
    } else {
      toast.error(result.errors?.message ?? "Failed to delete role");
    }
  }

  return (
    <ManagementPageShell title="Roles">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-50 px-6 py-3">
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-sm text-zinc-500">
            Showing{" "}
            <span className="font-semibold text-zinc-800">{filteredRoles.length}</span> of{" "}
            {roles.length}
          </span>
          <div className="group relative ml-auto w-48 min-w-[12rem]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search roles..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(configCompactInputClass, "pl-9")}
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn(configCompactSelectClass, "w-36")}
          >
            <option value="all">All status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <Button onClick={openCreate} className={cn(btnCreatePage, "h-9 px-4 text-sm")}>
            <Plus className="size-4" /> Add Role
          </Button>
        </div>
        <div className={dashboardTableWrapClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Name</TableHead>
                <TableHead className={dashboardTableHeadClass}>Description</TableHead>
                <TableHead className={dashboardTableHeadClass}>Users</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRoles.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="px-6 py-10 text-center text-muted-foreground">
                    No roles match your filters
                  </TableCell>
                </TableRow>
              ) : (
                filteredRoles.map((role) => (
                  <TableRow key={role.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTextPrimary}>{role.name}</span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTextSecondary}>
                        {role.description || "N/A"}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      {role._count?.users ?? 0}
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <StatusBadge active={role.isActive !== false} />
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={actionBtnView}
                          onClick={() => openView(role)}
                          title="View"
                        >
                          <Eye className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={actionBtnEdit}
                          onClick={() => openEdit(role)}
                          title="Edit"
                        >
                          <Edit className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={actionBtnDelete}
                          onClick={() =>
                            setDeleteTarget({ id: role.id, name: role.name })
                          }
                          title="Delete"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
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
            <DialogTitle>Role Details</DialogTitle>
            <DialogDescription>View role information and assigned users.</DialogDescription>
          </DialogHeader>
          {viewRole ? (
            <div className={configDialogBodyClass}>
              <ConfigInfoField label="Role ID" value={viewRole.id} />
              <ConfigInfoField label="Name" value={viewRole.name} />
              <ConfigInfoField
                label="Description"
                value={viewRole.description || "N/A"}
                className="sm:col-span-2"
              />
              <ConfigInfoField
                label="Assigned Users"
                value={viewRole._count?.users ?? 0}
              />
              <ConfigInfoField
                label="Status"
                value={<StatusBadge active={viewRole.isActive !== false} />}
              />
              <ConfigInfoField
                label="Salary access"
                value={viewRole.canViewSalary ? "Can view salary" : "Hidden"}
              />
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
            <DialogTitle>{mode === "create" ? "Create Role" : "Edit Role"}</DialogTitle>
            <DialogDescription>
              {mode === "create"
                ? "Add a new role for permissions and sidebar access."
                : "Update role name and description."}
            </DialogDescription>
          </DialogHeader>
          <div className={configDialogBodyClass}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Role name</label>
              <input
                className={configCompactInputClass}
                placeholder="e.g. Manager"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Description</label>
              <textarea
                className={configTextareaClass}
                placeholder="What can this role do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
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
            <label className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-3">
              <span>
                <span className="block text-sm font-medium text-zinc-700">View staff salary</span>
                <span className="block text-xs text-zinc-400">Allow this role to see salary fields and values.</span>
              </span>
              <input
                type="checkbox"
                checked={canViewSalary}
                onChange={(event) => setCanViewSalary(event.target.checked)}
                className="size-4 accent-primary"
              />
            </label>
          </div>
          <div className={configDialogFooterClass}>
            <Button type="button" variant="outline" onClick={closeForm} disabled={isSaving}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "create" ? (
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
        title="Delete role"
        description="Are you sure you want to delete this role? This action cannot be undone."
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={async () => {
          if (deleteTarget) await handleDelete(deleteTarget.id);
        }}
      >
        {deleteTarget ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p>
              <span className="font-medium text-zinc-800">Role:</span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
