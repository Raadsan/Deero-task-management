"use client";

import AccountingPageShell from "@/components/accounting/AccountingPageShell";
import ClientFormModal from "@/components/clients/ClientFormModal";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import DashboardDataTable, { type DashboardTableColumn } from "@/components/Shared/DashboardDataTable";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteClientById } from "@/lib/apis/clientApi";
import { getAllClientsClient } from "@/lib/apis/readApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { actionBtnDelete, actionBtnEdit, actionBtnView, btnCreatePage, dashboardSelectClass } from "@/lib/dashboard-ui";
import { Edit, Eye, Plus, Trash2 } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type ClientRow = {
  id: string;
  clientCode?: string | null;
  companyName?: string | null;
  institution?: string | null;
  contactPerson?: string | null;
  phone?: string | null;
  alternativePhone?: string | null;
  email?: string | null;
  address?: string | null;
  isActive?: boolean | null;
  isDraft?: boolean | null;
  createdAt?: string | null;
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

function clientName(row: ClientRow) {
  return row.companyName || row.institution || "Client";
}

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

export default function AccountingCustomersPage() {
  const { data: clientsRes, isLoading, mutate } = useSWR(SWR_CACH_KEYS.clients.key, getAllClientsClient);
  const { mutate: globalMutate } = useSWRConfig();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sortKey, setSortKey] = useState("code");
  const [direction, setDirection] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<ClientRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingClientId, setEditingClientId] = useState<string | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ClientRow | null>(null);
  const [isDeleting, startDelete] = useTransition();
  const rows = useMemo(
    () => ((clientsRes?.data as ClientRow[] | undefined) ?? []).filter((row) => !row.isDraft),
    [clientsRes?.data],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const active = row.isActive !== false;
      if (status === "active" && !active) return false;
      if (status === "inactive" && active) return false;
      if (!needle) return true;
      return [row.clientCode, row.id, clientName(row), row.contactPerson, row.phone, row.alternativePhone, row.email, row.address]
        .some((value) => String(value || "").toLowerCase().includes(needle));
    });
    const value = (row: ClientRow) => {
      if (sortKey === "name") return clientName(row);
      if (sortKey === "code") return row.clientCode || row.id;
      if (sortKey === "contact") return row.contactPerson || "";
      if (sortKey === "phone") return row.phone || "";
      if (sortKey === "email") return row.email || "";
      if (sortKey === "balanceType") return balanceTypeLabel(row.openingBalanceType);
      return row.clientCode || row.id;
    };
    const factor = direction === "asc" ? 1 : -1;
    if (sortKey === "opening") {
      return [...filtered].sort((left, right) => (Number(left.openingBalanceAmount || 0) - Number(right.openingBalanceAmount || 0)) * factor);
    }
    return [...filtered].sort((left, right) => String(value(left)).localeCompare(String(value(right))) * factor);
  }, [direction, query, rows, sortKey, status]);

  function openCreate() {
    setFormMode("create");
    setEditingClientId(undefined);
    setFormOpen(true);
  }

  function openEdit(row: ClientRow) {
    setFormMode("edit");
    setEditingClientId(row.id);
    setFormOpen(true);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    startDelete(async () => {
      const result = await deleteClientById(deleteTarget.id);
      if (result.success) {
        toast.success("Client deleted successfully");
        setDeleteTarget(null);
        if (selected?.id === deleteTarget.id) setSelected(null);
        await mutate();
        await globalMutate(SWR_CACH_KEYS.clients.key);
        return;
      }
      toast.error(result.errors?.message || "Failed to delete the client. Please try again.");
    });
  }

  function sortBy(key: string) {
    setDirection((current) => (sortKey === key && current === "asc" ? "desc" : "asc"));
    setSortKey(key);
  }

  function heading(key: string, label: string) {
    return (
      <button type="button" className="uppercase" onClick={() => sortBy(key)}>
        {label}{sortKey === key ? (direction === "asc" ? " ↑" : " ↓") : ""}
      </button>
    );
  }

  const columns: DashboardTableColumn<ClientRow>[] = [
    { key: "code", header: heading("code", "Client ID"), cell: (row) => <span className="font-bold text-primary">{row.clientCode || row.id}</span> },
    { key: "name", header: heading("name", "Client Name"), cell: (row) => <span className="font-semibold text-zinc-900">{clientName(row)}</span> },
    { key: "contact", header: heading("contact", "Contact Person"), cell: (row) => text(row.contactPerson) },
    { key: "phone", header: heading("phone", "Phone"), cell: (row) => text(row.phone) },
    { key: "email", header: heading("email", "Email"), cell: (row) => text(row.email) },
    { key: "balanceType", header: heading("balanceType", "Balance Type"), cell: (row) => balanceTypeLabel(row.openingBalanceType) },
    { key: "opening", header: heading("opening", "Opening Balance"), align: "right", cell: (row) => money(row.openingBalanceAmount) },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex justify-end gap-2">
          <button type="button" className={actionBtnView} aria-label="View customer" onClick={() => setSelected(row)}>
            <Eye className="size-4" />
          </button>
          <button type="button" className={actionBtnEdit} aria-label="Edit customer" onClick={() => openEdit(row)}>
            <Edit className="size-4" />
          </button>
          <button type="button" className={actionBtnDelete} aria-label="Delete customer" onClick={() => setDeleteTarget(row)}>
            <Trash2 className="size-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AccountingPageShell title="Customers" description="Clients registered in Client Management. This page reads the same clients table.">
      <DashboardDataTable
        rows={visible}
        columns={columns}
        loading={isLoading}
        action={(
          <button type="button" onClick={openCreate} className={btnCreatePage}>
            <Plus className="size-4" /> Add client
          </button>
        )}
        searchValue={query}
        onSearchChange={setQuery}
        searchPlaceholder="Search clients..."
        emptyText="No clients found"
        minWidth="1100px"
        filters={(
          <select value={status} onChange={(event) => setStatus(event.target.value)} className={dashboardSelectClass}>
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        )}
      />
      <ClientFormModal open={formOpen} onOpenChange={setFormOpen} mode={formMode} clientId={editingClientId} />
      <Dialog open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected ? clientName(selected) : "Customer"}</DialogTitle>
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {[
                ["Client ID", selected.clientCode || selected.id],
                ["Contact person", text(selected.contactPerson)],
                ["Phone", text(selected.phone)],
                ["Alternative phone", text(selected.alternativePhone)],
                ["Email", text(selected.email)],
                ["Status", selected.isActive === false ? "Inactive" : "Active"],
                ["Opening balance", money(selected.openingBalanceAmount)],
                ["Balance type", balanceTypeLabel(selected.openingBalanceType)],
                ["Opening balance date", text(selected.openingBalanceDate)],
                ["Current outstanding balance", money(selected.currentOutstandingBalance)],
                ["Total invoices", money(selected.totalInvoices)],
                ["Total payments received", money(selected.totalPaymentsReceived)],
                ["Available advance credit", money(selected.availableAdvanceCredit)],
                ["Previous outstanding debt", money(selected.previousOutstandingDebt)],
                ["Total outstanding receivable", money(selected.totalOutstandingReceivable)],
                ["Total payable to customer", money(selected.totalPayableToCustomer)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-zinc-500">{label}</dt>
                  <dd className="mt-1 font-medium text-zinc-900">{value}</dd>
                </div>
              ))}
              <div className="col-span-2">
                <dt className="text-xs text-zinc-500">Address</dt>
                <dd className="mt-1 font-medium text-zinc-900">{text(selected.address)}</dd>
              </div>
            </dl>
            <p className="text-xs text-zinc-500">
              Advance credit is money we owe the customer. Previous debt is money the customer already owes us. They are kept separate from new contract invoices.
            </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete client"
        description="This client is removed from Client Management and Customers."
        confirmLabel="Delete"
        destructive
        loading={isDeleting}
        onConfirm={confirmDelete}
      >
        {deleteTarget ? (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3">
            <p>
              <span className="font-medium text-zinc-800">Client:</span> {clientName(deleteTarget)}
            </p>
          </div>
        ) : null}
      </ConfirmDialog>
    </AccountingPageShell>
  );
}
