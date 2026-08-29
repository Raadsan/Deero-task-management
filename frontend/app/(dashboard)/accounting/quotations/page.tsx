"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { Plus, Eye, SquarePen, Trash2, ArrowRight, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { documentTemplateApi } from "@/lib/api/documentTemplateApi";
import QuotationModal from "@/components/quotations/QuotationModal";
import QuotationViewModal from "@/components/quotations/QuotationViewModal";
import DashboardDataTable from "@/components/Shared/DashboardDataTable";
import type { DashboardTableColumn } from "@/components/Shared/DashboardDataTable";
import AccountingPageShell from "@/components/accounting/AccountingPageShell";
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
    if (!confirm(`Are you sure you want to delete quotation ${quotation.quotation_number}?`)) return;
    try {
      await quotationApi.delete(quotation.id);
      accountingToast("Quotation deleted");
      loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to delete quotation";
      accountingToast(message || "Failed to delete quotation", "error");
    }
  };

  const handleConvert = async (quotation: Quotation) => {
    if (!confirm(`Approve quotation ${quotation.quotation_number} and create its invoice?`)) return;
    try {
      const res = await quotationApi.convertToInvoice(quotation.id);
      accountingToast(`Quotation approved and Invoice ${res.invoice?.invoice_number || ""}`);
      loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to convert quotation";
      accountingToast(message || "Failed to convert quotation", "error");
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
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase border ${map[status] || "bg-zinc-100"}`}>
        {status}
      </span>
    );
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
      key: "currency",
      header: "Currency",
      align: "center",
      cell: (row) => row.currencies?.code || "—",
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
      cell: (row) => statusBadge(row.status),
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

          {row.status !== "CONVERTED" && (
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
                className="h-8 px-2 text-xs font-semibold text-purple-600 hover:bg-purple-50 gap-1"
                onClick={() => handleConvert(row)}
                title="Approve and create invoice"
              >
                <ArrowRight className="size-3.5" /> Approve & Invoice
              </Button>

              <Button
                size="sm"
                variant="ghost"
                className={actionBtnDelete}
                onClick={() => handleDelete(row)}
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
      description="Prepare customer quotations and turn approved quotations into invoices."
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
