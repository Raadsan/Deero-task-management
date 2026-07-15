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
  BranchRecord,
  createBranch,
  deleteBranch,
  getAllBranches,
  getBranchById,
  updateBranch,
} from "@/lib/actions/portfolio.action";
import {
  resolveBranchLogoUrl,
  formatBranchLoginPath,
} from "@/lib/portfolio-branding";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
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
import { cn } from "@/lib/utils";
import { Edit, Eye, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const compactSelectClass =
  "h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const textareaClass =
  "min-h-[88px] w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function BranchesManagementPage() {
  const { data: branchesRes, isLoading } = useSWR(
    SWR_CACH_KEYS.portfolios.key,
    getAllBranches,
  );
  const { mutate } = useSWRConfig();

  const portfolios = (branchesRes?.data as BranchRecord[]) ?? [];

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewingBranch, setViewingBranch] = useState<BranchRecord | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [editingBranch, setEditingBranch] = useState<BranchRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#651210");
  const [secondaryColor, setSecondaryColor] = useState("#ec4724");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [isMainBranch, setIsMainBranch] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoData, setLogoData] = useState<string | null>(null);
  const [iconLogoPreview, setIconLogoPreview] = useState<string | null>(null);
  const [iconLogoData, setIconLogoData] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return portfolios.filter((portfolio) => {
      return (
        !query ||
        portfolio.name.toLowerCase().includes(query) ||
        (portfolio.slug ?? "").toLowerCase().includes(query) ||
        (portfolio.description ?? "").toLowerCase().includes(query) ||
        (portfolio.location ?? "").toLowerCase().includes(query) ||
        (portfolio.phone ?? "").toLowerCase().includes(query)
      );
    });
  }, [portfolios, search]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  function resetForm() {
    setName("");
    setDescription("");
    setPhone("");
    setLocation("");
    setPrimaryColor("#651210");
    setSecondaryColor("#ec4724");
    setStatus("active");
    setIsMainBranch(false);
    setLogoPreview(null);
    setLogoData(null);
    setIconLogoPreview(null);
    setIconLogoData(null);
  }

  function openCreate() {
    setMode("create");
    setEditingBranch(null);
    resetForm();
    setModalOpen(true);
  }

  function openEdit(portfolio: BranchRecord) {
    setMode("edit");
    setEditingBranch(portfolio);
    setName(portfolio.name);
    setDescription(portfolio.description ?? "");
    setPhone(portfolio.phone ?? "");
    setLocation(portfolio.location ?? "");
    setPrimaryColor(portfolio.primaryColor || "#651210");
    setSecondaryColor(portfolio.secondaryColor || "#ec4724");
    setStatus(portfolio.isActive ? "active" : "inactive");
    setIsMainBranch(Boolean(portfolio.usesRootLogin));
    setLogoPreview(resolveBranchLogoUrl(portfolio.logoUrl));
    setIconLogoPreview(resolveBranchLogoUrl(portfolio.iconLogoUrl));
    setLogoData(null);
    setIconLogoData(null);
    setModalOpen(true);
  }

  async function openView(portfolio: BranchRecord) {
    setViewOpen(true);
    setViewingBranch(portfolio);
    setViewLoading(true);
    try {
      const result = await getBranchById(portfolio.id);
      if (result.success && result.data) {
        setViewingBranch(result.data);
      }
    } finally {
      setViewLoading(false);
    }
  }

  async function handleLogoChange(
    file: File | null | undefined,
    type: "logo" | "icon",
  ) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Logo must be smaller than 2MB");
      return;
    }
    const dataUrl = await readImageAsDataUrl(file);
    if (type === "icon") {
      setIconLogoPreview(dataUrl);
      setIconLogoData(dataUrl);
    } else {
      setLogoPreview(dataUrl);
      setLogoData(dataUrl);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Portfolio name is required");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        phone: phone.trim() || undefined,
        location: location.trim() || undefined,
        primaryColor,
        secondaryColor,
        isActive: status === "active",
        useRootLogin: isMainBranch,
        ...(logoData ? { logoData } : {}),
        ...(iconLogoData ? { iconLogoData } : {}),
      };

      const result =
        mode === "create"
          ? await createBranch(payload)
          : await updateBranch(editingBranch!.id, payload);

      if (result.success) {
        toast.success(mode === "create" ? "Portfolio created" : "Portfolio updated");
        await mutate(SWR_CACH_KEYS.portfolios.key);
        setModalOpen(false);
        return;
      }
      toast.error(result.errors?.message ?? "Failed to save portfolio");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSetAsMain(portfolio: BranchRecord) {
    setIsSaving(true);
    try {
      const result = await updateBranch(portfolio.id, {
        name: portfolio.name,
        useRootLogin: true,
      });
      if (result.success) {
        toast.success(`"${portfolio.name}" is now the main portfolio`);
        await mutate(SWR_CACH_KEYS.portfolios.key);
        return;
      }
      toast.error(result.errors?.message ?? "Failed to set main portfolio");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const portfolio = portfolios.find((b) => b.id === id);
    if (portfolio?.usesRootLogin) {
      toast.error("Cannot delete the root login portfolio");
      setDeleteTarget(null);
      return;
    }

    setIsDeleting(true);
    const result = await deleteBranch(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Portfolio deleted");
      setDeleteTarget(null);
      await mutate(SWR_CACH_KEYS.portfolios.key);
      return;
    }
    toast.error(result.errors?.message ?? "Failed to delete portfolio");
  }

  function requestDeleteBranch(portfolio: BranchRecord) {
    if (portfolio.usesRootLogin) {
      toast.error("Cannot delete the root login portfolio");
      return;
    }
    setDeleteTarget({ id: portfolio.id, name: portfolio.name });
  }

  return (
    <ManagementPageShell title="Portfolios management">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-6 py-3">
          <div className="group relative ml-auto w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search portfolios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(compactInputClass, "pl-9")}
            />
          </div>
          <Button
            type="button"
            onClick={openCreate}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            Create Portfolio
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={dashboardTableHeadClass}>Portfolio Name</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Phone</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Location</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Employees</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(4)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      <TableCell colSpan={6} className="px-6 py-4">
                        <div className="h-4 w-full rounded bg-zinc-100" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No portfolios found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((portfolio) => (
                    <TableRow key={portfolio.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2">
                          {portfolio.logoUrl ? (
                            <img
                              src={resolveBranchLogoUrl(portfolio.logoUrl) ?? ""}
                              alt={portfolio.name}
                              className="size-8 rounded object-contain"
                            />
                          ) : null}
                          <span className={dashboardTextPrimary}>{portfolio.name}</span>
                          {portfolio.usesRootLogin ? (
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">
                              Main portfolio
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {portfolio.phone || "—"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {portfolio.location || "—"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {portfolio._count?.users ?? 0}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            dashboardStatusBadgeClass,
                            portfolio.isActive
                              ? getTaskStatusBadgeClass("completed")
                              : getTaskStatusBadgeClass("overdue"),
                          )}
                        >
                          {portfolio.isActive ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(dashboardTableCellClass, "text-right")}
                      >
                        <div className="flex justify-end gap-1">
                          {!portfolio.usesRootLogin ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-xs text-primary"
                              onClick={() => handleSetAsMain(portfolio)}
                              title="Set as main portfolio"
                            >
                              Set main
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={actionBtnView}
                            onClick={() => openView(portfolio)}
                            title="View"
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={actionBtnEdit}
                            onClick={() => openEdit(portfolio)}
                            title="Edit"
                          >
                            <Edit className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className={actionBtnDelete}
                            onClick={() => requestDeleteBranch(portfolio)}
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

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle>
              {mode === "create" ? "Create Portfolio" : "Edit Portfolio"}
            </DialogTitle>
            <DialogDescription>
              Set portfolio details and branding. Employees sign in at the unified login page.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Portfolio name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Portfolio name (case-sensitive)"
                className={compactInputClass}
              />
            </div>

            <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-600">
              All employees sign in at <strong>/</strong>. After login, each user sees
              their portfolio logo and colors automatically.
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Portfolio description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Portfolio description"
                className={textareaClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Portfolio phone</label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Portfolio phone"
                className={compactInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Portfolio location
              </label>
              <input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Portfolio location"
                className={compactInputClass}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  Primary color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="size-9 cursor-pointer rounded border border-zinc-200"
                  />
                  <input
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className={compactInputClass}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-zinc-700">
                  Secondary color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="size-9 cursor-pointer rounded border border-zinc-200"
                  />
                  <input
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className={compactInputClass}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Logo with text (sidebar expanded)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex h-16 w-28 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50">
                  {logoPreview ? (
                    <Image
                      src={logoPreview}
                      alt="Wordmark logo preview"
                      width={100}
                      height={56}
                      unoptimized
                      className="max-h-14 max-w-[6.5rem] object-contain"
                    />
                  ) : (
                    <Upload className="size-5 text-zinc-400" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e.target.files?.[0], "logo")}
                  />
                  <span className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50">
                    Upload wordmark
                  </span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-zinc-700">
                Icon logo (sidebar collapsed)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex size-16 items-center justify-center rounded-lg border border-dashed border-zinc-200 bg-zinc-50">
                  {iconLogoPreview ? (
                    <Image
                      src={iconLogoPreview}
                      alt="Icon logo preview"
                      width={56}
                      height={56}
                      unoptimized
                      className="size-14 object-contain"
                    />
                  ) : (
                    <Upload className="size-5 text-zinc-400" />
                  )}
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleLogoChange(e.target.files?.[0], "icon")}
                  />
                  <span className="inline-flex h-9 items-center rounded-md border border-zinc-200 px-3 text-sm text-zinc-600 hover:bg-zinc-50">
                    Upload icon
                  </span>
                </label>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-3">
              <input
                type="checkbox"
                checked={isMainBranch}
                onChange={(e) => setIsMainBranch(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-primary focus:ring-primary/30"
              />
              <span className="text-sm text-zinc-600">
                <span className="font-medium text-zinc-800">Main portfolio</span>
                <br />
                Default portfolio for users without a portfolio (e.g. Deero Advert).
                Only one portfolio can be main at a time.
              </span>
            </label>

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Status</label>
              <select
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "active" | "inactive")
                }
                className={compactSelectClass}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
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

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle>Portfolio Details</DialogTitle>
            <DialogDescription>
              View all information for this portfolio.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {viewLoading ? (
              <div className="space-y-3 py-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse rounded-lg bg-zinc-100" />
                ))}
              </div>
            ) : viewingBranch ? (
              <>
                {(viewingBranch.logoUrl || viewingBranch.iconLogoUrl) ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {viewingBranch.logoUrl ? (
                      <div className="flex flex-col items-center rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                        <p className="mb-2 text-xs font-medium text-zinc-500">Wordmark</p>
                        <img
                          src={resolveBranchLogoUrl(viewingBranch.logoUrl) ?? ""}
                          alt={`${viewingBranch.name} wordmark`}
                          className="max-h-24 object-contain"
                        />
                      </div>
                    ) : null}
                    {viewingBranch.iconLogoUrl ? (
                      <div className="flex flex-col items-center rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                        <p className="mb-2 text-xs font-medium text-zinc-500">Icon</p>
                        <img
                          src={resolveBranchLogoUrl(viewingBranch.iconLogoUrl) ?? ""}
                          alt={`${viewingBranch.name} icon`}
                          className="max-h-24 object-contain"
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoField label="Portfolio ID" value={viewingBranch.id} />
                  <InfoField
                    label="Status"
                    value={viewingBranch.isActive ? "Active" : "Inactive"}
                  />
                  <InfoField
                    label="Portfolio Name"
                    value={viewingBranch.name}
                    className="sm:col-span-2"
                  />
                  <InfoField
                    label="Sign-in page"
                    value={formatBranchLoginPath(viewingBranch)}
                    className="sm:col-span-2"
                  />
                  <InfoField
                    label="Description"
                    value={viewingBranch.description || "—"}
                    className="sm:col-span-2"
                  />
                  <InfoField label="Phone" value={viewingBranch.phone || "—"} />
                  <InfoField
                    label="Location"
                    value={viewingBranch.location || "—"}
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Primary Color
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="size-6 rounded border border-zinc-200"
                        style={{
                          backgroundColor: viewingBranch.primaryColor || "#651210",
                        }}
                      />
                      <span className="text-sm font-medium text-zinc-800">
                        {viewingBranch.primaryColor || "#651210"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Secondary Color
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="size-6 rounded border border-zinc-200"
                        style={{
                          backgroundColor:
                            viewingBranch.secondaryColor || "#ec4724",
                        }}
                      />
                      <span className="text-sm font-medium text-zinc-800">
                        {viewingBranch.secondaryColor || "#ec4724"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-zinc-800">
                    Employees (
                    {viewingBranch._count?.users ??
                      viewingBranch.users?.length ??
                      0}
                    )
                  </p>
                  {viewingBranch.users?.length ? (
                    <ul className="space-y-2">
                      {viewingBranch.users.map((user) => (
                        <li
                          key={user.id}
                          className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-zinc-800">
                            {user.name}
                          </p>
                          <p className="text-xs text-zinc-500">{user.email}</p>
                          {user.department ? (
                            <p className="text-xs text-zinc-500">
                              {user.department}
                            </p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No employees assigned.</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            {viewingBranch ? (
              <Button
                variant="outline"
                onClick={() => {
                  setViewOpen(false);
                  openEdit(viewingBranch);
                }}
              >
                Edit
              </Button>
            ) : null}
            <Button onClick={() => setViewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete portfolio"
        description="Delete this portfolio? Employees will be unassigned. This action cannot be undone."
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
              <span className="font-medium text-zinc-800">Portfolio:</span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}

function InfoField({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-zinc-100 bg-zinc-50 p-3",
        className,
      )}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium break-all text-zinc-800">{value}</p>
    </div>
  );
}
