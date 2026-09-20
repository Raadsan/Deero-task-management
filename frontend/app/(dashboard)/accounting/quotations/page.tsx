"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { Plus, Eye, SquarePen, Trash2, Download, FileSpreadsheet, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { documentTemplateApi } from "@/lib/api/documentTemplateApi";
import QuotationModal from "@/components/quotations/QuotationModal";
import QuotationViewModal from "@/components/quotations/QuotationViewModal";
import DashboardDataTable from "@/components/Shared/DashboardDataTable";
import type { DashboardTableColumn } from "@/components/Shared/DashboardDataTable";
import AccountingPageShell from "@/components/accounting/AccountingPageShell";
import AccountingConfirmDialog from "@/components/accounting/AccountingConfirmDialog";
import { accountingToast } from "@/lib/accounting-ui";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
} from "@/lib/dashboard-ui";
import { formatDate } from "@/lib/utils";

function CustomerQuotationPageContent() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [viewQuotation, setViewQuotation] = useState<Quotation | null>(null);
  const [pendingAction, setPendingAction] = useState<
    null | { type: "accept" | "delete"; quotation: Quotation }
  >(null);
  const [actionBusy, setActionBusy] = useState(false);


  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await quotationApi.getAll(params);
      setQuotations(data || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to load quotations";
      accountingToast(message, "error");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDelete = async (quotation: Quotation) => {
    try {
      setActionBusy(true);
      await quotationApi.delete(quotation.id);
      accountingToast("Quotation deleted");
      setPendingAction(null);
      loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to delete quotation";
      accountingToast(message || "Failed to delete quotation", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const handleConvert = async (quotation: Quotation) => {
    try {
      setActionBusy(true);
      await quotationApi.accept(quotation.id);
      accountingToast(`Quotation ${quotation.quotation_number} accepted. Import it from Customer Invoices when ready.`);
      setPendingAction(null);
      loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to accept quotation";
      accountingToast(message || "Failed to accept quotation", "error");
    } finally {
      setActionBusy(false);
    }
  };

  const filtered = quotations.filter((q) => {
    const term = search.toLowerCase();
    const num = q.quotation_number.toLowerCase();
    const client = (q.client?.institution || q.customer?.name || "").toLowerCase();
    const quotationDate = String(q.date || "").slice(0, 10);
    const matchesSearch = num.includes(term) || client.includes(term);
    const matchesFrom = !dateFrom || quotationDate >= dateFrom;
    const matchesTo = !dateTo || quotationDate <= dateTo;
    return matchesSearch && matchesFrom && matchesTo;
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      DRAFT: "bg-zinc-100 text-zinc-700 border-zinc-200",
      SENT: "bg-blue-50 text-blue-700 border-blue-200",
      ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
      REJECTED: "bg-red-50 text-red-700 border-red-200",
      EXPIRED: "bg-amber-50 text-amber-700 border-amber-200",
      CONVERTED: "bg-purple-50 text-purple-700 border-purple-200",
      CANCELED: "bg-red-50 text-red-600 border-red-200",
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${map[status] || "bg-zinc-100"}`}>
        {status}
      </span>
    );
  };

  // Status modal state (Pop up caadi ah)
  const [statusModalQuotation, setStatusModalQuotation] = useState<Quotation | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>("DRAFT");
  const [statusUpdating, setStatusUpdating] = useState(false);

  const openStatusModal = (quotation: Quotation) => {
    setStatusModalQuotation(quotation);
    setSelectedStatus(quotation.status);
  };

  const handleSaveStatus = async () => {
    if (!statusModalQuotation) return;
    const quotation = statusModalQuotation;
    const newStatus = selectedStatus;

    if (newStatus === "ACCEPTED") {
      try {
        setStatusUpdating(true);
        await quotationApi.accept(quotation.id);
        accountingToast(`Quotation accepted. Import it from Customer Invoices when ready — no invoice was created yet.`);
        setStatusModalQuotation(null);
        loadData();
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : err instanceof Error
              ? err.message
              : "Failed to accept quotation";
        accountingToast(message || "Failed to accept quotation", "error");
      } finally {
        setStatusUpdating(false);
      }
    } else {
      try {
        setStatusUpdating(true);
        await quotationApi.updateStatus(quotation.id, newStatus);
        accountingToast(`Quotation status changed to ${newStatus}`);
        setStatusModalQuotation(null);
        loadData();
      } catch (err: unknown) {
        const message =
          err && typeof err === "object" && "response" in err
            ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
            : err instanceof Error
              ? err.message
              : "Failed to update status";
        accountingToast(message || "Failed to update status", "error");
      } finally {
        setStatusUpdating(false);
      }
    }
  };

  const columns: DashboardTableColumn<Quotation>[] = [
    {
      key: "quotation_number",
      header: "Quotation #",
      cell: (row) => (
        <span className="font-bold text-primary flex items-center gap-1.5">
          <FileSpreadsheet className="size-4" />
          {row.quotation_number}
        </span>
      ),
    },
    {
      key: "client",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="font-medium text-zinc-900">
            {row.client?.institution || row.customer?.name || "—"}
          </p>
          <p className="text-xs text-zinc-400">{row.client?.email || row.customer?.email || ""}</p>
        </div>
      ),
    },
    {
      key: "date",
      header: "Date",
      cell: (row) => formatDate(row.date),
    },
    {
      key: "valid_until",
      header: "Valid Until",
      cell: (row) => (row.valid_until ? formatDate(row.valid_until) : "—"),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      cell: (row) => <span className="font-bold text-zinc-900">{row.currencies?.symbol || row.currencies?.code || "$"} {Number(row.total).toFixed(2)}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "center",
      cell: (row) => {
        return (
          <button
            type="button"
            disabled={statusUpdating}
            onClick={() => openStatusModal(row)}
            className="cursor-pointer hover:opacity-80 transition-opacity"
            title="Click to view quotation info & change status"
          >
            {statusBadge(row.status)}
          </button>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            className={actionBtnView}
            onClick={() => {
              setViewQuotation(row);
              setViewModalOpen(true);
            }}
            title="View Details"
          >
            <Eye className="size-4" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className={actionBtnView}
            onClick={() => {
              const url = documentTemplateApi.getQuotationRenderUrl(row.id);
              window.open(url, "_blank");
            }}
            title="Download / Print PDF"
          >
            <Download className="size-4 text-emerald-600" />
          </Button>

          {!["CONVERTED", "CANCELED"].includes(row.status) && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className={actionBtnEdit}
                onClick={() => {
                  setSelectedQuotation(row);
                  setModalOpen(true);
                }}
                title="Edit Quotation"
              >
                <SquarePen className="size-4" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className={actionBtnDelete}
                onClick={() => setPendingAction({ type: "delete", quotation: row })}
                title="Delete"
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];


  return (
    <AccountingPageShell
      section="Quotations"
      title="Customer Quotations"
      description="Prepare customer quotations. Accept them first, then import into Customer Invoices."
    >

      <>

          <DashboardDataTable
            rows={filtered}
            columns={columns}
            loading={loading}
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by quotation # or customer..."
            emptyText="No quotations found"
            minWidth="1200px"
            filters={
              <>
                <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-[42px] rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 outline-none focus:border-primary">
                  <option value="all">All statuses</option>
                  {['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED'].map((status) => <option key={status} value={status}>{status}</option>)}
                </select>
                <input aria-label="Quotation date from" title="Quotation date from" type="date" value={dateFrom} max={dateTo || undefined} onChange={(event) => setDateFrom(event.target.value)} className="h-[42px] rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 outline-none focus:border-primary" />
                <input aria-label="Quotation date to" title="Quotation date to" type="date" value={dateTo} min={dateFrom || undefined} onChange={(event) => setDateTo(event.target.value)} className="h-[42px] rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-600 outline-none focus:border-primary" />
                <button type="button" title="Refresh quotations" onClick={() => void loadData()} className="flex size-[42px] items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
              </>
            }
            action={<Button className={btnCreatePage} onClick={() => { setSelectedQuotation(null); setModalOpen(true); }}><Plus className="size-4" /> Create Quotation</Button>}
          />

          <QuotationModal
            open={modalOpen}
            onOpenChange={setModalOpen}
            quotation={selectedQuotation}
            onSuccess={loadData}
          />

          <QuotationViewModal
            open={viewModalOpen}
            onOpenChange={setViewModalOpen}
            quotation={viewQuotation}
            onConverted={loadData}
          />

          <AccountingConfirmDialog
            open={Boolean(pendingAction)}
            title={pendingAction?.type === "delete" ? "Delete Quotation" : "Accept Quotation"}
            description={
              pendingAction?.type === "delete"
                ? `Delete quotation ${pendingAction.quotation.quotation_number}?`
                : `Accept quotation ${pendingAction?.quotation.quotation_number}?`
            }
            confirmLabel={pendingAction?.type === "delete" ? "Delete" : "Accept Quotation"}
            busy={actionBusy}
            destructive={pendingAction?.type === "delete"}
            notice={
              pendingAction?.type === "delete"
                ? "This action cannot be undone."
                : "No invoice will be created yet. Import it later from Customer Invoices → Import from Accepted Quotation."
            }
            onCancel={() => !actionBusy && setPendingAction(null)}
            onConfirm={() => {
              if (!pendingAction) return;
              if (pendingAction.type === "delete") void handleDelete(pendingAction.quotation);
              else void handleConvert(pendingAction.quotation);
            }}
          />

          {/* Quotation Status Update Dialog (Pop up caadi ah) */}
          <Dialog
            open={Boolean(statusModalQuotation)}
            onOpenChange={(open) => !statusUpdating && !open && setStatusModalQuotation(null)}
          >
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-base font-bold text-zinc-900">
                  <RefreshCw className="size-4 text-primary" /> Update Quotation Status
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500">
                  Select a new status for quotation <strong>{statusModalQuotation?.quotation_number}</strong>
                </DialogDescription>
              </DialogHeader>

              {statusModalQuotation && (
                <div className="space-y-4 py-2">
                  {/* Quotation Information Summary */}
                  <div className="bg-zinc-50 rounded-xl p-3.5 border border-zinc-200 text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Quotation #:</span>
                      <span className="font-bold text-zinc-900 flex items-center gap-1.5">
                        <FileSpreadsheet className="size-3.5 text-primary" />
                        {statusModalQuotation.quotation_number}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Customer:</span>
                      <span className="font-semibold text-zinc-800">
                        {statusModalQuotation.client?.institution || statusModalQuotation.customer?.name || "—"}
                      </span>
                    </div>
                    {(statusModalQuotation.client?.email || statusModalQuotation.customer?.email) && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-500 font-medium">Email:</span>
                        <span className="text-zinc-600">
                          {statusModalQuotation.client?.email || statusModalQuotation.customer?.email}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Date:</span>
                      <span className="text-zinc-700">{formatDate(statusModalQuotation.date)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Valid Until:</span>
                      <span className="text-zinc-700">
                        {statusModalQuotation.valid_until ? formatDate(statusModalQuotation.valid_until) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center border-t border-zinc-200 pt-2">
                      <span className="text-zinc-700 font-bold">Total Amount:</span>
                      <span className="font-bold text-sm text-zinc-900">
                        {statusModalQuotation.currencies?.symbol || "$"} {Number(statusModalQuotation.total).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-500 font-medium">Current Status:</span>
                      {statusBadge(statusModalQuotation.status)}
                    </div>
                  </div>

                  {/* Status Selection */}
                  <div>
                    <label className="block text-xs font-bold text-zinc-700 mb-1.5">
                      New Status:
                    </label>
                    <select
                      value={selectedStatus}
                      onChange={(e) => setSelectedStatus(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-300 bg-white text-xs font-semibold text-zinc-800 focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="DRAFT">Draft</option>
                      <option value="SENT">Sent</option>
                      <option value="ACCEPTED">Accept (available for invoice)</option>
                      <option value="EXPIRED">Expire</option>
                      <option value="REJECTED">Reject</option>
                    </select>
                  </div>

                  {/* Context notice when ACCEPTED is selected */}
                  {selectedStatus === "ACCEPTED" && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-xs text-emerald-800 flex items-start gap-2">
                      <CheckCircle2 className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="block font-semibold">No automatic invoice</strong>
                        Quotation status becomes <strong>Accepted</strong>. Create the invoice later from{" "}
                        <strong>Customer Invoices → Import from Accepted Quotation</strong>.
                      </div>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter className="gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={statusUpdating}
                  onClick={() => setStatusModalQuotation(null)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={statusUpdating || selectedStatus === statusModalQuotation?.status}
                  onClick={handleSaveStatus}
                  className="text-xs font-bold bg-primary text-white"
                >
                  {statusUpdating ? (
                    <>
                      <RefreshCw className="size-3.5 animate-spin mr-1.5" /> Updating...
                    </>
                  ) : (
                    "Update Status"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
      </>
    </AccountingPageShell>
  );
}

export default function QuotationsPage() {
  return (
    <Suspense fallback={null}>
      <CustomerQuotationPageContent />
    </Suspense>
  );
}
