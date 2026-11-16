"use client";

import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ServiceFormModal from "@/components/services/ServiceFormModal";
import ServiceViewModal from "@/components/services/ServiceViewModal";
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
  deleteService,
  getAllServices,
  ServiceRecord,
  updateMainService,
} from "@/lib/apis/serviceApi";
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
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatServiceDisplayId, formatTexts } from "@/lib/utils";
import { Ban, CheckCircle2, Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import useSWR, { useSWRConfig } from "swr";
import toast from "react-hot-toast";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export default function ServicesManagementPage() {
  const { data: servicesRes, isLoading, mutate } = useSWR(
    SWR_CACH_KEYS.services.key,
    getAllServices,
  );
  const { mutate: globalMutate } = useSWRConfig();

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const [statusToggleTarget, setStatusToggleTarget] = useState<ServiceRecord | null>(null);
  const [isToggling, startToggle] = useTransition();

  const services = useMemo(
    () => ((servicesRes?.data as ServiceRecord[]) ?? []).filter((s) => s.source !== "LEGACY"),
    [servicesRes?.data],
  );

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingServiceId, setEditingServiceId] = useState<string | undefined>();
  const [viewServiceId, setViewServiceId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);

  const filteredServices = useMemo(() => {
    const query = search.trim().toLowerCase();
    return services.filter((service) => {
      const serviceCode = formatServiceDisplayId(service).toLowerCase();
      const serviceName = service.serviceName?.toLowerCase() ?? "";
      const description = service.description?.toLowerCase() ?? "";

      const matchesSearch =
        !query ||
        serviceCode.includes(query) ||
        serviceName.includes(query) ||
        description.includes(query);

      const isActive = service.isActive !== false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [services, search, statusFilter]);

  const totalPages = Math.ceil(filteredServices.length / pageSize) || 1;
  const paginatedServices = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredServices.slice(start, start + pageSize);
  }, [filteredServices, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, statusFilter]);

  const deleteDescription = formatTexts({
    type: "services",
    formatType: "description",
  });
  const deleteDialogTitle = formatTexts({
    type: "services",
    formatType: "diaglog",
  });

  function openCreateModal() {
    setFormMode("create");
    setEditingServiceId(undefined);
    setFormOpen(true);
  }

  function openEditModal(serviceId: string) {
    setFormMode("edit");
    setEditingServiceId(serviceId);
    setFormOpen(true);
  }

  function openViewModal(serviceId: string) {
    setViewServiceId(serviceId);
    setViewOpen(true);
  }

  function confirmDeleteService() {
    if (!deleteTarget) return;

    startDelete(async () => {
      const result = await deleteService(deleteTarget.id);

      if (result.success) {
        toast.success("Service deleted successfully");
        setDeleteTarget(null);
        await mutate();
        await globalMutate(SWR_CACH_KEYS.services.key);
        return;
      }
      toast.error(
        result.errors?.message || "Failed to delete the service. Please try again.",
      );
    });
  }

  function confirmToggleStatus() {
    if (!statusToggleTarget) return;

    const nextActive = statusToggleTarget.isActive === false;
    startToggle(async () => {
      const result = await updateMainService(statusToggleTarget.id, {
        serviceName: statusToggleTarget.serviceName,
        description: statusToggleTarget.description ?? undefined,
        isActive: nextActive,
      });

      if (result.success) {
        toast.success(nextActive ? "Service activated" : "Service deactivated");
        setStatusToggleTarget(null);
        await mutate();
        await globalMutate(SWR_CACH_KEYS.services.key);
        return;
      }
      toast.error(result.errors?.message || "Could not update service status.");
    });
  }

  return (
    <ManagementPageShell title="Services management">
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

          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("min-w-[7rem]", compactSelectClass)}
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-64">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search ID or service name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          <Button
            type="button"
            onClick={openCreateModal}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            Create Service
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  {["Service ID", "Service Name", "Description", "Status"].map((heading) => (
                    <TableHead key={heading} className={cn(dashboardTableHeadClass, "text-left")}>
                      {heading}
                    </TableHead>
                  ))}
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(5)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedServices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No services found. Register your first main service to get started.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedServices.map((service) => {
                    const isActive = service.isActive !== false;
                    return (
                      <TableRow key={service.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardTableIdClass, "whitespace-nowrap")}>
                            {formatServiceDisplayId(service)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>{service.serviceName}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardTextSecondary, "line-clamp-2 max-w-md")}>
                            {service.description?.trim() || "—"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              getTaskStatusBadgeClass(isActive ? "active" : "inactive"),
                            )}
                          >
                            {formatStatusLabel(isActive ? "Active" : "Inactive")}
                          </span>
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(service.id)}
                              className={actionBtnView}
                              title="View"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(service.id)}
                              className={actionBtnEdit}
                              title="Edit"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setStatusToggleTarget(service)}
                              className={actionBtnEdit}
                              title={isActive ? "Deactivate" : "Activate"}
                            >
                              {isActive ? (
                                <Ban className="size-4 text-amber-600" />
                              ) : (
                                <CheckCircle2 className="size-4 text-emerald-600" />
                              )}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteTarget({
                                  id: service.id,
                                  name: service.serviceName,
                                })
                              }
                              className={actionBtnDelete}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          <div className={dashboardPaginationClass}>
            <p className="text-sm text-zinc-500">
              Showing {paginatedServices.length} of {filteredServices.length} services
            </p>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-zinc-600">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ServiceFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        serviceId={editingServiceId}
      />

      <ServiceViewModal open={viewOpen} onOpenChange={setViewOpen} serviceId={viewServiceId} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={deleteDialogTitle}
        description={
          deleteTarget
            ? `${deleteDescription} "${deleteTarget.name}"?`
            : deleteDescription
        }
        confirmLabel="Delete"
        loading={isDeleting}
        onConfirm={confirmDeleteService}
      />

      <ConfirmDialog
        open={Boolean(statusToggleTarget)}
        onOpenChange={(open) => !open && setStatusToggleTarget(null)}
        title={
          statusToggleTarget?.isActive === false ? "Activate service?" : "Deactivate service?"
        }
        description={
          statusToggleTarget
            ? statusToggleTarget.isActive === false
              ? `Activate "${statusToggleTarget.serviceName}" so it can be used in new operations.`
              : `Deactivate "${statusToggleTarget.serviceName}". It will remain in history but cannot be selected for new operations.`
            : ""
        }
        confirmLabel={statusToggleTarget?.isActive === false ? "Activate" : "Deactivate"}
        loading={isToggling}
        onConfirm={confirmToggleStatus}
      />
    </ManagementPageShell>
  );
}
