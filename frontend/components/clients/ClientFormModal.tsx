"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getClientById } from "@/lib/actions/client.action";
import { Client } from "@/lib/types";
import useSWR from "swr";
import ClientCreateWizard from "./ClientCreateWizard";
import ClientForm from "./ClientForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  clientId?: string;
  draftClientId?: string;
}

async function loadClientFormData(mode: "create" | "edit", clientId?: string) {
  if (mode === "edit" && clientId) {
    const result = await getClientById(clientId);
    return { currentClient: result.data };
  }
  return { currentClient: undefined };
}

export default function ClientFormModal({
  open,
  onOpenChange,
  mode,
  clientId,
  draftClientId,
}: Props) {
  const { data, isLoading } = useSWR(
    open ? ["client-form-modal", mode, clientId ?? "new"] : null,
    () => loadClientFormData(mode, clientId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {mode === "create" ? "Create Client" : "Edit Client"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {mode === "create"
              ? "3 steps: type, details, then optional service, contract, and schedule. Save as draft anytime."
              : "Update client details, portfolio, service, and agreement information."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && mode === "edit" ? (
            <div className="space-y-4 animate-pulse px-6 py-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : mode === "create" && open ? (
            <ClientCreateWizard
              draftClientId={draftClientId}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          ) : mode === "edit" ? (
            <ClientForm
              formType="edit"
              currentClient={data?.currentClient as Client | undefined}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
