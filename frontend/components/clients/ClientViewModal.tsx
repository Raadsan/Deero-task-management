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
import { getTaskFormBranchOptions } from "@/lib/apis/sharedApi";
import { quotationApi, type Quotation } from "@/lib/api/quotationApi";
import { customerInvoiceApi } from "@/lib/api/accounting/receivables/customerInvoiceApi";
import { customerReceiptApi } from "@/lib/api/accounting/receivables/customerReceiptApi";
import { documentTemplateApi } from "@/lib/api/documentTemplateApi";
import axiosClient from "@/lib/apis/axios";
import {
  btnFormSubmit,
  dashboardStatusBadgeClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import {
  Building2,
  Calendar,
  CheckSquare,
  GitBranch,
  Mail,
  DollarSign,
  Phone,
  Tag,
  User,
  Calculator,
  FileSpreadsheet,
  ReceiptText,
  WalletCards,
  FileText,
  Download,
  ListTodo,
  Layers,
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
}

type TabType = "overview" | "tasks" | "services" | "quotations" | "invoices" | "payments" | "documents";

export default function ClientViewModal({ open, onOpenChange, clientId }: Props) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [financialSummary, setFinancialSummary] = useState({
    totalQuoted: 0,
    totalInvoiced: 0,
    totalPaid: 0,
    outstandingBalance: 0,
  });

  const [clientQuotations, setClientQuotations] = useState<Quotation[]>([]);
  const [clientInvoices, setClientInvoices] = useState<any[]>([]);
  const [clientPayments, setClientPayments] = useState<any[]>([]);

  const { data, isLoading } = useSWR(
    open && clientId ? ["client-view-modal", clientId] : null,
    () => getClientById(clientId!),
  );
  const { data: branchOptionsRes } = useSWR(
    open ? "client-view-portfolios" : null,
    getTaskFormBranchOptions,
  );

  useEffect(() => {
    if (open && clientId) {
      // Fetch financial summary
      axiosClient.get(`/clients/${clientId}/financial-summary`)
        .then((res) => {
          if (res.data?.data) setFinancialSummary(res.data.data);
        })
        .catch(() => {});

      // Fetch quotations
      quotationApi.getAll({ clientId }).then((data) => setClientQuotations(data || [])).catch(() => {});

      // Fetch invoices & receipts
      customerInvoiceApi.getAll().then((invoices) => {
        const matching = invoices.filter((inv: any) => inv.client_id === clientId || inv.customers?.clientId === clientId);
        setClientInvoices(matching);
      }).catch(() => {});

      customerReceiptApi.getAll().then((receipts) => {
        const matching = receipts.filter((rc: any) => rc.customers?.clientId === clientId);
        setClientPayments(matching);
      }).catch(() => {});
    }
  }, [open, clientId]);

  const branchNameById = useMemo(() => {
    const portfolios = branchOptionsRes?.data?.portfolios ?? [];
    return Object.fromEntries(portfolios.map((portfolio) => [portfolio.id, portfolio.name]));
  }, [branchOptionsRes?.data?.portfolios]);

  const client = data?.data;
  const agreements = (client as any)?.serviceAgreements ?? [];
  const clientTasks = (client as any)?.clientTask ?? (client as any)?.tasks ?? [];
  const contracts = (client as any)?.contracts ?? [];

  const isGeneratedEmail = (email?: string | null) =>
    !email ||
    email.includes("@deero.internal") ||
    /^client-\d+@deero\.so$/i.test(email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-4xl dark:bg-zinc-950">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left dark:border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl font-bold text-[#1e293b] dark:text-white">
                {client?.companyName || client?.institution || "Client Details"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500">
                Client ID: {client?.id || clientId}
              </DialogDescription>
            </div>
            <span
              className={`px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-full border ${
                client?.isActive !== false ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {client?.isDraft ? "Draft" : client?.isActive === false ? "Inactive" : "Active"}
            </span>
          </div>

          {/* STEP 18: FINANCIAL SUMMARY HEADER */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Quoted</span>
              <p className="text-base font-bold text-[#1e293b] dark:text-white mt-0.5">
                ${Number(financialSummary.totalQuoted).toFixed(2)}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Invoiced</span>
              <p className="text-base font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                ${Number(financialSummary.totalInvoiced).toFixed(2)}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Total Paid</span>
              <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                ${Number(financialSummary.totalPaid).toFixed(2)}
              </p>
            </div>

            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
              <span className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">Outstanding Balance</span>
              <p className={`text-base font-bold mt-0.5 ${financialSummary.outstandingBalance > 0 ? "text-red-600" : "text-zinc-700 dark:text-zinc-300"}`}>
                ${Number(financialSummary.outstandingBalance).toFixed(2)}
              </p>
            </div>
          </div>

          {/* STEP 17: 7 CLIENT TABS */}
          <div className="flex items-center gap-1.5 overflow-x-auto pt-4 mt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
            {[
              { id: "overview", label: "Overview", icon: Building2 },
              { id: "tasks", label: `Tasks (${clientTasks.length})`, icon: ListTodo },
              { id: "services", label: `Services (${agreements.length})`, icon: Layers },
              { id: "quotations", label: `Quotations (${clientQuotations.length})`, icon: FileSpreadsheet },
              { id: "invoices", label: `Invoices (${clientInvoices.length})`, icon: ReceiptText },
              { id: "payments", label: `Payments (${clientPayments.length})`, icon: WalletCards },
              { id: "documents", label: `Documents (${contracts.length})`, icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as TabType)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold whitespace-nowrap transition-all ${
                    active
                      ? "bg-primary text-white shadow-sm"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : !client ? (
            <p className="py-8 text-center text-sm text-zinc-500">Client not found.</p>
          ) : (
            <div>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoItem icon={Building2} label="Company Name" value={client.companyName || client.institution || "N/A"} />
                    <InfoItem icon={User} label="Contact Person" value={client.contactPerson || "N/A"} />
                    <InfoItem icon={Mail} label="Email" value={isGeneratedEmail(client.email) ? "N/A" : client.email} />
                    <InfoItem icon={Phone} label="Phone" value={client.phone} />
                    <InfoItem icon={Tag} label="Source" value={client.source ?? "—"} />
                    <InfoItem icon={Tag} label="Client Type" value={client.clientType ?? "ONE_TIME"} />
                    <InfoItem icon={Calendar} label="Contract Start" value={client.contractStartDate ? formatDate(client.contractStartDate) : "—"} />
                    <InfoItem icon={Calendar} label="Contract End" value={client.contractEndDate ? formatDate(client.contractEndDate) : "—"} />
                  </div>

                  {client.notes && (
                    <div className="p-4 rounded-xl border bg-zinc-50 dark:bg-zinc-900 text-xs">
                      <p className="font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider mb-1">Notes</p>
                      <p className="text-zinc-700 dark:text-zinc-300">{client.notes}</p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: TASKS */}
              {activeTab === "tasks" && (
                <div className="space-y-3">
                  {clientTasks.length > 0 ? (
                    clientTasks.map((item: any, idx: number) => {
                      const t = item.task ?? item;
                      const features = Array.isArray(t.features) ? t.features : [];
                      const doneCount = features.filter((f: any) => f.done || f.completed).length;

                      return (
                        <div key={t.id || idx} className="rounded-lg border border-zinc-200 bg-white p-3.5 space-y-2.5 dark:bg-zinc-900">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-800 dark:text-white">
                                {t.serviceInformation || t.description || "General Task"}
                              </p>
                              {t.description && <p className="text-xs text-zinc-500 line-clamp-1">{t.description}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(t.status))}>
                                {formatStatusLabel(t.status)}
                              </span>
                              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                {t.progress || 0}%
                              </span>
                            </div>
                          </div>

                          <div className="h-1.5 w-full rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                            <div className="h-1.5 rounded-full bg-primary transition-all duration-300" style={{ width: `${t.progress || 0}%` }} />
                          </div>

                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>Assigned: <strong>{t.user?.name ?? t.assignedTo?.name ?? "—"}</strong></span>
                            {features.length > 0 && <span>Deliverables: <strong>{doneCount}/{features.length} Done</strong></span>}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No tasks assigned to this client.</p>
                  )}
                </div>
              )}

              {/* TAB 3: SERVICES */}
              {activeTab === "services" && (
                <div className="space-y-3">
                  {agreements.length > 0 ? (
                    agreements.map((agreement: any) => (
                      <div key={agreement.agreementId} className="rounded-lg border border-zinc-200 bg-white p-3.5 space-y-2 dark:bg-zinc-900">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold text-zinc-800 dark:text-white">{agreement.serviceName}</p>
                            <p className="text-xs text-zinc-600 dark:text-zinc-400">{agreement.subServiceName}</p>
                          </div>
                          <span className={cn(dashboardStatusBadgeClass, getTaskStatusBadgeClass(agreement.serviceStatus))}>
                            {formatStatusLabel(agreement.serviceStatus)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 p-2.5 text-xs">
                          <p><span className="text-zinc-400 block">Base</span><strong>${Number(agreement.base || 0).toFixed(2)}</strong></p>
                          <p><span className="text-zinc-400 block">Discount</span><strong>{Number(agreement.discount || 0)}%</strong></p>
                          <p><span className="text-zinc-400 block">VAT</span><strong>${Number(agreement.vatAmount || 0).toFixed(2)}</strong></p>
                          <p><span className="text-zinc-400 block">Final Total</span><strong className="text-primary">${Number(agreement.finalAmount || agreement.base || 0).toFixed(2)}</strong></p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No service agreements recorded.</p>
                  )}
                </div>
              )}

              {/* TAB 4: QUOTATIONS */}
              {activeTab === "quotations" && (
                <div className="space-y-3">
                  {clientQuotations.length > 0 ? (
                    clientQuotations.map((q) => (
                      <div key={q.id} className="p-3.5 rounded-xl border bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-primary text-sm flex items-center gap-1.5">
                            <FileSpreadsheet className="size-4" />
                            {q.quotation_number}
                          </p>
                          <p className="text-zinc-400 mt-0.5">Date: {formatDate(q.date)} | Valid: {q.valid_until ? formatDate(q.valid_until) : "N/A"}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="font-bold text-sm text-zinc-900 dark:text-white">${Number(q.total).toFixed(2)}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border bg-zinc-100">
                            {q.status}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const url = documentTemplateApi.getQuotationRenderUrl(q.id);
                              window.open(url, "_blank");
                            }}
                            title="Download PDF"
                          >
                            <Download className="size-4 text-emerald-600" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No quotations generated for this client.</p>
                  )}
                </div>
              )}

              {/* TAB 5: INVOICES */}
              {activeTab === "invoices" && (
                <div className="space-y-3">
                  {clientInvoices.length > 0 ? (
                    clientInvoices.map((inv) => (
                      <div key={inv.id} className="p-3.5 rounded-xl border bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-zinc-900 dark:text-white text-sm flex items-center gap-1.5">
                            <ReceiptText className="size-4 text-blue-600" />
                            {inv.invoice_number || `INV-${inv.id}`}
                          </p>
                          <p className="text-zinc-400 mt-0.5">Date: {formatDate(inv.invoice_date)} | Due: {inv.due_date ? formatDate(inv.due_date) : "N/A"}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div>
                            <p className="font-bold text-sm">${Number(inv.amount_total).toFixed(2)}</p>
                            <p className="text-[10px] text-zinc-400">Paid: ${Number(inv.paid_amount || 0).toFixed(2)}</p>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border bg-blue-50 text-blue-700">
                            {inv.payment_state || inv.state}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              const url = documentTemplateApi.getInvoiceRenderUrl(inv.id);
                              window.open(url, "_blank");
                            }}
                            title="Download PDF"
                          >
                            <Download className="size-4 text-emerald-600" />
                          </Button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No accounting invoices recorded for this client.</p>
                  )}
                </div>
              )}

              {/* TAB 6: PAYMENTS */}
              {activeTab === "payments" && (
                <div className="space-y-3">
                  {clientPayments.length > 0 ? (
                    clientPayments.map((p) => (
                      <div key={p.id} className="p-3.5 rounded-xl border bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-emerald-600 text-sm flex items-center gap-1.5">
                            <WalletCards className="size-4" />
                            {p.receipt_number || `RCP-${p.id}`}
                          </p>
                          <p className="text-zinc-400 mt-0.5">Date: {formatDate(p.receipt_date)} | Ref: {p.reference || "None"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-sm text-emerald-600">${Number(p.amount).toFixed(2)}</span>
                          <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] border bg-emerald-50 text-emerald-700">
                            {p.state}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No customer receipts or payments recorded.</p>
                  )}
                </div>
              )}

              {/* TAB 7: DOCUMENTS */}
              {activeTab === "documents" && (
                <div className="space-y-3">
                  {contracts.length > 0 ? (
                    contracts.map((c: any) => (
                      <div key={c.id} className="p-3.5 rounded-xl border bg-white dark:bg-zinc-900 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-sm text-zinc-800 dark:text-white">{c.contractNumber || `Contract ${c.id}`}</p>
                          <p className="text-zinc-400">Total: ${Number(c.totalAmount || 0).toFixed(2)} | Status: {c.status}</p>
                        </div>
                        <span className="px-2.5 py-0.5 rounded-full font-bold uppercase text-[10px] bg-zinc-100">
                          {c.status}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-500 py-6 text-center">No contracts or uploaded documents found.</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4 dark:border-zinc-800">
          <div className="flex justify-end">
            <Button type="button" onClick={() => onOpenChange(false)} className={btnFormSubmit}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">{label}</p>
        <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{value}</p>
      </div>
    </div>
  );
}
