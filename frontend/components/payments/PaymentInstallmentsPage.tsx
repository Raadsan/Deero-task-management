"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClientInstallmentRow,
  getInstallments,
  recordInstallmentPayment,
} from "@/lib/apis/billingApi";
import {
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "PAID", label: "Paid" },
  { value: "PARTIAL", label: "Partial" },
  { value: "PENDING", label: "Unpaid" },
  { value: "OVERDUE", label: "Overdue" },
] as const;

function statusLabel(status: ClientInstallmentRow["status"]) {
  switch (status) {
    case "PAID":
      return "Paid";
    case "PARTIAL":
      return "Partial";
    case "OVERDUE":
      return "Overdue";
    default:
      return "Unpaid";
  }
}

function statusClass(status: ClientInstallmentRow["status"]) {
  if (status === "PAID") return "bg-emerald-100 text-emerald-800";
  if (status === "PARTIAL") return "bg-blue-100 text-blue-800";
  if (status === "OVERDUE") return "bg-red-100 text-red-800";
  return "bg-amber-100 text-amber-800";
}

type PaymentInstallmentsPageProps = {
  /** all = every bill; paid = paid bills only by default */
  mode: "all" | "paid";
  emptyMessage?: string;
};

export default function PaymentInstallmentsPage({
  mode,
  emptyMessage = "No payment records found.",
}: PaymentInstallmentsPageProps) {
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(
    mode === "paid" ? "PAID" : "all",
  );

  const swrKey = ["installments-table", mode];
  const { data, isLoading, mutate: refresh } = useSWR(swrKey, () =>
    getInstallments({ tab: mode === "paid" ? "paid" : undefined }),
  );

  const rows = data?.data?.rows ?? [];

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase();
    return rows.filter((row) => {
      if (statusFilter !== "all") {
        if (statusFilter === "PARTIAL") {
          if (!(row.paidAmount > 0 && row.status !== "PAID")) return false;
        } else if (row.status !== statusFilter) {
          return false;
        }
      }

      const due = new Date(row.dueDate).getTime();
      if (startDate && due < new Date(startDate).getTime()) return false;
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (due > end.getTime()) return false;
      }

      if (!query) return true;
      return [row.clientName, row.contractNumber, row.periodLabel, row.status]
        .some((v) => String(v || "").toLowerCase().includes(query));
    });
  }, [rows, search, startDate, endDate, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, startDate, endDate, statusFilter]);

  const [selected, setSelected] = useState<ClientInstallmentRow | null>(null);
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const openPayment = (row: ClientInstallmentRow) => {
    setSelected(row);
    setAmount(String(row.balance > 0 ? row.balance : row.dueAmount));
    setNotes("");
  };

  const handleRecordPayment = async () => {
    if (!selected) return;
    const parsed = Number(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }

    setSubmitting(true);
    const result = await recordInstallmentPayment({
      installmentId: selected.id,
      amount: parsed,
      notes: notes.trim() || undefined,
    });
    setSubmitting(false);

    if (!result.success) {
      toast.error(result.errors?.message ?? "Failed to record payment");
      return;
    }

    toast.success("Payment recorded");
    setSelected(null);
    refresh();
  };

  const showRecordPayment = mode === "all";

  return (
    <>
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
            <span>entries</span>
          </div>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={cn(compactInputClass, "w-36")}
            title="From date"
          />
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={cn(compactInputClass, "w-36")}
            title="To date"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={cn(compactSelectClass, "min-w-[130px]")}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search client, period…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(compactInputClass, "w-full pl-9")}
            />
          </div>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={dashboardTableHeadClass}>Client</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Period</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Due</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Paid</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Balance</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Due date</TableHead>
                  <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                  {showRecordPayment && (
                    <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                      Actions
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(showRecordPayment ? 8 : 7)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedRows.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={showRecordPayment ? 8 : 7}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      {emptyMessage}
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedRows.map((row) => (
                    <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={cn(dashboardTableCellClass, dashboardTextPrimary)}>
                        <div>
                          <p className="font-medium">{row.clientName}</p>
                          {row.contractNumber && (
                            <p className="text-xs text-zinc-500">{row.contractNumber}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>{row.periodLabel}</TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        ${row.dueAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        ${row.paidAmount.toFixed(2)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        ${row.balance.toFixed(2)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {formatDate(row.dueDate)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={cn(dashboardStatusBadgeClass, statusClass(row.status))}>
                          {statusLabel(row.status)}
                        </span>
                      </TableCell>
                      {showRecordPayment && (
                        <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                          {row.status !== "PAID" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openPayment(row)}
                            >
                              Record payment
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filteredRows.length === 0
              ? "0 of 0"
              : `${Math.min(filteredRows.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filteredRows.length, currentPage * pageSize)} of ${filteredRows.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded border border-zinc-200 px-3 py-1 text-sm disabled:opacity-40"
            >
              Prev
            </button>
            <span className="px-2 text-sm text-zinc-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-zinc-200 px-3 py-1 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-zinc-50 p-3 text-sm">
                <p className="font-medium">{selected.clientName}</p>
                <p className="text-zinc-500">
                  {selected.periodLabel} · Balance ${selected.balance.toFixed(2)}
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Amount</label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Notes (optional)</label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelected(null)}>
              Cancel
            </Button>
            <Button
              className="bg-dark-red text-white"
              disabled={submitting}
              onClick={handleRecordPayment}
            >
              {submitting ? "Saving…" : "Save payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
