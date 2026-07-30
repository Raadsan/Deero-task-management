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
  recordInstallmentPayment,
} from "@/lib/apis/billingApi";
import {
  dashboardCardClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { AlertCircle, CheckCircle2, Clock, DollarSign, WalletCards } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { mutate } from "swr";

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
  if (status === "PAID") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "PARTIAL") {
    return "bg-blue-100 text-blue-800";
  }
  if (status === "OVERDUE") {
    return "bg-red-100 text-red-800";
  }
  return "bg-amber-100 text-amber-800";
}

type SummaryProps = {
  summary?: {
    total: number;
    paid: number;
    unpaid: number;
    partial: number;
    totalDue: number;
    totalPaid: number;
    totalBalance: number;
  };
};

export function InstallmentSummaryCards({ summary }: SummaryProps) {
  if (!summary) return null;

  const cards = [
    {
      label: "Total bills",
      value: summary.total,
      icon: WalletCards,
      color: "bg-zinc-50 text-zinc-700",
    },
    {
      label: "Paid",
      value: summary.paid,
      icon: CheckCircle2,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Unpaid",
      value: summary.unpaid,
      icon: AlertCircle,
      color: "bg-amber-50 text-amber-700",
    },
    {
      label: "Partial",
      value: summary.partial,
      icon: Clock,
      color: "bg-blue-50 text-blue-700",
    },
    {
      label: "Collected",
      value: `$${summary.totalPaid.toFixed(2)}`,
      icon: DollarSign,
      color: "bg-emerald-50 text-emerald-700",
    },
    {
      label: "Outstanding",
      value: `$${summary.totalBalance.toFixed(2)}`,
      icon: AlertCircle,
      color: "bg-red-50 text-red-700",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={cn(dashboardCardClass, "flex items-center gap-3 p-4")}>
            <div className={cn("rounded-full p-2.5", card.color)}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <p className={dashboardTextSecondary}>{card.label}</p>
              <p className={cn("text-xl font-bold", dashboardTextPrimary)}>{card.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type TableProps = {
  rows: ClientInstallmentRow[];
  swrKey?: unknown[];
  showRecordPayment?: boolean;
  emptyMessage?: string;
};

export default function ClientInstallmentsTable({
  rows,
  swrKey,
  showRecordPayment = true,
  emptyMessage = "No payment records for this view.",
}: TableProps) {
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
    if (swrKey) mutate(swrKey);
  };

  return (
    <>
      <div className={dashboardTableWrapClass}>
        <Table>
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
            {rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={showRecordPayment ? 8 : 7}
                  className="py-10 text-center text-zinc-500"
                >
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
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
                <p className="mt-1 text-xs text-zinc-500">
                  Partial payments are supported — remaining balance stays unpaid.
                </p>
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

export function ClientPaymentHistoryPanel({
  clientId,
}: {
  clientId: string;
}) {
  // Lazy-loaded via parent SWR — placeholder export for client detail views
  return null;
}
