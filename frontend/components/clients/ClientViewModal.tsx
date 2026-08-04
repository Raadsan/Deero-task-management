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
  CircleDot,
  CheckSquare,
  GitBranch,
  ListTodo,
  Mail,
  DollarSign,
  Phone,
  Tag,
  User,
} from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId?: string;
}

type ClientAgreementView = {
  agreementId: string;
  serviceName: string;
  subServiceName: string;
  serviceStatus: "pending" | "completed";
  portfolioId?: string | null;
  branchName?: string;
  base?: number;
  discount?: number;
  finalAmount?: number;
  vatPercentage?: number;
  vatAmount?: number;
  description?: string;
  createdAt?: string;
  features?: any[];
};

export default function ClientViewModal({ open, onOpenChange, clientId }: Props) {
  const { data, isLoading } = useSWR(
    open && clientId ? ["client-view-modal", clientId] : null,
    () => getClientById(clientId!),
  );
  const { data: branchOptionsRes } = useSWR(
    open ? "client-view-portfolios" : null,
    getTaskFormBranchOptions,
  );

  const branchNameById = useMemo(() => {
    const portfolios = branchOptionsRes?.data?.portfolios ?? [];
    return Object.fromEntries(portfolios.map((portfolio) => [portfolio.id, portfolio.name]));
  }, [branchOptionsRes?.data?.portfolios]);

  const client = data?.data;
  const agreements =
    (client as { serviceAgreements?: ClientAgreementView[] } | undefined)
      ?.serviceAgreements ?? [];
  const clientTasks = (client as any)?.clientTask ?? (client as any)?.tasks ?? [];
  const totalAmount = agreements.reduce(
    (sum, agreement) =>
      sum +
      Number(agreement.finalAmount ?? agreement.base ?? 0) +
      Number(agreement.vatAmount ?? 0),
    0,
  );
  const isGeneratedEmail = (email?: string | null) =>
    !email ||
    email.includes("@deero.internal") ||
    /^client-\d+@deero\.so$/i.test(email);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Client Details
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            View client information, portfolio, and service agreements.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : !client ? (
            <p className="py-8 text-center text-sm text-zinc-500">
              Client not found.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoItem
                  icon={Building2}
                  label="Company Name"
                  value={client.companyName || client.institution || "N/A"}
                />
                <InfoItem
                  icon={User}
                  label="Contact Person"
                  value={client.contactPerson || "N/A"}
                />
                <InfoItem icon={Mail} label="Email" value={isGeneratedEmail(client.email) ? "N/A" : client.email} />
                <InfoItem icon={Phone} label="Phone" value={client.phone} />
                <InfoItem icon={Tag} label="Source" value={client.source ?? "—"} />
                <InfoItem
                  icon={DollarSign}
                  label="Total amount"
                  value={`$${totalAmount.toFixed(2)}`}
                />
<InfoItem
                  icon={User}
                  label="Status"
                  value={client.isDraft ? "Draft" : client.isActive === false ? "Inactive" : "Active"}
                />                <InfoItem
                  icon={Calendar}
                  label="Created"
                  value={formatDate(client.createdAt ?? "") || "—"}
                />
              </div>

              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  Service agreements
                </p>
                {agreements.length ? (
                  <div className="space-y-3">
                    {agreements.map((agreement) => (
                      <div
                        key={agreement.agreementId}
                        className="rounded-lg border border-zinc-200 bg-white p-3"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-zinc-800">
                              {agreement.serviceName}
                            </p>
                            <p className="text-sm text-zinc-600">
                              {agreement.subServiceName}
                            </p>
                          </div>
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              getTaskStatusBadgeClass(agreement.serviceStatus),
                            )}
                          >
                            {formatStatusLabel(agreement.serviceStatus)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                          <span className="inline-flex items-center gap-1">
                            <GitBranch className="size-3.5" />
                            {agreement.branchName ||
                              (agreement.portfolioId
                                ? branchNameById[agreement.portfolioId]
                                : "") ||
                              "No portfolio"}
                          </span>
                          {agreement.createdAt && (
                            <span>Date: {agreement.createdAt}</span>
                          )}
</div>
                        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-zinc-50 p-3 text-xs sm:grid-cols-5">
                          <p><span className="block text-zinc-500">Original</span><strong className="text-zinc-900">${Number(agreement.base ?? 0).toFixed(2)}</strong></p>
                          <p><span className="block text-zinc-500">Amount charged</span><strong className="text-zinc-900">${Number(agreement.finalAmount ?? agreement.base ?? 0).toFixed(2)}</strong></p>
                          <p><span className="block text-zinc-500">Discount</span><strong className="text-zinc-900">{(Number(agreement.discount ?? 0) * 100).toFixed(1)}%</strong></p>
                          <p><span className="block text-zinc-500">VAT ({Number(agreement.vatPercentage ?? 0).toFixed(1)}%)</span><strong className="text-zinc-900">${Number(agreement.vatAmount ?? 0).toFixed(2)}</strong></p>
                          <p><span className="block text-zinc-500">Final total</span><strong className="text-primary">${(Number(agreement.finalAmount ?? agreement.base ?? 0) + Number(agreement.vatAmount ?? 0)).toFixed(2)}</strong></p>
                        </div>
                        {agreement.description ? (
                          <p className="mt-2 text-sm text-zinc-600">
                            {agreement.description}
                          </p>
                        ) : null}
                        {Array.isArray(agreement.features) && agreement.features.length > 0 && (
                          <div className="mt-3 border-t border-zinc-100 pt-2 space-y-1.5">
                            <p className="text-[11px] font-semibold uppercase tracking-wider text-indigo-900 flex items-center gap-1">
                              <CheckSquare className="size-3 text-indigo-600" />
                              Service Features & Deliverables ({agreement.features.length})
                            </p>
                            <div className="flex flex-wrap gap-1.5">
                              {agreement.features.map((feat: any, idx: number) => {
                                const featName =
                                  typeof feat === "string"
                                    ? feat
                                    : feat?.name ?? feat?.title ?? String(feat);
                                return (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-indigo-100 bg-indigo-50/60 px-2.5 py-1 text-xs font-medium text-indigo-900"
                                  >
                                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                                    {featName}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No services registered.</p>
                )}
              </div>

              {/* Tasks & Deliverables Status Section */}
              <div className="rounded-lg border border-zinc-100 bg-zinc-50 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Tasks & Deliverables Status
                  </p>
                  <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                    {clientTasks.length} Task(s)
                  </span>
                </div>

                {clientTasks.length > 0 ? (
                  <div className="space-y-3">
                    {clientTasks.map((item: any, idx: number) => {
                      const t = item.task ?? item;
                      const features = Array.isArray(t.features) ? t.features : [];
                      const doneCount = features.filter((f: any) => f.done || f.completed).length;

                      return (
                        <div
                          key={t.id || idx}
                          className="rounded-lg border border-zinc-200 bg-white p-3.5 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold text-zinc-800">
                                {t.serviceInformation || t.description || "General Task"}
                              </p>
                              {t.description && (
                                <p className="text-xs text-zinc-500 line-clamp-1">{t.description}</p>
                              )}
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

                          {/* Progress Bar */}
                          <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden">
                            <div
                              className="h-1.5 rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${t.progress || 0}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-xs text-zinc-500">
                            <span>Assigned: <strong>{t.user?.name ?? t.assignedTo?.name ?? "—"}</strong></span>
                            {features.length > 0 && (
                              <span>Deliverables: <strong>{doneCount}/{features.length} Done</strong></span>
                            )}
                          </div>

                          {/* Features Deliverables List */}
                          {features.length > 0 && (
                            <div className="mt-2 space-y-1.5 border-t border-zinc-100 pt-2">
                              <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Features Checklist:</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                {features.map((feat: any, fIdx: number) => {
                                  const isDone = Boolean(feat.done || feat.completed);
                                  return (
                                    <div
                                      key={fIdx}
                                      className={cn(
                                        "flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs border",
                                        isDone
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                                          : "bg-zinc-50 border-zinc-200 text-zinc-600",
                                      )}
                                    >
                                      <span className="truncate">{feat.name ?? String(feat)}</span>
                                      {isDone && (
                                        <span className="text-[10px] font-bold text-emerald-700">✓ Done</span>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No tasks generated yet for this client.</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-zinc-100 px-6 py-4">
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className={btnFormSubmit}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-zinc-100 bg-zinc-50 p-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-zinc-400" />
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
          {label}
        </p>
        <p className="truncate text-sm font-medium text-zinc-800">{value}</p>
      </div>
    </div>
  );
}
