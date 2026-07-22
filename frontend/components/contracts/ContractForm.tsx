"use client";

import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configTextareaClass,
} from "@/components/config/config-dialog-styles";
import { Button } from "@/components/ui/button";
import { getClientsForForm } from "@/lib/actions/client.action";
import {
  ContractRecord,
  createContract,
  getAllContracts,
  getProjectsForClient,
  updateContract,
  uploadContractDocument,
} from "@/lib/actions/contract.action";
import { CONTRACT_STATUS_OPTIONS } from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Paperclip, Upload, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type Props = {
  formType: "create" | "edit";
  contract?: ContractRecord;
  onSuccess?: () => void;
  onCancel?: () => void;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-sm font-medium text-zinc-700">{children}</label>
  );
}

function readFileAsDataUrl(file: File): Promise<{ name: string; data: string; fileSize: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({
        name: file.name,
        data: String(reader.result),
        fileSize: file.size,
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ContractForm({
  formType,
  contract,
  onSuccess,
  onCancel,
}: Props) {
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [contractNumber, setContractNumber] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [renewalDate, setRenewalDate] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [monthlyAmount, setMonthlyAmount] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [notes, setNotes] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [filterUncoveredOnly, setFilterUncoveredOnly] = useState(formType === "create");

  const { data: clients = [] } = useSWR("contracts/clients", async () => {
    const result = await getClientsForForm();
    return result.data ?? [];
  });

  const { data: existingContracts = [] } = useSWR("contracts/client-coverage", async () => {
    const result = await getAllContracts();
    return result.data ?? [];
  });

  const selectableClients = useMemo(() => {
    if (formType !== "create" || !filterUncoveredOnly) return clients;
    return clients.filter(
      (client) => !existingContracts.some((item) => item.clientId === client.id),
    );
  }, [clients, existingContracts, filterUncoveredOnly, formType]);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === clientId) ?? null,
    [clients, clientId],
  );

  const { data: projects = [] } = useSWR(
    clientId ? `contracts/projects/${clientId}` : null,
    async () => {
      const result = await getProjectsForClient(clientId);
      return result.data ?? [];
    },
  );

  useEffect(() => {
    if (formType !== "edit" || !contract) return;
    setClientId(contract.clientId);
    setProjectId(contract.projectId ?? "");
    setContractNumber(contract.contractNumber);
    setStartDate(contract.startDate ? String(contract.startDate).slice(0, 10) : "");
    setEndDate(contract.endDate ? String(contract.endDate).slice(0, 10) : "");
    setRenewalDate(contract.renewalDate ? String(contract.renewalDate).slice(0, 10) : "");
    setTotalAmount(contract.totalAmount != null ? String(contract.totalAmount) : "");
    setMonthlyAmount(
      (contract as { monthlyAmount?: number | null }).monthlyAmount != null
        ? String((contract as { monthlyAmount?: number | null }).monthlyAmount)
        : "",
    );
    setBillingDay(
      String((contract as { billingDay?: number | null }).billingDay ?? 1),
    );
    setPaymentTerms(contract.paymentTerms ?? "");
    setStatus(contract.status);
    setNotes(contract.notes ?? "");
    setPendingFile(null);
  }, [formType, contract]);

  function handleSubmit() {
    if (!clientId) {
      toast.error("Select a client");
      return;
    }

    startTransition(async () => {
      try {
        let filePayload;
        if (pendingFile) {
          filePayload = await readFileAsDataUrl(pendingFile);
        }

        if (formType === "edit" && contract?.id) {
          const result = await updateContract(contract.id, {
            contractNumber: contractNumber || undefined,
            startDate: startDate || null,
            endDate: endDate || null,
            renewalDate: renewalDate || null,
            totalAmount: totalAmount ? Number(totalAmount) : null,
            monthlyAmount: monthlyAmount ? Number(monthlyAmount) : null,
            billingDay: billingDay ? Number(billingDay) : 1,
            paymentTerms,
            status,
            notes,
            projectId: projectId || null,
          });
          if (!result.success) throw new Error(result.errors?.message ?? "Failed to update contract");
          if (filePayload) {
            const upload = await uploadContractDocument(contract.id, filePayload);
            if (!upload.success) throw new Error(upload.errors?.message ?? "Upload failed");
          }
          toast.success("Contract updated");
        } else {
          const result = await createContract({
            clientId,
            projectId: projectId || undefined,
            contractNumber: contractNumber || undefined,
            startDate: startDate || undefined,
            endDate: endDate || undefined,
            renewalDate: renewalDate || undefined,
            totalAmount: totalAmount ? Number(totalAmount) : undefined,
            monthlyAmount: monthlyAmount ? Number(monthlyAmount) : undefined,
            billingDay: billingDay ? Number(billingDay) : 1,
            paymentTerms: paymentTerms || undefined,
            status,
            notes: notes || undefined,
            file: filePayload,
          });
          if (!result.success) throw new Error(result.errors?.message ?? "Failed to create contract");
          toast.success("Contract created");
        }

        mutate(SWR_CACH_KEYS.contracts.key);
        onSuccess?.();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Save failed");
      }
    });
  }

  return (
    <>
      <div className={configDialogBodyClass}>
        {/* Client selector */}
        <div>
          <FieldLabel>Client *</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={clientId}
            onChange={(e) => {
              setClientId(e.target.value);
              setProjectId("");
            }}
            disabled={formType === "edit"}
          >
            <option value="">Select client</option>
            {selectableClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.institution}
              </option>
            ))}
          </select>
        </div>

        {/* Auto-fill client info card shown after selection */}
        {selectedClient && formType === "create" && (
          <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-4 py-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Client info
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-600">
              {(selectedClient as any).phone && (
                <span>
                  <span className="text-zinc-400">Phone: </span>
                  {(selectedClient as any).phone}
                </span>
              )}
              {(selectedClient as any).email && (
                <span>
                  <span className="text-zinc-400">Email: </span>
                  {(selectedClient as any).email}
                </span>
              )}
              {(selectedClient as any).clientType && (
                <span>
                  <span className="text-zinc-400">Type: </span>
                  {(selectedClient as any).clientType}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Filter toggle - only show on create */}
        {formType === "create" && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={filterUncoveredOnly}
              onChange={(e) => setFilterUncoveredOnly(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-primary"
            />
            Show only clients without a contract
          </label>
        )}

        <div>
          <FieldLabel>Project</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            disabled={!clientId}
          >
            <option value="">Optional</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {formType === "edit" && (
          <div>
            <FieldLabel>Contract number</FieldLabel>
            <input
              className={configCompactInputClass}
              value={contractNumber}
              readOnly
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Start date</FieldLabel>
            <input
              type="date"
              className={configCompactInputClass}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>End date</FieldLabel>
            <input
              type="date"
              className={configCompactInputClass}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Renewal date</FieldLabel>
            <input
              type="date"
              className={configCompactInputClass}
              value={renewalDate}
              onChange={(e) => setRenewalDate(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel>Total amount ($)</FieldLabel>
            <input
              type="number"
              className={configCompactInputClass}
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Monthly amount ($)</FieldLabel>
            <input
              type="number"
              className={configCompactInputClass}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(e.target.value)}
              placeholder="Auto from total if empty"
            />
          </div>
          <div>
            <FieldLabel>Billing day (1–28)</FieldLabel>
            <input
              type="number"
              min={1}
              max={28}
              className={configCompactInputClass}
              value={billingDay}
              onChange={(e) => setBillingDay(e.target.value)}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CONTRACT_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Notes</FieldLabel>
          <textarea
            className={configTextareaClass}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        {/* Styled file upload button */}
        <div>
          <FieldLabel>Signed contract (PDF)</FieldLabel>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/*"
            className="hidden"
            onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)}
          />
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:bg-zinc-50 hover:border-zinc-300 active:scale-95"
            >
              <Paperclip className="h-4 w-4 text-zinc-500" />
              {pendingFile ? "Change file" : "Attach contract"}
            </button>
            {pendingFile && (
              <div className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[180px] truncate">{pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="ml-1 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className={configDialogFooterClass}>
        <Button type="button" variant="outline" className={btnFormCancel} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          className={cn(btnFormSubmit)}
          disabled={pending}
          onClick={handleSubmit}
        >
          {pending ? "Saving…" : formType === "edit" ? "Update Contract" : "Create Contract"}
        </Button>
      </div>
    </>
  );
}
