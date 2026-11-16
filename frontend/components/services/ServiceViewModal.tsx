"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getServiceById, ServiceRecord } from "@/lib/apis/serviceApi";
import {
  dashboardStatusBadgeClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatDateTime, formatServiceDisplayId } from "@/lib/utils";
import useSWR from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  serviceId?: string;
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

export default function ServiceViewModal({ open, onOpenChange, serviceId }: Props) {
  const { data, isLoading } = useSWR(
    open && serviceId ? ["service-view-modal", serviceId] : null,
    () => getServiceById(serviceId!),
  );

  const service = data?.data as ServiceRecord | undefined;
  const statusLabel = service?.isActive === false ? "Inactive" : "Active";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="text-xl font-bold text-[#1e293b]">
                {service?.serviceName || "Service Details"}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500">
                Service ID: {service ? formatServiceDisplayId(service) : serviceId}
              </DialogDescription>
            </div>
            {service ? (
              <span
                className={cn(
                  dashboardStatusBadgeClass,
                  getTaskStatusBadgeClass(service.isActive === false ? "inactive" : "active"),
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
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : service ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="Service Name" value={service.serviceName} />
              <DetailRow label="Created By" value={service.createdBy?.name} />
              <DetailRow
                label="Created At"
                value={service.createdAt ? formatDateTime(service.createdAt) : undefined}
              />
              <DetailRow
                label="Description"
                value={service.description || "—"}
              />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Service not found.</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
