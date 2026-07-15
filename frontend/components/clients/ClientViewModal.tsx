"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getClientById } from "@/lib/actions/client.action";
import { getTaskFormBranchOptions } from "@/lib/actions/shared.action";
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
  GitBranch,
  Mail,
  Percent,
  Phone,
  Tag,
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
  description?: string;
  createdAt?: string;
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
                  label="Client Name"
                  value={client.institution}
                />
                <InfoItem icon={Mail} label="Email" value={client.email} />
                <InfoItem icon={Phone} label="Phone" value={client.phone} />
                <InfoItem icon={Tag} label="Source" value={client.source ?? "—"} />
                <InfoItem
                  icon={Percent}
                  label="Discount"
                  value={`${client.discount ?? 0}%`}
                />
                <InfoItem
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
                          {agreement.base != null && (
                            <span>Amount: ${agreement.base}</span>
                          )}
                          {agreement.createdAt && (
                            <span>Date: {agreement.createdAt}</span>
                          )}
                        </div>
                        {agreement.description ? (
                          <p className="mt-2 text-sm text-zinc-600">
                            {agreement.description}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No services registered.</p>
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
