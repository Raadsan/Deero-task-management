"use client";

import { useEffect, useMemo, useState } from "react";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";
import useSWR, { useSWRConfig } from "swr";
import {
  createSubService,
  deleteSubService,
  getAllServices,
  getAllSubServices,
  ServiceRecord,
  SubServiceRecord,
  updateSubService,
} from "@/lib/apis/serviceApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import AccountingPageShell from "@/components/accounting/AccountingPageShell";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  btnFormCancel,
  btnFormSubmit,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeadRowClass,
  dashboardTableHeaderClass,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  CircleDollarSign,
  Edit,
  Eye,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";
import toast from "react-hot-toast";

function formatMoney(amount: number | null | undefined, currency = "USD") {
  if (amount == null || isNaN(amount)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AccountingProductsPage() {
  const { data: subServicesRes, isLoading: isSubLoading } = useSWR(
    "all-subservices-catalog",
    getAllSubServices,
  );
  const { data: servicesRes, isLoading: isServicesLoading } = useSWR(
    SWR_CACH_KEYS.services.key,
    getAllServices,
  );
  const { mutate } = useSWRConfig();

  const services = (servicesRes?.data as ServiceRecord[]) ?? [];
  const rawSubServices = (subServicesRes?.data as SubServiceRecord[]) ?? [];

  // Fallback: If subservices endpoint is empty, derive from getAllServices
  const allSubServices = useMemo(() => {
    if (rawSubServices.length > 0) return rawSubServices;
    const derived: SubServiceRecord[] = [];
    for (const service of services) {
      if (service.subService) {
        for (const sub of service.subService) {
          derived.push({
            ...sub,
            categoryId: service.id,
            service: {
              id: service.id,
              serviceName: service.serviceName,
            },
          });
        }
      }
    }
    return derived;
  }, [rawSubServices, services]);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"name" | "price-asc" | "price-desc">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const filteredItems = useMemo(() => {
    let items = [...allSubServices];

    // Filter by Parent Service
    if (selectedCategory !== "all") {
      items = items.filter(
        (item) =>
          item.categoryId === selectedCategory ||
          item.service?.id === selectedCategory ||
          item.service?.serviceName === selectedCategory,
      );
    }

    // Filter by Search Query (Subservice name, Parent service name, Description)
    const query = search.toLowerCase().trim();
    if (query) {
      items = items.filter((item) => {
        const subName = item.name.toLowerCase();
        const parentName = (item.service?.serviceName || "").toLowerCase();
        const desc = (item.description || "").toLowerCase();
        return (
          subName.includes(query) ||
          parentName.includes(query) ||
          desc.includes(query)
        );
      });
    }

    // Sorting
    items.sort((a, b) => {
      if (sortBy === "price-asc") {
        return (a.price ?? 0) - (b.price ?? 0);
      }
      if (sortBy === "price-desc") {
        return (b.price ?? 0) - (a.price ?? 0);
      }
      // default: sort by service name then subservice name
      const parentA = a.service?.serviceName || "";
      const parentB = b.service?.serviceName || "";
      if (parentA !== parentB) return parentA.localeCompare(parentB);
      return a.name.localeCompare(b.name);
    });

    return items;
  }, [allSubServices, selectedCategory, search, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, selectedCategory, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // KPI Metrics
  const totalSubServices = allSubServices.length;
  const uniqueParentServices = useMemo(() => {
    const set = new Set(allSubServices.map((s) => s.service?.serviceName || s.categoryId));
    return set.size;
  }, [allSubServices]);

  const pricedItems = allSubServices.filter((s) => s.price != null && s.price > 0);
  const avgPrice = useMemo(() => {
    if (!pricedItems.length) return 0;
    const sum = pricedItems.reduce((acc, item) => acc + Number(item.price || 0), 0);
    return sum / pricedItems.length;
  }, [pricedItems]);

  // Dialog States
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingSub, setEditingSub] = useState<SubServiceRecord | null>(null);
  const [subName, setSubName] = useState("");
  const [parentCategoryId, setParentCategoryId] = useState("");
  const [subPrice, setSubPrice] = useState<string>("");
  const [subCurrency, setSubCurrency] = useState("USD");
  const [subDescription, setSubDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingSub, setViewingSub] = useState<SubServiceRecord | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreateDialog = () => {
    setFormMode("create");
    setEditingSub(null);
    setSubName("");
    setParentCategoryId(selectedCategory !== "all" ? selectedCategory : services[0]?.id || "");
    setSubPrice("");
    setSubCurrency("USD");
    setSubDescription("");
    setFormOpen(true);
  };

  const openEditDialog = (item: SubServiceRecord) => {
    setFormMode("edit");
    setEditingSub(item);
    setSubName(item.name);
    setParentCategoryId(item.categoryId || item.service?.id || "");
    setSubPrice(item.price != null ? String(item.price) : "");
    setSubCurrency(item.currency || "USD");
    setSubDescription(item.description || "");
    setFormOpen(true);
  };

  const openViewDialog = (item: SubServiceRecord) => {
    setViewingSub(item);
    setViewOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim()) {
      toast.error("Please enter a sub-service name");
      return;
    }
    if (!parentCategoryId) {
      toast.error("Please select a parent service");
      return;
    }

    setIsSaving(true);
    try {
      const priceNum = subPrice.trim() === "" ? null : Number(subPrice);
      if (formMode === "create") {
        const res = await createSubService({
          name: subName.trim(),
          categoryId: parentCategoryId,
          price: priceNum,
          currency: subCurrency,
          description: subDescription.trim() || undefined,
        });
        if (res.success) {
          toast.success("Sub-service created successfully");
          setFormOpen(false);
          mutate("all-subservices-catalog");
          mutate(SWR_CACH_KEYS.services.key);
        } else {
          toast.error(res.errors?.message || "Failed to create sub-service");
        }
      } else if (editingSub) {
        const res = await updateSubService(editingSub.id, {
          name: subName.trim(),
          categoryId: parentCategoryId,
          price: priceNum,
          currency: subCurrency,
          description: subDescription.trim() || undefined,
        });
        if (res.success) {
          toast.success("Sub-service updated successfully");
          setFormOpen(false);
          mutate("all-subservices-catalog");
          mutate(SWR_CACH_KEYS.services.key);
        } else {
          toast.error(res.errors?.message || "Failed to update sub-service");
        }
      }
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await deleteSubService(deleteTarget.id);
      if (res.success) {
        toast.success("Sub-service deleted successfully");
        setDeleteTarget(null);
        mutate("all-subservices-catalog");
        mutate(SWR_CACH_KEYS.services.key);
      } else {
        toast.error(res.errors?.message || "Failed to delete sub-service");
      }
    } catch {
      toast.error("Failed to delete sub-service");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRefresh = () => {
    mutate("all-subservices-catalog");
    mutate(SWR_CACH_KEYS.services.key);
  };

  const isLoading = isSubLoading || isServicesLoading;

  return (
    <AccountingPageShell
      title="Products & Sub-Services Catalog"
      description="View and manage all sub-services, their parent service classifications, and pricing for invoicing and quotations."
    >
      {/* ── Top KPI Stat Cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Sub-Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Sub-Services</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalSubServices}</h3>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Catalog</span>
        </div>

        {/* Parent Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Parent Services</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{uniqueParentServices}</h3>
            </div>
          </div>
          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">Categories</span>
        </div>

        {/* Average Price */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <CircleDollarSign className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Average Fee</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{formatMoney(avgPrice)}</h3>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">USD</span>
        </div>

        {/* Priced Offerings */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Priced Packages</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{pricedItems.length}</h3>
            </div>
          </div>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Billable</span>
        </div>
      </div>

      {/* ── Main Catalog Data Table ── */}
      <div className={dashboardCardClass}>
        {/* Controls & Search Header — Task Management style */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-4 py-3">
          {/* Show X rows */}
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

          {/* Filter by Parent Service */}
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Service</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className={cn("w-40 px-2", compactSelectClass)}
            >
              <option value="all">All Services</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.serviceName}
                </option>
              ))}
            </select>
          </div>

          {/* Sort */}
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "price-asc" | "price-desc")}
              className={cn("w-40 px-2", compactSelectClass)}
            >
              <option value="name">By Name</option>
              <option value="price-asc">Price: Low → High</option>
              <option value="price-desc">Price: High → Low</option>
            </select>
          </div>

          <div className="min-w-4 flex-1" />

          {/* Search */}
          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search sub-services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isLoading}
            aria-label="Refresh records"
            className="flex size-9 items-center justify-center rounded-md border border-zinc-200 bg-white hover:bg-zinc-50 disabled:opacity-50"
          >
            <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          </button>

          {/* Create */}
          <button
            type="button"
            onClick={openCreateDialog}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            New Sub-Service
          </button>
        </div>

        {/* Sub-Services Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={dashboardTableHeaderClass}>
              <tr className={dashboardTableHeadRowClass}>
                <th className={dashboardTableHeadClass}>#</th>
                <th className={dashboardTableHeadClass}>Sub-Service Name</th>
                <th className={dashboardTableHeadClass}>Parent Service (Service-ka)</th>
                <th className={dashboardTableHeadClass}>Price / Fee (Lacagtiisa)</th>
                <th className={dashboardTableHeadClass}>Currency</th>
                <th className={dashboardTableHeadClass}>Description / Notes</th>
                <th className={cn(dashboardTableHeadClass, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400">
                    <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                    <p className="mt-2 text-xs font-medium">Loading sub-services...</p>
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-zinc-400">
                    <Package className="mx-auto size-8 text-zinc-300" />
                    <p className="mt-2 text-sm font-semibold text-zinc-600">No sub-services found</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {search ? "Try adjusting your search criteria" : "Click 'New Sub-Service' to add one"}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index;
                  const parentName = item.service?.serviceName || "General Service";
                  return (
                    <tr key={item.id} className={dashboardTableBodyRowClass}>
                      <td className={cn(dashboardTableCellClass, "font-bold text-primary")}>
                        {globalIndex + 1}
                      </td>
                      <td className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Tag className="size-3.5" />
                          </span>
                          <div>
                            <span className="font-bold text-zinc-900">{item.name}</span>
                            <span className="block text-[10px] text-zinc-400">ID: {item.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-secondary/15 px-2.5 py-1 text-xs font-bold text-secondary">
                          <Layers className="size-3" />
                          {parentName}
                        </span>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-md">
                            {item.price != null ? formatMoney(item.price, item.currency) : "Custom"}
                          </span>
                        </div>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <span className="font-semibold text-zinc-900">
                          {item.currency || "USD"}
                        </span>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <p className="max-w-[240px] truncate text-xs font-medium text-zinc-900" title={item.description || "—"}>
                          {item.description || "—"}
                        </p>
                      </td>
                      <td className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View Details"
                            onClick={() => openViewDialog(item)}
                            className={actionBtnView}
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Sub-Service"
                            onClick={() => openEditDialog(item)}
                            className={actionBtnEdit}
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Sub-Service"
                            onClick={() => setDeleteTarget({ id: item.id, name: item.name })}
                            className={actionBtnDelete}
                          >
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar — matches Task Management */}
        <div className="flex flex-col justify-between gap-4 border-t border-zinc-100 bg-zinc-50/30 px-8 py-2 text-xs text-zinc-400 md:flex-row md:items-center">
          <div>
            {filteredItems.length === 0
              ? "0 of 0"
              : `${Math.min(filteredItems.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filteredItems.length, currentPage * pageSize)} of ${filteredItems.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* ── Create / Edit Sub-Service Modal ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {formMode === "create" ? "Create Sub-Service" : `Edit Sub-Service: ${editingSub?.name}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div>
              <label className={dashboardLabelClass}>Parent Service (Service-ka uu ka tirsan yahay) *</label>
              <select
                required
                value={parentCategoryId}
                onChange={(e) => setParentCategoryId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
              >
                <option value="">Select Service...</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.serviceName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={dashboardLabelClass}>Sub-Service Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Premium Logo Design"
                value={subName}
                onChange={(e) => setSubName(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={dashboardLabelClass}>Price / Fee (Lacagtiisa)</label>
                <div className="relative mt-1">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">$</span>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={subPrice}
                    onChange={(e) => setSubPrice(e.target.value)}
                    className="h-10 w-full rounded-xl border border-zinc-200 pl-7 pr-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className={dashboardLabelClass}>Currency</label>
                <input
                  type="text"
                  value={subCurrency}
                  onChange={(e) => setSubCurrency(e.target.value.toUpperCase())}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className={dashboardLabelClass}>Description / Features</label>
              <textarea
                rows={3}
                placeholder="Description of what this sub-service includes..."
                value={subDescription}
                onChange={(e) => setSubDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-zinc-800 outline-none focus:border-primary"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setFormOpen(false)}
                className={btnFormCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className={btnFormSubmit}
              >
                {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
                {formMode === "create" ? "Create Sub-Service" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Details Modal ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <Tag className="size-5 text-primary" />
              {viewingSub?.name}
            </DialogTitle>
          </DialogHeader>

          {viewingSub && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="rounded-xl bg-zinc-50 p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Parent Service:</span>
                  <span className="font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-md">
                    {viewingSub.service?.serviceName || "General"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Standard Price:</span>
                  <span className="font-extrabold text-emerald-700 text-sm bg-emerald-50 px-2.5 py-0.5 rounded-md">
                    {viewingSub.price != null ? formatMoney(viewingSub.price, viewingSub.currency) : "Custom Pricing"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 font-medium">Currency:</span>
                  <span className="font-semibold text-zinc-700">{viewingSub.currency || "USD"}</span>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-medium">Description:</span>
                <p className="font-normal text-zinc-700 mt-1">{viewingSub.description || "No description provided."}</p>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              onClick={() => setViewOpen(false)}
              className={btnFormCancel}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Confirmation Dialog ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Sub-Service"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        loading={isDeleting}
        destructive
        onConfirm={handleDelete}
      />
    </AccountingPageShell>
  );
}
