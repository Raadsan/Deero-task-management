"use client";

import DeleteAction from "@/components/Shared/DeleteAction";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ContractFormModal from "@/components/contracts/ContractFormModal";
import ContractViewModal from "@/components/contracts/ContractViewModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContractRecord, getAllContracts } from "@/lib/actions/contract.action";
import { CONTRACT_STATUS_OPTIONS } from "@/lib/client-types";
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
import { cn, formatDate, formatTexts } from "@/lib/utils";
import { Edit, Eye, FileText, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

function statusLabel(status: string) {
  return CONTRACT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
}

function statusBadgeClass(status: string) {
  switch (status) {
    case "ACTIVE":
    case "RENEWED":
      return getTaskStatusBadgeClass("completed");
    case "EXPIRED":
    case "TERMINATED":
      return getTaskStatusBadgeClass("overdue");
    default:
      return getTaskStatusBadgeClass("pending");
  }
}

export default function ContractsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingContractId, setEditingContractId] = useState<string | undefined>();
  const [viewContractId, setViewContractId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);

  const { data: contracts = [], isLoading } = useSWR(
    SWR_CACH_KEYS.contracts.key,
    async () => {
      const result = await getAllContracts();
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load");
      return result.data ?? [];
    },
  );

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return contracts.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (!query) return true;
      return (
        row.contractNumber.toLowerCase().includes(query) ||
        row.client?.institution?.toLowerCase().includes(query) ||
        row.project?.name?.toLowerCase().includes(query) ||
        String(row.id).toLowerCase().includes(query)
      );
    });
  }, [contracts, search, statusFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, pageSize]);

  const deleteDescription = formatTexts({ type: "contracts", formatType: "description" });
  const deleteDialogTitle = formatTexts({ type: "contracts", formatType: "diaglog" });

  function openCreateModal() {
    setFormMode("create");
    setEditingContractId(undefined);
    setFormOpen(true);
  }

  function openEditModal(contractId: string) {
    setFormMode("edit");
    setEditingContractId(contractId);
    setFormOpen(true);
  }

  function openViewModal(contractId: string) {
    setViewContractId(contractId);
    setViewOpen(true);
  }

  return (
    <ManagementPageShell title="Contracts management">
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
            </select>
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn("min-w-[130px]", compactSelectClass)}
          >
            <option value="all">All statuses</option>
            {CONTRACT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search contracts..."
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
            Create Contract
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>ID</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Contract #
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Client</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Project</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Period</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Amount</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Doc</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
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
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No contracts found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row: ContractRecord) => {
                    const latestDoc = row.documents?.[0];
                    return (
                      <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(row.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>{row.contractNumber}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>
                            {row.client?.institution ?? "â€”"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {row.project?.name ?? "â€”"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {row.startDate ? formatDate(String(row.startDate)) : "â€”"}
                            {row.endDate ? ` â†’ ${formatDate(String(row.endDate))}` : ""}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {row.totalAmount != null
                              ? `$${row.totalAmount.toLocaleString()}`
                              : "â€”"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              statusBadgeClass(row.status),
                            )}
                          >
                            {statusLabel(row.status)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          {latestDoc ? (
                            <span className="inline-flex items-center gap-1 text-zinc-600">
                              <FileText className="size-3.5" />
                              v{latestDoc.version}
                            </span>
                          ) : (
                            <span className={dashboardTextSecondary}>â€”</span>
                          )}
                        </TableCell>
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(row.id)}
                              className={actionBtnView}
                              title="View"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(row.id)}
                              className={actionBtnEdit}
                              title="Edit"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <DeleteAction
                              typeOfDataToDelete="contracts"
                              idToDelete={row.id}
                              description={deleteDescription ?? ""}
                              dialogTitle={deleteDialogTitle ?? "Delete Contract"}
                              triggerClassNames={actionBtnDelete}
                              trigger={<Trash2 className="size-4" />}
                            />
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

      <ContractViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        contractId={viewContractId}
      />

      <ContractFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        contractId={editingContractId}
      />
    </ManagementPageShell>
  );
}
