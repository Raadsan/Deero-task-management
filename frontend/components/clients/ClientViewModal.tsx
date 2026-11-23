"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getClientById } from "@/lib/apis/clientApi";
import {
  dashboardStatusBadgeClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatClientDisplayId, formatDateTime } from "@/lib/utils";
import { Mail, Phone, User } from "lucide-react";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
}

function money(value?: number | null) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(value || 0));
}

function balanceTypeLabel(value?: string | null) {
  if (value === "CUSTOMER_OWES") return "Customer Owes Us";
  if (value === "WE_OWE") return "We Owe Customer";
  return "—";
}

function OpeningBalanceDetails({
  client,
}: {
  client: {
    openingBalanceAmount?: number | null;
    openingBalanceType?: string | null;
    openingBalanceDate?: string | null;
    openingBalanceNotes?: string | null;
    currentOutstandingBalance?: number | null;
    totalInvoices?: number | null;
    totalPaymentsReceived?: number | null;
    availableAdvanceCredit?: number | null;
    previousOutstandingDebt?: number | null;
    totalOutstandingReceivable?: number | null;
    totalPayableToCustomer?: number | null;
  };
}) {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-zinc-50/70 p-4">
      <div>
        <p className="text-sm font-semibold text-zinc-800">Customer Account</p>
        <p className="text-xs text-zinc-500">
          Advance credit is money we owe the customer. Previous debt is money the customer already owes us.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <DetailRow label="Opening Balance" value={money(client.openingBalanceAmount)} />
        <DetailRow label="Balance Type" value={balanceTypeLabel(client.openingBalanceType)} />
        <DetailRow label="Opening Balance Date" value={client.openingBalanceDate} />
        <DetailRow label="Total Invoices" value={money(client.totalInvoices)} />
        <DetailRow label="Total Payments Received" value={money(client.totalPaymentsReceived)} />
        <DetailRow label="Available Advance Credit" value={money(client.availableAdvanceCredit)} />
        <DetailRow label="Previous Outstanding Debt" value={money(client.previousOutstandingDebt)} />
        <DetailRow label="Total Outstanding Receivable" value={money(client.totalOutstandingReceivable)} />
        <DetailRow label="Total Payable to Customer" value={money(client.totalPayableToCustomer)} />
        <DetailRow label="Total Outstanding Balance" value={money(client.currentOutstandingBalance)} />
      </div>
      {client.openingBalanceNotes ? <DetailRow label="Opening Balance Notes" value={client.openingBalanceNotes} /> : null}
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
  <div className="rounded-lg border border-zinc-100 bg-zinc-50/80 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-zinc-800">{value?.trim() || "—"}</p>
    </div>
  );
}

export default function ClientViewModal({ open, onOpenChange, clientId }: Props) {
  const { data, isLoading } = useSWR(
    open && clientId ? ["client-view-modal", clientId] : null,
    () => getClientById(clientId!),
  );

  const client = data?.data as unknown as
    | (Record<string, unknown> & {
        institution?: string;
        contactPerson?: string;
        phone?: string;
        alternativePhone?: string;
        email?: string;
        address?: string;
        notes?: string;
        openingBalanceAmount?: number | null;
        openingBalanceType?: string | null;
        openingBalanceDate?: string | null;
        openingBalanceNotes?: string | null;
        currentOutstandingBalance?: number | null;
        totalInvoices?: number | null;
        totalPaymentsReceived?: number | null;
        availableAdvanceCredit?: number | null;
        previousOutstandingDebt?: number | null;
        isActive?: boolean;
        clientCode?: string;
        id?: string;
        createdAt?: string;
        rawCreatedAt?: string;
        createdBy?: { name?: string };
        createdByName?: string;
      })
    | undefined;

  const statusLabel = client?.isActive === false ? "Inactive" : "Active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-[#1e293b]">
                {client?.institution || "Client Details"}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Client ID: {client ? formatClientDisplayId(client) : clientId}
              </DialogDescription>
            </div>
            {client ? (
              <span
                className={cn(
                  dashboardStatusBadgeClass,
                  getTaskStatusBadgeClass(client.isActive === false ? "inactive" : "active"),
                )}
              >
                {formatStatusLabel(statusLabel)}
              </span>
            ) : null}
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : client ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <DetailRow label="Client ID" value={formatClientDisplayId(client)} />
                <DetailRow label="Client Name" value={client.institution} />
                <DetailRow label="Contact Person" value={client.contactPerson} />
                <DetailRow label="Phone Number" value={client.phone} />
                <DetailRow label="Alternative Phone" value={client.alternativePhone} />
                <DetailRow label="Email Address" value={client.email} />
                <DetailRow
                  label="Created At"
                  value={formatDateTime(
                    (client.rawCreatedAt ?? client.createdAt) as string | undefined,
                  )}
                />
                <DetailRow
                  label="Created By"
                  value={client.createdBy?.name ?? client.createdByName ?? "—"}
                />
              </div>

              <DetailRow label="Address" value={client.address} />
              <DetailRow label="Notes" value={client.notes} />
              <OpeningBalanceDetails client={client} />

              <div className="flex flex-wrap gap-3 pt-2 text-sm text-zinc-600">
                {client.contactPerson ? (
                  <span className="inline-flex items-center gap-1.5">
                    <User className="size-4 text-zinc-400" />
                    {client.contactPerson}
                  </span>
                ) : null}
                {client.phone ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-4 text-zinc-400" />
                    {client.phone}
                  </span>
                ) : null}
                {client.email ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="size-4 text-zinc-400" />
                    {client.email}
                  </span>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-center text-sm text-muted-foreground">Client not found.</p>
          )}
        </div>

        <div className="flex justify-end border-t border-zinc-100 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
