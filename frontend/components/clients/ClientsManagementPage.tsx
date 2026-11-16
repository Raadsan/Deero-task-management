"use client";

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
import { deleteClientById } from "@/lib/apis/clientApi";
import { getAllClientsClient } from "@/lib/apis/readApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableIdClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn, formatClientDisplayId, formatTexts } from "@/lib/utils";
import { AllClients } from "@/lib/types";
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import useSWR, { useSWRConfig } from "swr";
import toast from "react-hot-toast";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

function text(value?: string | null) {
  const trimmed = String(value || "").trim();
  return trimmed || "—";
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function balanceTypeLabel(value?: string | null) {
  if (value === "CUSTOMER_OWES") return "Customer Owes Us";
  if (value === "WE_OWE") return "We Owe Customer";
  return "—";
}

export default function ClientsManagementPage() {
  const { data: clientsRes, isLoading, mutate } = useSWR(
    SWR_CACH_KEYS.clients.key,
    getAllClientsClient,
  );
  const { mutate: globalMutate } = useSWRConfig();

  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, startDelete] = useTransition();

  const clients = useMemo(() => {
    return ((clientsRes?.data as AllClients[]) ?? []).filter((c) => !c.isDraft);
  }, [clientsRes?.data]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingClientId, setEditingClientId] = useState<string | undefined>();
  const [viewClientId, setViewClientId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      const clientName = client.institution?.toLowerCase() ?? "";
      const contactPerson = (client as AllClients & { contactPerson?: string }).contactPerson?.toLowerCase() ?? "";
      const email = client.email?.toLowerCase() ?? "";
      const phone = client.phone?.toLowerCase() ?? "";
      const clientCode = formatClientDisplayId(client).toLowerCase();
      const internalId = String(client.id ?? "").toLowerCase();

      const matchesSearch =
        !query ||
        clientName.includes(query) ||
        contactPerson.includes(query) ||
        email.includes(query) ||
        phone.includes(query) ||
        clientCode.includes(query) ||
        internalId.includes(query);

      const isActive = client.isActive !== false;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && isActive) ||
        (statusFilter === "inactive" && !isActive);

      return matchesSearch && matchesStatus;
    });
  }, [clients, search, statusFilter]);

  const totalPages = Math.ceil(filteredClients.length / pageSize) || 1;
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredClients.slice(start, start + pageSize);
  }, [filteredClients, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, statusFilter]);

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
    setFormOpen(true);
  }

  function openEditModal(clientId: string) {
    setFormMode("edit");
    setEditingClientId(clientId);
    setFormOpen(true);
  }

  function openViewModal(clientId: string) {
    setViewClientId(clientId);
    setViewOpen(true);
  }

  function confirmDeleteClient() {
    if (!deleteTarget) return;

    startDelete(async () => {
      const result = await deleteClientById(deleteTarget.id);

      if (result.success) {
        toast.success("Client deleted successfully");
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
              placeholder="Search ID, name, contact, phone…"
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
                  {[
                    "Client ID",
                    "Client Name",
                    "Contact Person",
                    "Phone",
                    "Email",
                    "Balance Type",
                  ].map((heading) => (
                    <TableHead key={heading} className={cn(dashboardTableHeadClass, "text-left")}>
                      {heading}
                    </TableHead>
                  ))}
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Opening Balance</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedClients.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No clients found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedClients.map((client) => {
                    return (
                      <TableRow key={client.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardTableIdClass, "whitespace-nowrap")}>
                            {formatClientDisplayId(client)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>{client.institution || "—"}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>
                            {text((client as AllClients & { contactPerson?: string }).contactPerson)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{text(client.phone)}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{text(client.email)}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>{balanceTypeLabel(client.openingBalanceType)}</span>
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <span className={dashboardTextPrimary}>{money(client.openingBalanceAmount)}</span>
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
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
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(String(client.id))}
                              className={actionBtnEdit}
                            >
                              <Edit className="size-4" />
                            </Button>
                            {client.id ? (
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
                            ) : null}
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
      />

      <ClientViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        clientId={viewClientId}
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
