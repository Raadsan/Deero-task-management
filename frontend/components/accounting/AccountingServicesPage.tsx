"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";
import {
  createService,
  deleteService,
  getAllServices,
  ServiceRecord,
  SubServiceInput,
  updateService,
} from "@/lib/apis/serviceApi";
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
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
import { cn, getRandomUUID } from "@/lib/utils";
import {
  Building2,
  Check,
  Edit,
  Eye,
  Layers,
  Layers2,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";

type SubField = SubServiceInput & { key: string };

function emptySubField(): SubField {
  return {
    key: getRandomUUID(),
    name: "",
    price: null,
    currency: "USD",
    features: [],
  };
}

function toSubFields(subs: ServiceRecord["subService"] | undefined): SubField[] {
  if (!subs?.length) return [emptySubField()];
  return subs.map((sub) => ({
    key: sub.id,
    id: sub.id,
    name: sub.name,
    price: sub.price ?? null,
    currency: sub.currency || "USD",
    features: sub.features || [],
  }));
}

export default function AccountingServicesPage() {
  const { data: servicesRes, isLoading } = useSWR(
    SWR_CACH_KEYS.services.key,
    getAllServices,
  );
  const { data: branchScopeRes } = useSWR(
    "services-portfolio-scope",
    getTaskFormBranchOptions,
  );
  const { mutate } = useSWRConfig();

  const services = (servicesRes?.data as ServiceRecord[]) ?? [];
  const activeBranches = branchScopeRes?.data?.portfolios ?? [];
  const singleBranch = branchScopeRes?.data?.singleBranch ?? false;

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "ONE_TIME" | "SUBSCRIPTION">("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    if (!singleBranch) return;
    const onlyBranchId =
      branchScopeRes?.data?.defaultBranchId ?? activeBranches[0]?.id ?? "all";
    if (onlyBranchId && branchFilter !== onlyBranchId) {
      setBranchFilter(onlyBranchId);
    }
  }, [singleBranch, branchScopeRes?.data?.defaultBranchId, activeBranches, branchFilter]);

  const scopedServices = useMemo(() => {
    let list =
      branchFilter === "all"
        ? services
        : services.filter(
            (service) =>
              (service.portfolioId ?? service.portfolio?.id) === branchFilter,
          );

    if (typeFilter !== "ALL") {
      list = list.filter((s) => s.serviceType === typeFilter);
    }

    return [...list].sort((a, b) => {
      const branchA = a.portfolio?.name ?? "";
      const branchB = b.portfolio?.name ?? "";
      if (branchA !== branchB) return branchA.localeCompare(branchB);
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [services, branchFilter, typeFilter]);

  const filtered = useMemo(() => {
    const query = search.toLowerCase().trim();
    if (!query) return scopedServices;
    return scopedServices.filter((service) => {
      const id = service.id.toLowerCase();
      const name = service.serviceName?.toLowerCase() ?? "";
      const description = service.description?.toLowerCase() ?? "";
      const branchName = service.portfolio?.name?.toLowerCase() ?? "";
      const subs = service.subService?.some((sub) =>
        sub.name.toLowerCase().includes(query),
      );
      return (
        id.includes(query) ||
        name.includes(query) ||
        description.includes(query) ||
        branchName.includes(query) ||
        subs
      );
    });
  }, [scopedServices, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, typeFilter, branchFilter]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // KPI Metrics
  const totalServices = services.length;
  const totalOneTime = services.filter((s) => s.serviceType !== "SUBSCRIPTION").length;
  const totalSubscription = services.filter((s) => s.serviceType === "SUBSCRIPTION").length;
  const totalSubServices = services.reduce(
    (acc, s) => acc + (s.subService?.length ?? s._count?.subService ?? 0),
    0,
  );

  // Dialog states
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [serviceType, setServiceType] = useState<"ONE_TIME" | "SUBSCRIPTION">("ONE_TIME");
  const [portfolioId, setPortfolioId] = useState("");
  const [subFields, setSubFields] = useState<SubField[]>([emptySubField()]);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingService, setViewingService] = useState<ServiceRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreateDialog = () => {
    setFormMode("create");
    setEditingService(null);
    setServiceName("");
    setServiceDescription("");
    setServiceType("ONE_TIME");
    setPortfolioId(
      singleBranch
        ? branchScopeRes?.data?.defaultBranchId || activeBranches[0]?.id || ""
        : branchFilter !== "all"
        ? branchFilter
        : activeBranches[0]?.id || "",
    );
    setSubFields([emptySubField()]);
    setFormOpen(true);
  };

  const openEditDialog = (service: ServiceRecord) => {
    setFormMode("edit");
    setEditingService(service);
    setServiceName(service.serviceName);
    setServiceDescription(service.description || "");
    setServiceType(service.serviceType || "ONE_TIME");
    setPortfolioId(service.portfolioId || service.portfolio?.id || "");
    setSubFields(toSubFields(service.subService));
    setFormOpen(true);
  };

  const openViewDialog = (service: ServiceRecord) => {
    setViewingService(service);
    setViewOpen(true);
  };

  const handleSubFieldChange = (
    key: string,
    field: "name" | "price" | "currency",
    val: string | number | null,
  ) => {
    setSubFields((prev) =>
      prev.map((sub) => (sub.key === key ? { ...sub, [field]: val } : sub)),
    );
  };

  const handleAddSubField = () => {
    setSubFields((prev) => [...prev, emptySubField()]);
  };

  const handleRemoveSubField = (key: string) => {
    setSubFields((prev) => {
      const next = prev.filter((s) => s.key !== key);
      return next.length ? next : [emptySubField()];
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serviceName.trim()) {
      toast.error("Please enter a service name");
      return;
    }
    if (!portfolioId) {
      toast.error("Please select a portfolio / branch");
      return;
    }

    const payloadSubs = subFields
      .filter((s) => s.name.trim())
      .map((s) => ({
        id: s.id,
        name: s.name.trim(),
        price: s.price == null || isNaN(Number(s.price)) ? null : Number(s.price),
        currency: s.currency || "USD",
        features: s.features || [],
      }));

    setIsSaving(true);
    try {
      if (formMode === "create") {
        const res = await createService({
          serviceName: serviceName.trim(),
          description: serviceDescription.trim() || undefined,
          serviceType,
          portfolioId,
          subServices: payloadSubs,
        });
        if (res.success) {
          toast.success("Service created successfully");
          setFormOpen(false);
          mutate(SWR_CACH_KEYS.services.key);
        } else {
          toast.error(res.errors?.message || "Failed to create service");
        }
      } else if (editingService) {
        const res = await updateService(editingService.id, {
          serviceName: serviceName.trim(),
          description: serviceDescription.trim() || undefined,
          serviceType,
          portfolioId,
          subServices: payloadSubs,
        });
        if (res.success) {
          toast.success("Service updated successfully");
          setFormOpen(false);
          mutate(SWR_CACH_KEYS.services.key);
        } else {
          toast.error(res.errors?.message || "Failed to update service");
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
      const res = await deleteService(deleteTarget.id);
      if (res.success) {
        toast.success("Service deleted successfully");
        setDeleteTarget(null);
        mutate(SWR_CACH_KEYS.services.key);
      } else {
        toast.error(res.errors?.message || "Failed to delete service");
      }
    } catch {
      toast.error("Failed to delete service");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AccountingPageShell
      title="Services & Categories"
      description="Manage all system services, billable offerings, pricing categories, and package bundles."
    >
      {/* ── Top KPI Stat Cards ── */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Layers className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Services</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalServices}</h3>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Active</span>
        </div>

        {/* One-Time Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-secondary/15 text-secondary">
              <Package className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">One-Time Services</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalOneTime}</h3>
            </div>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-600">Fixed</span>
        </div>

        {/* Subscription Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Repeat className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Recurring Plans</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalSubscription}</h3>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Monthly</span>
        </div>

        {/* Total Sub-Services */}
        <div className="flex items-center justify-between rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
              <Sparkles className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Sub-Services / Packages</p>
              <h3 className="text-2xl font-bold text-[#0f172a]">{totalSubServices}</h3>
            </div>
          </div>
          <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-bold text-sky-700">Priced</span>
        </div>
      </div>

      {/* ── Main Data Card ── */}
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

          {/* Service Type Filter */}
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Type</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as "ALL" | "ONE_TIME" | "SUBSCRIPTION")}
              className={cn("w-40 px-2", compactSelectClass)}
            >
              <option value="ALL">All Types</option>
              <option value="ONE_TIME">One-Time</option>
              <option value="SUBSCRIPTION">Subscription</option>
            </select>
          </div>

          {/* Branch Filter */}
          {!singleBranch && activeBranches.length > 1 && (
            <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
              <span>Branch</span>
              <select
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className={cn("w-36 px-2", compactSelectClass)}
              >
                <option value="all">All Branches</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="min-w-4 flex-1" />

          {/* Search */}
          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => mutate(SWR_CACH_KEYS.services.key)}
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
            New Service
          </button>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className={dashboardTableHeaderClass}>
              <tr className={dashboardTableHeadRowClass}>
                <th className={dashboardTableHeadClass}>#</th>
                <th className={dashboardTableHeadClass}>Service Name</th>
                <th className={dashboardTableHeadClass}>Type</th>
                <th className={dashboardTableHeadClass}>Branch / Portfolio</th>
                <th className={dashboardTableHeadClass}>Sub-Services / Offerings</th>
                <th className={dashboardTableHeadClass}>Description</th>
                <th className={cn(dashboardTableHeadClass, "text-right")}>Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-zinc-400">
                    <Loader2 className="mx-auto size-6 animate-spin text-primary" />
                    <p className="mt-2 text-xs font-medium">Loading services...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-zinc-400">
                    <Layers2 className="mx-auto size-8 text-zinc-300" />
                    <p className="mt-2 text-sm font-semibold text-zinc-600">No services found</p>
                    <p className="mt-1 text-xs text-zinc-400">
                      {search ? "Try adjusting your search criteria" : "Click 'New Service' to create one"}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedServices.map((service, index) => {
                  const globalIndex = (currentPage - 1) * pageSize + index;
                  const subs = service.subService || [];
                  const count = subs.length;
                  return (
                    <tr key={service.id} className={dashboardTableBodyRowClass}>
                      <td className={cn(dashboardTableCellClass, "font-bold text-primary")}>
                        {globalIndex + 1}
                      </td>
                      <td className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                            <Layers className="size-3.5" />
                          </span>
                          <div>
                            <span className="font-bold text-zinc-800">{service.serviceName}</span>
                            <span className="block text-[10px] text-zinc-400">ID: {service.id}</span>
                          </div>
                        </div>
                      </td>
                      <td className={dashboardTableCellClass}>
                        {service.serviceType === "SUBSCRIPTION" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                            <Repeat className="size-3" /> Subscription
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-bold text-zinc-700">
                            <Package className="size-3" /> One-Time
                          </span>
                        )}
                      </td>
                      <td className={dashboardTableCellClass}>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-900">
                          <Building2 className="size-3 text-zinc-500" />
                          {service.portfolio?.name || "General"}
                        </span>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <div className="max-w-[280px]">
                          <span className="inline-flex items-center rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
                            {count} {count === 1 ? "Sub-service" : "Sub-services"}
                          </span>
                          {count > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {subs.slice(0, 3).map((sub) => (
                                <span
                                  key={sub.id}
                                  className="inline-block rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 truncate max-w-[120px]"
                                  title={sub.name}
                                >
                                  {sub.name}
                                </span>
                              ))}
                              {count > 3 && (
                                <span className="text-[10px] font-semibold text-zinc-400">
                                  +{count - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className={dashboardTableCellClass}>
                        <p className="max-w-[200px] truncate text-xs font-medium text-zinc-900" title={service.description || "—"}>
                          {service.description || "—"}
                        </p>
                      </td>
                      <td className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View Service"
                            onClick={() => openViewDialog(service)}
                            className={actionBtnView}
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Edit Service"
                            onClick={() => openEditDialog(service)}
                            className={actionBtnEdit}
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            type="button"
                            title="Delete Service"
                            onClick={() => setDeleteTarget({ id: service.id, name: service.serviceName })}
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
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
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

      {/* ── Create / Edit Service Modal ── */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-zinc-900">
              {formMode === "create" ? "Create New Service" : `Edit Service: ${editingService?.serviceName}`}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={dashboardLabelClass}>Service Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graphic Design"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className={dashboardLabelClass}>Service Type *</label>
                <select
                  value={serviceType}
                  onChange={(e) => setServiceType(e.target.value as "ONE_TIME" | "SUBSCRIPTION")}
                  className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                >
                  <option value="ONE_TIME">One-Time Project</option>
                  <option value="SUBSCRIPTION">Monthly Subscription</option>
                </select>
              </div>
            </div>

            <div>
              <label className={dashboardLabelClass}>Portfolio / Branch *</label>
              <select
                required
                value={portfolioId}
                onChange={(e) => setPortfolioId(e.target.value)}
                className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
              >
                <option value="">Select Branch...</option>
                {activeBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className={dashboardLabelClass}>Description</label>
              <textarea
                rows={2}
                placeholder="Brief description of the service..."
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                className="mt-1 w-full rounded-xl border border-zinc-200 p-3 text-xs font-medium text-zinc-800 outline-none focus:border-primary"
              />
            </div>

            {/* Sub-services Repeater */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4">
              <div className="flex items-center justify-between pb-2">
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">Sub-Services & Packages</h4>
                  <p className="text-[10px] text-zinc-400">Add billable sub-items and their default pricing</p>
                </div>
                <button
                  type="button"
                  onClick={handleAddSubField}
                  className="flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-primary border border-zinc-200 hover:bg-zinc-50"
                >
                  <Plus className="size-3.5" /> Add Package
                </button>
              </div>

              <div className="space-y-2 pt-2">
                {subFields.map((sub, idx) => (
                  <div key={sub.key} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder={`Package ${idx + 1} Name`}
                      value={sub.name}
                      onChange={(e) => handleSubFieldChange(sub.key, "name", e.target.value)}
                      className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                    />
                    <div className="relative w-28">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-zinc-400">$</span>
                      <input
                        type="number"
                        step="0.01"
                        placeholder="Price"
                        value={sub.price ?? ""}
                        onChange={(e) =>
                          handleSubFieldChange(
                            sub.key,
                            "price",
                            e.target.value === "" ? null : Number(e.target.value),
                          )
                        }
                        className="h-9 w-full rounded-lg border border-zinc-200 bg-white pl-6 pr-2 text-xs font-semibold text-zinc-800 outline-none focus:border-primary"
                      />
                    </div>
                    {subFields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSubField(sub.key)}
                        className="flex size-9 items-center justify-center rounded-lg text-rose-500 hover:bg-rose-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
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
                {formMode === "create" ? "Create Service" : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── View Service Modal ── */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold text-zinc-900">
              <Layers className="size-5 text-primary" />
              {viewingService?.serviceName}
            </DialogTitle>
          </DialogHeader>

          {viewingService && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="grid grid-cols-2 gap-4 rounded-xl bg-zinc-50 p-3">
                <div>
                  <span className="text-zinc-400 font-medium">Service Type:</span>
                  <p className="font-bold text-zinc-800 mt-0.5">
                    {viewingService.serviceType === "SUBSCRIPTION" ? "Recurring Subscription" : "One-Time Project"}
                  </p>
                </div>
                <div>
                  <span className="text-zinc-400 font-medium">Portfolio / Branch:</span>
                  <p className="font-bold text-zinc-800 mt-0.5">{viewingService.portfolio?.name || "General"}</p>
                </div>
              </div>

              <div>
                <span className="text-zinc-400 font-medium">Description:</span>
                <p className="font-normal text-zinc-700 mt-0.5">{viewingService.description || "No description provided."}</p>
              </div>

              <div>
                <h4 className="font-bold text-zinc-800 mb-2">Connected Sub-Services ({viewingService.subService?.length || 0})</h4>
                <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200 overflow-hidden">
                  {viewingService.subService?.length ? (
                    viewingService.subService.map((sub) => (
                      <div key={sub.id} className="flex items-center justify-between p-3 bg-white">
                        <div>
                          <p className="font-bold text-zinc-800">{sub.name}</p>
                          {sub.description && <p className="text-[11px] text-zinc-400">{sub.description}</p>}
                        </div>
                        <span className="font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md text-xs">
                          {sub.price != null ? `$${Number(sub.price).toFixed(2)}` : "Custom"}
                        </span>
                      </div>
                    ))
                  ) : (
                    <div className="p-4 text-center text-zinc-400">No sub-services attached.</div>
                  )}
                </div>
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

      {/* ── Confirm Delete Dialog ── */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Service"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? All linked sub-services will also be removed.`}
        confirmLabel="Delete"
        loading={isDeleting}
        destructive
        onConfirm={handleDelete}
      />
    </AccountingPageShell>
  );
}
