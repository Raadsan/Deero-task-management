"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getServiceById, ServiceRecord } from "@/lib/apis/serviceApi";
import useSWR from "swr";
import SimpleServiceRegistrationForm from "./SimpleServiceRegistrationForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  serviceId?: string;
}

async function loadServiceFormData(mode: "create" | "edit", serviceId?: string) {
  if (mode === "edit" && serviceId) {
    const result = await getServiceById(serviceId);
    return { currentService: result.data };
  }
  return { currentService: undefined };
}

export default function ServiceFormModal({
  open,
  onOpenChange,
  mode,
  serviceId,
}: Props) {
  const { data, isLoading } = useSWR(
    open ? ["service-form-modal", mode, serviceId ?? "new"] : null,
    () => loadServiceFormData(mode, serviceId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {mode === "create" ? "Service Registration" : "Edit Service"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {mode === "create"
              ? "Register a company main service. Sub-services are added later in projects."
              : "Update the main service name, description, or status."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && mode === "edit" ? (
            <div className="space-y-4 animate-pulse px-6 py-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : open ? (
            <SimpleServiceRegistrationForm
              mode={mode}
              initialService={
                mode === "edit" ? (data?.currentService as ServiceRecord | undefined) : undefined
              }
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
