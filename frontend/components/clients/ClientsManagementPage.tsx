"use client";

import ClientCompleteServiceModal from "@/components/clients/ClientCompleteServiceModal";
import ClientFormModal from "@/components/clients/ClientFormModal";
import ClientViewModal from "@/components/clients/ClientViewModal";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
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
import { deleteClientById, updateClientServiceStatus } from "@/lib/actions/client.action";
import { getAllClientsClient } from "@/lib/client-read-api";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
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
import { cn, formatTexts } from "@/lib/utils";
import { AllClients } from "@/lib/types";
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import useSWR, { useSWRConfig } from "swr";
import toast from "react-hot-toast";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

type ClientAgreementStatus = {
  agreementId: string;
  serviceName: string;
  subServiceName: string;
  serviceStatus: "pending" | "completed";
  portfolioId?: string | null;
  branchName?: string;
};

function filterAgreements(
  agreements: ClientAgreementStatus[],
  statusFilter: string,
  branchFilter: string,
) {
  return agreements.filter((agreement) => {
    if (branchFilter !== "all" && agreement.portfolioId !== branchFilter) {
      return false;
    }
    if (statusFilter === "pending" && agreement.serviceStatus !== "pending") {
      return false;
    }
    if (statusFilter === "completed" && agreement.serviceStatus !== "completed") {
      return false;
    }
    return true;
  });
}

function AgreementStack({
  agreements,
  renderItem,
}: {
  agreements: ClientAgreementStatus[];
  renderItem: (agreement: ClientAgreementStatus) => ReactNode;
}) {
  if (!agreements.length) {
    return <span className={dashboardTextSecondary}>—</span>;
  }

  return (
    <div className="flex flex-col gap-2">
      {agreements.map((agreement) => (
        <div key={agreement.agreementId} className="min-h-8 flex items-center">
          {renderItem(agreement)}
        </div>
      ))}
    </div>
  );
}

function ClientServiceStatusCell({
  agreements,
  onMarkComplete,
  updatingId,
}: {
  agreements: ClientAgreementStatus[];
  onMarkComplete: (agreement: ClientAgreementStatus) => void;
  updatingId?: string;
}) {
  return (
    <AgreementStack
      agreements={agreements}
      renderItem={(agreement) =>
        agreement.serviceStatus === "completed" ? (
          <span
            className={cn(
              dashboardStatusBadgeClass,
              getTaskStatusBadgeClass("completed"),
            )}
          >
            Complete
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={updatingId === agreement.agreementId}
            onClick={() => onMarkComplete(agreement)}
            className={cn(
              "h-8 px-3 text-[11px] font-bold uppercase tracking-wider",
              dashboardStatusBadgeClass,
              getTaskStatusBadgeClass("pending"),
            )}
          >
            Pending
          </Button>
        )
      }
    />
  );
}

export default function ClientsManagementPage() {
  const { data: clientsRes, isLoading, mutate } = useSWR(
    SWR_CACH_KEYS.clients.key,
    getAllClientsClient,
  );
  const { mutate: globalMutate } = useSWRConfig();
  const [updatingAgreementId, setUpdatingAgreementId] = useState<string>();
  const [isUpdatingStatus, startStatusUpdate] = useTransition();
  const [completeTarget, setCompleteTarget] = useState<{
    clientName: string;
    agreement: ClientAgreementStatus;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const { data: branchOptionsRes } = useSWR(
    "client-list-portfolios",
    getTaskFormBranchOptions,
  );
  const branchOptions = branchOptionsRes?.data?.portfolios ?? [];
  const singleBranch = branchOptionsRes?.data?.singleBranch ?? false;

  const clients = (clientsRes?.data as AllClients[]) ?? [];

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingClientId, setEditingClientId] = useState<string | undefined>();
  const [draftClientId, setDraftClientId] = useState<string | undefined>();
  const [viewClientId, setViewClientId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);

  const filteredClients = useMemo(() => {
    const query = search.toLowerCase();
    return clients.filter((client) => {
      const institution = client.institution?.toLowerCase() ?? "";
      const email = client.email?.toLowerCase() ?? "";
      const phone = client.phone?.toLowerCase() ?? "";
      const clientId = String(client.id ?? "").toLowerCase();
      const isDraft = Boolean((client as AllClients).isDraft);
      const agreements = (client as AllClients).serviceAgreements ?? [];
      const visibleAgreements = filterAgreements(
        agreements,
        statusFilter,
        branchFilter,
      );

      const matchesSearch =
        !query ||
        institution.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        clientId.includes(query);

      if (isDraft) {
        return (
          matchesSearch &&
          (statusFilter === "all" || statusFilter === "draft") &&
          (branchFilter === "all" || (client as AllClients & { portfolioId?: string }).portfolioId === branchFilter)
        );
      }

      const matchesFilters =
        (statusFilter === "all" && branchFilter === "all") ||
        visibleAgreements.length > 0;

      return matchesSearch && matchesFilters;
    });
  }, [clients, search, statusFilter, branchFilter]);

  useEffect(() => {
    if (branchOptionsRes?.data?.defaultBranchId && singleBranch) {
      setBranchFilter(branchOptionsRes.data.defaultBranchId);
    }
  }, [branchOptionsRes?.data?.defaultBranchId, singleBranch]);

  const totalPages = Math.ceil(filteredClients.length / pageSize) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, statusFilter, branchFilter]);

  const deleteDescription = formatTexts({
    type: "clients",
    formatType: "description",
  });
  const deleteDialogTitle = formatTexts({
    type: "clients",
    formatType: "diaglog",
  });

  function openCreateModal() {
    setFormMode("create");
    setEditingClientId(undefined);
    setDraftClientId(undefined);
    setFormOpen(true);
  }

  function openContinueDraft(clientId: string) {
    setFormMode("create");
    setEditingClientId(undefined);
    setDraftClientId(clientId);
    setFormOpen(true);
  }

  function openEditModal(clientId: string) {
    setFormMode("edit");
    setEditingClientId(clientId);
    setDraftClientId(undefined);
    setFormOpen(true);
  }

  function openViewModal(clientId: string) {
    setViewClientId(clientId);
    setViewOpen(true);
  }

  function openCompleteModal(
    clientName: string,
    agreement: ClientAgreementStatus,
  ) {
    setCompleteTarget({ clientName, agreement });
  }

  function confirmMarkComplete() {
    if (!completeTarget) return;

    startStatusUpdate(async () => {
      setUpdatingAgreementId(completeTarget.agreement.agreementId);
      const result = await updateClientServiceStatus({
        agreementId: completeTarget.agreement.agreementId,
        serviceStatus: "completed",
      });
      setUpdatingAgreementId(undefined);

      if (result.success) {
        toast.success("Service marked as complete");
        setCompleteTarget(null);
        await mutate();
        await globalMutate(SWR_CACH_KEYS.clients.key);
        return;
      }
      toast.error(result.errors?.message ?? "Failed to update service status");
    });
  }

  function confirmDeleteClient() {
    if (!deleteTarget) return;

    startDelete(async () => {
      const result = await deleteClientById(deleteTarget.id);

      if (result.success) {
        toast.success("Successfully deleted the client");
        setDeleteTarget(null);
        await mutate();
        await globalMutate(SWR_CACH_KEYS.clients.key);
        return;
      }
      toast.error(
        result.errors?.message || "Failed to delete the client. Please try again.",
      );
    });
  }

  return (
    <ManagementPageShell title="Clients management">
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
              <option value="all">All statuses</option>
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="completed">Complete</option>
            </select>
          </div>

          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Portfolio</span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              disabled={singleBranch}
              className={cn("min-w-[9rem]", compactSelectClass)}
            >
              <option value="all">All portfolios</option>
              {branchOptions.map((portfolio) => (
                <option key={portfolio.id} value={portfolio.id}>
                  {portfolio.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search clients..."
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
            Create Client
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
                    Client Name
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Service
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Sub Service
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Email
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Phone
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Created At
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
                      {[...Array(9)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedClients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClients.map((client) => {
                    const allAgreements =
                      (client as AllClients).serviceAgreements ?? [];
                    const serviceAgreements = filterAgreements(
                      allAgreements,
                      statusFilter,
                      branchFilter,
                    );

                    const isDraft = Boolean((client as AllClients).isDraft);
                    const displayEmail =
                      client.email?.includes("@deero.internal") ? "—" : client.email;
                    const displayPhone =
                      client.phone?.startsWith("DRAFT") ? "—" : client.phone;

                    return (
                      <TableRow key={client.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(client.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <div>
                            <span className={dashboardTextPrimary}>
                              {client.institution}
                            </span>
                            {(client as AllClients).clientType ? (
                              <span className="mt-0.5 block text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                                {String((client as AllClients).clientType).replace(/_/g, " ")}
                              </span>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <AgreementStack
                            agreements={serviceAgreements}
                            renderItem={(agreement) => (
                              <span className={dashboardTextPrimary}>
                                {agreement.serviceName || "—"}
                              </span>
                            )}
                          />
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <AgreementStack
                            agreements={serviceAgreements}
                            renderItem={(agreement) => (
                              <span className={dashboardTextSecondary}>
                                {agreement.subServiceName || "—"}
                              </span>
                            )}
                          />
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{displayEmail}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{displayPhone}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {client.createdAt ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          {isDraft ? (
                            <span
                              className={cn(
                                dashboardStatusBadgeClass,
                                "bg-zinc-100 text-zinc-600",
                              )}
                            >
                              Draft
                            </span>
                          ) : (
                            <ClientServiceStatusCell
                              agreements={serviceAgreements}
                              updatingId={
                                isUpdatingStatus ? updatingAgreementId : undefined
                              }
                              onMarkComplete={(agreement) =>
                                openCompleteModal(client.institution, agreement)
                              }
                            />
                          )}
                        </TableCell>
                        <TableCell
                          className={cn(dashboardTableCellClass, "text-right")}
                        >
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(String(client.id))}
                              className={actionBtnView}
                            >
                              <Eye className="size-4" />
                            </Button>
                            {isDraft ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openContinueDraft(String(client.id))}
                                className={actionBtnEdit}
                              >
                                Continue
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditModal(String(client.id))}
                                className={actionBtnEdit}
                              >
                                <Edit className="size-4" />
                              </Button>
                            )}
                            {client.id && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setDeleteTarget({
                                    id: String(client.id),
                                    name: client.institution,
                                  })
                                }
                                className={actionBtnDelete}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filteredClients.length === 0
              ? "0 of 0"
              : `${Math.min(filteredClients.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filteredClients.length, currentPage * pageSize)} of ${filteredClients.length}`}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md px-3 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md px-3 py-1.5 font-medium text-zinc-600 transition-colors hover:bg-zinc-100 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <ClientFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        clientId={editingClientId}
        draftClientId={draftClientId}
      />

      <ClientViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        clientId={viewClientId}
      />

      <ClientCompleteServiceModal
        open={Boolean(completeTarget)}
        onOpenChange={(open) => {
          if (!open) setCompleteTarget(null);
        }}
        clientName={completeTarget?.clientName ?? ""}
        agreement={completeTarget?.agreement ?? null}
        loading={isUpdatingStatus}
        onConfirm={confirmMarkComplete}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteDialogTitle ?? "Delete client"}
        description={deleteDescription ?? "This action cannot be undone."}
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={confirmDeleteClient}
      >
        {deleteTarget ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p>
              <span className="font-medium text-zinc-800">Client:</span>{" "}
              {deleteTarget.name}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
