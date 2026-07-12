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
  createService,
  deleteService,
  getAllServices,
  ServiceRecord,
  SubServiceInput,
  updateService,
} from "@/lib/actions/service.action";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardTextPrimary,
} from "@/lib/dashboard-ui";
import { cn, getRandomUUID } from "@/lib/utils";
import { Edit, Eye, Layers, Loader2, Plus, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const textareaClass =
  "min-h-[88px] w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

type SubField = SubServiceInput & { key: string };

function emptySubField(): SubField {
  return { key: getRandomUUID(), name: "" };
}

function toSubFields(
  subs: ServiceRecord["subService"] | undefined,
): SubField[] {
  if (!subs?.length) return [emptySubField()];
  return subs.map((sub) => ({
    key: sub.id,
    id: sub.id,
    name: sub.name,
  }));
}

export default function ServicesManagementPage() {
  const { data: servicesRes, isLoading } = useSWR(
    SWR_CACH_KEYS.services.key,
    getAllServices,
  );
  const { data: branchScopeRes } = useSWR(
    "services-branch-scope",
    getTaskFormBranchOptions,
  );
  const { mutate } = useSWRConfig();

  const services = (servicesRes?.data as ServiceRecord[]) ?? [];
  const activeBranches = branchScopeRes?.data?.branches ?? [];
  const singleBranch = branchScopeRes?.data?.singleBranch ?? false;

  const [search, setSearch] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");

  useEffect(() => {
    if (!singleBranch) return;
    const onlyBranchId =
      branchScopeRes?.data?.defaultBranchId ?? activeBranches[0]?.id ?? "all";
    if (onlyBranchId && branchFilter !== onlyBranchId) {
      setBranchFilter(onlyBranchId);
    }
  }, [singleBranch, branchScopeRes?.data?.defaultBranchId, activeBranches, branchFilter]);

  const scopedServices = useMemo(() => {
    const list =
      branchFilter === "all"
        ? services
        : services.filter(
            (service) => (service.branchId ?? service.branch?.id) === branchFilter,
          );

    return [...list].sort((a, b) => {
      const branchA = a.branch?.name ?? "";
      const branchB = b.branch?.name ?? "";
      if (branchA !== branchB) return branchA.localeCompare(branchB);
      return a.serviceName.localeCompare(b.serviceName);
    });
  }, [services, branchFilter]);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingService, setEditingService] = useState<ServiceRecord | null>(null);
  const [serviceName, setServiceName] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [branchId, setBranchId] = useState("");
  const [subFields, setSubFields] = useState<SubField[]>([emptySubField()]);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewingService, setViewingService] = useState<ServiceRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return scopedServices.filter((service) => {
      const id = service.id.toLowerCase();
      const name = service.serviceName?.toLowerCase() ?? "";
      const description = service.description?.toLowerCase() ?? "";
      const branchName = service.branch?.name?.toLowerCase() ?? "";
      const subs = service.subService?.some((sub) =>
        sub.name.toLowerCase().includes(query),
      );
      return (
        !query ||
        id.includes(query) ||
        name.includes(query) ||
        description.includes(query) ||
        branchName.includes(query) ||
        subs
      );
    });
  }, [scopedServices, search]);

  function openCreate() {
    setFormMode("create");
    setEditingService(null);
    setServiceName("");
    setServiceDescription("");
    setBranchId(
      branchFilter !== "all"
        ? branchFilter
        : activeBranches.find((b) => b.usesRootLogin)?.id ?? activeBranches[0]?.id ?? "",
    );
    setSubFields([emptySubField()]);
    setFormOpen(true);
  }

  function openEdit(service: ServiceRecord) {
    setFormMode("edit");
    setEditingService(service);
    setServiceName(service.serviceName);
    setServiceDescription(service.description ?? "");
    setBranchId(service.branchId ?? service.branch?.id ?? "");
    setSubFields(toSubFields(service.subService));
    setFormOpen(true);
  }

  function openView(service: ServiceRecord) {
    setViewingService(service);
    setViewOpen(true);
  }

  function addSubField() {
    setSubFields((prev) => [...prev, emptySubField()]);
  }

  function removeSubField(key: string) {
    setSubFields((prev) =>
      prev.length > 1 ? prev.filter((field) => field.key !== key) : prev,
    );
  }

  function updateSubField(key: string, name: string) {
    setSubFields((prev) =>
      prev.map((field) => (field.key === key ? { ...field, name } : field)),
    );
  }

  async function handleSave() {
    const trimmedName = serviceName.trim();
    if (!trimmedName) {
      toast.error("Please enter a service name");
      return;
    }

    if (!branchId) {
      toast.error("Please select a branch");
      return;
    }

    const subServices = subFields
      .map(({ id, name }) => ({ id, name: name.trim() }))
      .filter((sub) => sub.name);

    const subNames = subServices.map((sub) => sub.name.toLowerCase());
    if (new Set(subNames).size !== subNames.length) {
      toast.error("Each sub-service name must be unique");
      return;
    }

    const payload = {
      serviceName: trimmedName,
      description: serviceDescription.trim() || undefined,
      branchId,
      subServices,
    };

    setIsSaving(true);
    try {
      const result =
        formMode === "create"
          ? await createService(payload)
          : await updateService(editingService!.id, payload);

      if (result.success) {
        toast.success(
          formMode === "create" ? "Service created successfully" : "Service updated successfully",
        );
        await mutate(SWR_CACH_KEYS.services.key);
        setFormOpen(false);
        return;
      }
      toast.error(result.errors?.message ?? "Failed to save service");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setIsDeleting(true);
    const result = await deleteService(id);
    setIsDeleting(false);
    if (result.success) {
      toast.success("Service deleted");
      setDeleteTarget(null);
      await mutate(SWR_CACH_KEYS.services.key);
      return;
    }
    toast.error(result.errors?.message ?? "Failed to delete service");
  }

  return (
    <ManagementPageShell title="Services management">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Branch</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className={cn("min-w-[9rem]", compactSelectClass)}
              disabled={singleBranch}
            >
              {!singleBranch && <option value="all">All branches</option>}
              {activeBranches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-4 flex-1" />
          <div className="group relative w-44 sm:w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search services..."
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
            Create Service
          </Button>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={cn(dashboardCardClass, "h-52 animate-pulse bg-zinc-50")}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-6 py-10 text-center">
            <Layers className="mb-3 size-10 text-zinc-300" />
            <p className="text-sm font-medium text-zinc-600">No services found</p>
            <p className="mt-1 text-xs text-zinc-400">
              Create a service or adjust your filters.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((service) => {
              const subCount =
                service._count?.subService ?? service.subService?.length ?? 0;
              const previewSubs = service.subService?.slice(0, 3) ?? [];

              return (
                <article
                  key={service.id}
                  className={cn(
                    dashboardCardClass,
                    "flex flex-col p-5 transition-shadow hover:shadow-md",
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Layers className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className={cn(dashboardTextPrimary, "truncate text-base")}>
                          {service.serviceName}
                        </h3>
                        <p className="mt-0.5 truncate text-xs font-medium text-primary">
                          {service.branch?.name || "No branch"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                      {subCount} sub{subCount === 1 ? "" : "s"}
                    </span>
                  </div>

                  <p className="mb-3 line-clamp-2 text-sm text-zinc-600">
                    {service.description || "No description added yet."}
                  </p>

                  {previewSubs.length > 0 ? (
                    <div className="mb-4 flex flex-wrap gap-1.5">
                      {previewSubs.map((sub) => (
                        <span
                          key={sub.id}
                          className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600"
                        >
                          {sub.name}
                        </span>
                      ))}
                      {subCount > previewSubs.length ? (
                        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-500">
                          +{subCount - previewSubs.length} more
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="mb-4 text-xs text-zinc-400">No sub-services yet.</p>
                  )}

                  <div className="mt-auto flex items-center justify-end gap-1 border-t border-zinc-100 pt-4">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={actionBtnView}
                      onClick={() => openView(service)}
                      title="View"
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={actionBtnEdit}
                      onClick={() => openEdit(service)}
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
                        setDeleteTarget({
                          id: service.id,
                          name: service.serviceName,
                        })
                      }
                      title="Delete"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle>
              {formMode === "create" ? "Create Service" : "Edit Service"}
            </DialogTitle>
            <DialogDescription>
              Add service details and as many sub-services as you need.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">Branch</label>
              <select
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
                className={cn(compactSelectClass, "w-full px-3")}
                disabled={singleBranch}
              >
                <option value="">Select branch</option>
                {activeBranches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Service name
              </label>
              <input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="Service name"
                className={compactInputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-700">
                Description
              </label>
              <textarea
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                placeholder="Service description"
                className={textareaClass}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-zinc-700">
                  Sub-services
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={addSubField}
                >
                  <Plus className="size-3.5" />
                  Add sub-service
                </Button>
              </div>
              <div className="space-y-2">
                {subFields.map((field, index) => (
                  <div key={field.key} className="flex items-center gap-2">
                    <input
                      value={field.name}
                      onChange={(e) => updateSubField(field.key, e.target.value)}
                      placeholder={`Sub-service name ${index + 1}`}
                      className={compactInputClass}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8 shrink-0 text-zinc-500"
                      onClick={() => removeSubField(field.key)}
                      disabled={subFields.length === 1}
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-6 py-4">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving...
                </>
              ) : formMode === "create" ? (
                "Create service"
              ) : (
                "Save changes"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle>Service Details</DialogTitle>
            <DialogDescription>
              View service information and all sub-services.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            {viewingService ? (
              <>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Service ID
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {viewingService.id}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Service Name
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {viewingService.serviceName}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Branch
                  </p>
                  <p className="mt-1 text-sm font-medium text-zinc-800">
                    {viewingService.branch?.name || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Description
                  </p>
                  <p className="mt-1 text-sm text-zinc-700">
                    {viewingService.description || "—"}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-sm font-semibold text-zinc-800">
                    Sub-services (
                    {viewingService.subService?.length ??
                      viewingService._count?.subService ??
                      0}
                    )
                  </p>
                  {viewingService.subService?.length ? (
                    <ul className="space-y-2">
                      {viewingService.subService.map((sub) => (
                        <li
                          key={sub.id}
                          className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-zinc-800">
                            {sub.name}
                          </p>
                          <p className="text-xs text-zinc-500">{sub.id}</p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-zinc-500">No sub-services yet.</p>
                  )}
                </div>
              </>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end border-t border-zinc-100 px-6 py-4">
            <Button onClick={() => setViewOpen(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete service"
        description="Delete this service and all its sub-services? This action cannot be undone."
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
              <span className="font-medium text-zinc-800">Service:</span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
