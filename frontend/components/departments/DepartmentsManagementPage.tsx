"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
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
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import {
  createDepartment,
  deleteDepartment,
  DepartmentRecord,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
} from "@/lib/apis/departmentApi";
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
  dashboardTableIdClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { Edit, Eye, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type StatusFilter = "all" | "active" | "inactive";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

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

export default function DepartmentsManagementPage() {
  const { data: departmentsRes, isLoading } = useSWR(
    SWR_CACH_KEYS.departments.key,
    getAllDepartments,
  );
  const { data: branchScopeRes } = useSWR(
    "departments-portfolio-scope",
    getTaskFormBranchOptions,
  );
  const { mutate } = useSWRConfig();

  const departments = (departmentsRes?.data as DepartmentRecord[]) ?? [];
  const portfolios = branchScopeRes?.data?.portfolios ?? [];
  const singleBranch = branchScopeRes?.data?.singleBranch ?? false;

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewDepartment, setViewDepartment] = useState<DepartmentRecord | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<DepartmentRecord | null>(null);
  const [portfolioId, setBranchId] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return departments.filter((dept) => {
      const active = dept.isActive !== false;
      if (branchFilter !== "all" && dept.portfolioId !== branchFilter) return false;
      if (statusFilter === "active" && !active) return false;
      if (statusFilter === "inactive" && active) return false;
      if (!query) return true;
      return (
        dept.name.toLowerCase().includes(query) ||
        (dept.description ?? "").toLowerCase().includes(query) ||
        (dept.portfolio?.name ?? "").toLowerCase().includes(query) ||
        dept.id.toLowerCase().includes(query)
      );
    });
  }, [departments, search, branchFilter, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, branchFilter, statusFilter, pageSize]);

  useEffect(() => {
    if (!singleBranch) return;
    const onlyBranchId =
      branchScopeRes?.data?.defaultBranchId ?? portfolios[0]?.id ?? "all";
    if (onlyBranchId && branchFilter !== onlyBranchId) {
      setBranchFilter(onlyBranchId);
    }
  }, [singleBranch, branchScopeRes?.data?.defaultBranchId, portfolios, branchFilter]);

  function resetForm() {
    const defaultBranchId =
      branchScopeRes?.data?.defaultBranchId ?? portfolios[0]?.id ?? "";
    setBranchId(singleBranch ? defaultBranchId : "");
    setName("");
    setDescription("");
    setStatus("active");
  }

  function openCreate() {
    setMode("create");
    setSelected(null);
    resetForm();
    setFormOpen(true);
  }

  function openEdit(dept: DepartmentRecord) {
    setMode("edit");
    setSelected(dept);
    setBranchId(dept.portfolioId);
    setName(dept.name);
    setDescription(dept.description ?? "");
    setStatus(dept.isActive ? "active" : "inactive");
    setFormOpen(true);
  }

  async function openView(dept: DepartmentRecord) {
    setViewOpen(true);
    setViewDepartment(dept);
    setViewLoading(true);
    try {
      const result = await getDepartmentById(dept.id);
      if (result.success && result.data) {
        setViewDepartment(result.data);
      }
    } finally {
      setViewLoading(false);
    }
  }

  async function handleSave() {
    if (!portfolioId) {
      toast.error("Please select a portfolio first");
      return;
    }
    if (!name.trim()) {
      toast.error("Department name is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        portfolioId,
        name: name.trim(),
        description: description.trim() || undefined,
        isActive: status === "active",
      };

      const result =
        mode === "create"
          ? await createDepartment(payload)
          : await updateDepartment(selected!.id, payload);

      if (result.success) {
        toast.success(
          mode === "create" ? "Department created" : "Department updated",
        );
        await mutate(SWR_CACH_KEYS.departments.key);
        setFormOpen(false);
        return;
      }
      toast.error(result.errors?.message ?? "Failed to save department");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setIsDeleting(true);
    const result = await deleteDepartment(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Department deleted");
      setDeleteTarget(null);
      await mutate(SWR_CACH_KEYS.departments.key);
      return;
    }
    toast.error(result.errors?.message ?? "Failed to delete department");
  }

  return (
    <ManagementPageShell title="Departments">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-6 py-3">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("w-16", compactSelectClass)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className={cn("min-w-[140px]", compactSelectClass)}
            disabled={singleBranch}
          >
            {!singleBranch && <option value="all">All portfolios</option>}
            {portfolios.map((portfolio) => (
              <option key={portfolio.id} value={portfolio.id}>
                {portfolio.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={cn("min-w-[120px]", compactSelectClass)}
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
              placeholder="Search departments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          <Button
            type="button"
            onClick={openCreate}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            Add Department
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    ID
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Portfolio
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Department
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Description
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No departments found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((dept) => (
                    <TableRow key={dept.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{dept.id}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {dept.portfolio?.name ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextPrimary}>{dept.name}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className="line-clamp-1 max-w-xs text-zinc-500">
                          {dept.description || "—"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <StatusBadge active={dept.isActive !== false} />
                      </TableCell>
                      <TableCell
                        className={cn(dashboardTableCellClass, "text-right")}
                      >
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openView(dept)}
                            className={actionBtnView}
                            title="View"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(dept)}
                            className={actionBtnEdit}
                            title="Edit"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setDeleteTarget({ id: dept.id, name: dept.name })
                            }
                            className={actionBtnDelete}
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

        <div className={dashboardPaginationClass}>
          <div>
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
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
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent
          className={configDialogShellClass}
          onPointerDownOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>
              {mode === "create" ? "Create Department" : "Edit Department"}
            </DialogTitle>
            <DialogDescription>
              Select portfolio first, then enter department details.
            </DialogDescription>
          </DialogHeader>

          <div className={configDialogBodyClass}>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Portfolio</label>
              <select
                value={portfolioId}
                onChange={(e) => setBranchId(e.target.value)}
                className={configCompactSelectClass}
                disabled={singleBranch}
              >
                <option value="">Select portfolio</option>
                {portfolios.map((portfolio) => (
                  <option key={portfolio.id} value={portfolio.id}>
                    {portfolio.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Department name
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!portfolioId}
                placeholder={portfolioId ? "Enter department name" : "Select portfolio first"}
                className={cn(configCompactInputClass, !portfolioId && "opacity-60")}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className={configTextareaClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "inactive")
                }
                className={configCompactSelectClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className={configDialogFooterClass}>
            <Button
              type="button"
              variant="outline"
              onClick={() => setFormOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Saving...
                </>
              ) : mode === "create" ? (
                "Create"
              ) : (
                "Save"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent
          className={configDialogShellClass}
          onPointerDownOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>Department Details</DialogTitle>
            <DialogDescription>View department information.</DialogDescription>
          </DialogHeader>

          <div className={configDialogBodyClass}>
            {viewLoading ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : viewDepartment ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfigInfoField label="Department ID" value={viewDepartment.id} />
                <ConfigInfoField
                  label="Status"
                  value={
                    <StatusBadge active={viewDepartment.isActive !== false} />
                  }
                />
                <ConfigInfoField
                  label="Portfolio"
                  value={viewDepartment.portfolio?.name ?? "—"}
                  className="sm:col-span-2"
                />
                <ConfigInfoField
                  label="Department Name"
                  value={viewDepartment.name}
                  className="sm:col-span-2"
                />
                <ConfigInfoField
                  label="Description"
                  value={viewDepartment.description || "—"}
                  className="sm:col-span-2"
                />
                <ConfigInfoField
                  label="Created"
                  value={formatDate(viewDepartment.createdAt ?? "") || "—"}
                />
                <ConfigInfoField
                  label="Updated"
                  value={formatDate(viewDepartment.updatedAt ?? "") || "—"}
                />
              </div>
            ) : (
              <p className="text-sm text-zinc-500">Department not found.</p>
            )}
          </div>

          <div className={configDialogFooterClass}>
            <Button type="button" onClick={() => setViewOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete department"
        description="Are you sure you want to delete this department? This action cannot be undone."
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
              <span className="font-medium text-zinc-800">Department:</span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
