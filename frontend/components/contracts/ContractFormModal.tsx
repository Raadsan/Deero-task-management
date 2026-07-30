"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getContractById } from "@/lib/apis/contractApi";
import useSWR from "swr";
import ContractForm from "./ContractForm";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  contractId?: string;
}

async function loadContractFormData(mode: "create" | "edit", contractId?: string) {
  if (mode === "edit" && contractId) {
    const result = await getContractById(contractId);
    return { contract: result.data };
  }
  return { contract: undefined };
}

export default function ContractFormModal({
  open,
  onOpenChange,
  mode,
  contractId,
}: Props) {
  const { data, isLoading } = useSWR(
    open ? ["contract-form-modal", mode, contractId ?? "new"] : null,
    () => loadContractFormData(mode, contractId),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            {mode === "create" ? "Create Contract" : "Edit Contract"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {mode === "create"
              ? "Record the signed agreement with the client and upload the contract PDF."
              : "Update contract details or upload a new document version."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {isLoading && mode === "edit" ? (
            <div className="space-y-4 animate-pulse px-6 py-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : (
            <ContractForm
              formType={mode}
              contract={data?.contract}
              onSuccess={() => onOpenChange(false)}
              onCancel={() => onOpenChange(false)}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
