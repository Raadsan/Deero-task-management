"use client";

import {
  configCompactInputClass,
  configCompactSelectClass,
  configDialogBodyClass,
  configDialogFooterClass,
} from "@/components/config/config-dialog-styles";
import { Button } from "@/components/ui/button";
import { getClientsForForm } from "@/lib/apis/clientApi";
import {
  ContractRecord,
  createContract,
  updateContract,
  uploadContractDocument,
} from "@/lib/apis/contractApi";
import {
  CONTRACT_DURATION_OPTIONS,
  CONTRACT_REGISTRATION_STATUS_OPTIONS,
  CONTRACT_TYPE_OPTIONS,
  MONTHLY_PAYMENT_TERM_OPTIONS,
  ONE_TIME_PAYMENT_TERM_OPTIONS,
  type ContractDuration,
} from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  BILLING_PERIOD_OPTIONS,
  buildInstallmentPreview,
  getValidPaymentTermsForDuration,
  PAYMENT_INTERVAL_MONTHS,
  PAYMENT_MILESTONES,
} from "@/lib/contract-installments";
import { calculateContractEndDate, contractPaymentTermsLabel, paymentMilestoneLabel, paymentStatusLabel } from "@/lib/contract-utils";
import { zonedNowParts } from "@/lib/scheduled-task-window";
import { formatDate } from "@/lib/utils";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
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

type CustomRow = { key: string; percentage: string; milestone: string; dueDate: string; dueTime: string };

function newCustomRow(partial?: Partial<CustomRow>): CustomRow {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    percentage: "",
    milestone: "CONTRACT_START",
    dueDate: "",
    dueTime: "00:00",
    ...partial,
  };
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
    reader.onerror = () => reject(new Error("Could not read file"));
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
  const [title, setTitle] = useState("");
  const [contractType, setContractType] = useState<"ONE_TIME" | "MONTHLY">("MONTHLY");
  const [duration, setDuration] = useState<ContractDuration | "">("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [contractAmount, setContractAmount] = useState("");
  const [paymentTerms, setPaymentTerms] = useState("");
  const [billingPeriodMonths, setBillingPeriodMonths] = useState("");
  const [customRows, setCustomRows] = useState<CustomRow[]>([
    newCustomRow({ percentage: "50", milestone: "CONTRACT_START" }),
    newCustomRow({ percentage: "50", milestone: "CONTRACT_COMPLETION" }),
  ]);
  const [status, setStatus] = useState("DRAFT");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: clients = [] } = useSWR("contracts/clients", async () => {
    const result = await getClientsForForm();
    return result.data ?? [];
  });

  const isOneTime = contractType === "ONE_TIME";
  const isEndless = !isOneTime && duration === "ENDLESS";
  const allowedTerms = isOneTime
    ? ONE_TIME_PAYMENT_TERM_OPTIONS.map((option) => option.value)
    : getValidPaymentTermsForDuration(duration, "MONTHLY");
  const paymentOptions = (isOneTime ? ONE_TIME_PAYMENT_TERM_OPTIONS : MONTHLY_PAYMENT_TERM_OPTIONS)
    .filter((option) => allowedTerms.includes(option.value));
  const minimumPaymentMonths = PAYMENT_INTERVAL_MONTHS[paymentTerms] || 0;
  const billingOptions = BILLING_PERIOD_OPTIONS.filter((months) => !minimumPaymentMonths || months >= minimumPaymentMonths);
  const savedTermsNeedReview = formType === "edit"
    && !isOneTime
    && Boolean(contract?.duration)
    && Boolean(contract?.paymentTerms)
    && !getValidPaymentTermsForDuration(String(contract?.duration || ""), "MONTHLY").includes(String(contract?.paymentTerms || ""));

  useEffect(() => {
    if (paymentTerms && !paymentOptions.some((option) => option.value === paymentTerms)) {
      setPaymentTerms("");
    }
  }, [paymentTerms, paymentOptions]);

  useEffect(() => {
    if (billingPeriodMonths && !billingOptions.includes(Number(billingPeriodMonths))) {
      setBillingPeriodMonths("");
    }
  }, [billingPeriodMonths, billingOptions]);

  const paymentPreview = useMemo(() => {
    const amount = Number(contractAmount);
    if (!paymentTerms || !startDate || !Number.isFinite(amount) || amount <= 0) return null;
    if (!isOneTime && !duration) return null;
    return buildInstallmentPreview({
      contractType,
      duration: isOneTime ? null : duration,
      totalAmount: amount,
      paymentTerms,
      startDate,
      endDate: endDate || null,
      billingPeriodMonths: billingPeriodMonths ? Number(billingPeriodMonths) : null,
      installments: customRows.map((row) => ({
        percentage: Number(row.percentage),
        milestone: row.milestone,
        dueDate: row.dueDate,
        dueTime: row.dueTime,
      })),
    });
  }, [billingPeriodMonths, contractAmount, contractType, customRows, duration, endDate, isOneTime, paymentTerms, startDate]);

  const computedEndDate = useMemo(() => {
    if (isOneTime || !startDate || !duration || isEndless) return "";
    return calculateContractEndDate(startDate, duration) ?? "";
  }, [isOneTime, startDate, duration, isEndless]);

  useEffect(() => {
    if (isEndless) {
      setEndDate("");
      return;
    }
    if (computedEndDate) {
      setEndDate(computedEndDate);
    }
  }, [computedEndDate, isEndless]);

  useEffect(() => {
    if (formType !== "edit" || !contract) return;
    const savedTerms = contract.paymentTerms ?? "";
    const savedType = contract.contractType === "ONE_TIME" || ONE_TIME_PAYMENT_TERM_OPTIONS.some((option) => option.value === savedTerms)
      ? "ONE_TIME"
      : "MONTHLY";
    setClientId(contract.clientId);
    setTitle(contract.title ?? "");
    setContractType(savedType);
    setDuration((contract.duration as ContractDuration) ?? "");
    setStartDate(contract.startDate ? String(contract.startDate).slice(0, 10) : "");
    setEndDate(contract.endDate ? String(contract.endDate).slice(0, 10) : "");
    setContractAmount(
      contract.totalAmount != null ? String(contract.totalAmount) : "",
    );
    setPaymentTerms(savedTerms);
    setBillingPeriodMonths(contract.billingPeriodMonths ? String(contract.billingPeriodMonths) : "");
    if (savedTerms === "CUSTOM" && contract.installments?.length) {
      setCustomRows(contract.installments.map((row) => {
        const parts = row.dueDate ? zonedNowParts(new Date(row.dueDate)) : null;
        return newCustomRow({
          percentage: row.percentage != null ? String(row.percentage) : "",
          milestone: row.dueMilestone || "CUSTOM_DATE",
          dueDate: parts?.date || "",
          dueTime: parts?.time || "00:00",
        });
      }));
    }
    setStatus(contract.status === "TERMINATED" ? "CANCELLED" : contract.status);
    setPendingFile(null);
  }, [formType, contract]);

  const existingDocument = contract?.documents?.[0];

  function validate(): string | null {
    if (!clientId) return "Select a client";
    if (!title.trim()) return "Contract title is required";
    if (!isOneTime && !duration) return "Duration is required";
    if (!startDate) return "Start date is required";
    if (isOneTime && !endDate) return "Completion date is required";
    if (!isEndless && endDate && startDate && endDate < startDate) {
      return "End date must not be earlier than start date";
    }
    if (isEndless && endDate) return "Endless contracts must not have an end date";
    const amount = Number(contractAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return "Contract amount must be greater than zero";
    }
    if (!paymentTerms) return "Payment terms are required";
    if (paymentPreview?.error) return paymentPreview.error;
    if (!paymentPreview?.installments.length) return "Review the payment schedule before saving";
    if (!status) return "Status is required";
    return null;
  }

  function handleSubmit() {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    startTransition(async () => {
      try {
        let filePayload;
        if (pendingFile) {
          filePayload = await readFileAsDataUrl(pendingFile);
        }

        const payload = {
          title: title.trim(),
          contractType,
          duration: isOneTime ? null : duration,
          startDate,
          endDate: isEndless ? null : endDate || null,
          totalAmount: Number(contractAmount),
          paymentTerms,
          billingPeriodMonths: isEndless && paymentTerms !== "CUSTOM" ? Number(billingPeriodMonths) : null,
          installments: paymentTerms === "CUSTOM"
            ? customRows.map((row) => ({
                percentage: Number(row.percentage),
                milestone: row.milestone,
                dueDate: row.dueDate || null,
                dueTime: row.dueTime || "00:00",
              }))
            : undefined,
          status,
        };

        if (formType === "edit" && contract?.id) {
          const result = await updateContract(contract.id, payload);
          if (!result.success) {
            throw new Error(result.errors?.message ?? "Failed to update contract");
          }
          if (filePayload) {
            const upload = await uploadContractDocument(contract.id, filePayload);
            if (!upload.success) {
              throw new Error(upload.errors?.message ?? "Contract saved but document upload failed");
            }
          }
          toast.success(filePayload ? "Contract updated and document uploaded" : "Contract updated");
        } else {
          const result = await createContract({
            clientId,
            ...payload,
            duration: isOneTime ? undefined : duration,
            endDate: isEndless ? undefined : endDate || undefined,
            file: filePayload,
          });
          if (!result.success) {
            throw new Error(result.errors?.message ?? "Failed to create contract");
          }
          toast.success(filePayload ? "Contract created with document" : "Contract created");
        }

        mutate(SWR_CACH_KEYS.contracts.key);
        onSuccess?.();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Save failed");
      }
    });
  }

  return (
    <>
      <div className={configDialogBodyClass}>
        <div>
          <FieldLabel>Client *</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={formType === "edit"}
          >
            <option value="">Select client</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.institution}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Contract title *</FieldLabel>
          <input
            className={configCompactInputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Monthly Media Agreement"
          />
        </div>

        <div>
          <FieldLabel>Contract type *</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={contractType}
            onChange={(e) => {
              const next = e.target.value as "ONE_TIME" | "MONTHLY";
              setContractType(next);
              setPaymentTerms("");
              if (next === "ONE_TIME") setDuration("");
            }}
          >
            {CONTRACT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {!isOneTime ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Contract duration *</FieldLabel>
              <select
                className={configCompactSelectClass}
                value={duration}
                onChange={(e) => setDuration(e.target.value as ContractDuration)}
              >
                <option value="">Select duration</option>
                {CONTRACT_DURATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Start date *</FieldLabel>
              <input type="date" className={configCompactInputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Start date *</FieldLabel>
              <input type="date" className={configCompactInputClass} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <FieldLabel>Completion date *</FieldLabel>
              <input type="date" className={configCompactInputClass} value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
        )}

        {!isOneTime && !isEndless && (
          <div>
            <FieldLabel>End date</FieldLabel>
            <input
              type="date"
              className={cn(configCompactInputClass, "bg-zinc-50")}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate || undefined}
            />
            <p className="mt-1 text-xs text-zinc-500">Calculated from the start date and duration. You may adjust it.</p>
          </div>
        )}

        {isEndless && (
          <p className="rounded-md border border-zinc-100 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
            This contract has no end date. Choose a billing period for automatic payments, or enter a custom payment arrangement.
          </p>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel>Total contract amount (USD) *</FieldLabel>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-500">$</span>
              <input
                type="number"
                min={0.01}
                step="0.01"
                className={cn(configCompactInputClass, "pl-7")}
                value={contractAmount}
                onChange={(e) => setContractAmount(e.target.value)}
                placeholder="1000"
              />
            </div>
          </div>
          <div>
            <FieldLabel>Payment terms *</FieldLabel>
            <select
              className={configCompactSelectClass}
              value={paymentTerms}
              disabled={!isOneTime && !duration}
              onChange={(e) => setPaymentTerms(e.target.value)}
            >
              <option value="">{!isOneTime && !duration ? "Select a duration first" : "Select terms"}</option>
              {paymentOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            {!isOneTime && duration ? (
              <p className="mt-1 text-xs text-zinc-500"></p>
            ) : null}
            {savedTermsNeedReview ? (
              <p className="mt-1 text-xs font-medium text-amber-700">
                The saved payment term does not fit this duration. Choose a valid term before saving. Paid invoices and receipts stay unchanged.
              </p>
            ) : null}
          </div>
        </div>
 
        {isEndless && paymentTerms && paymentTerms !== "CUSTOM" ? (
          <div>
            <FieldLabel>Billing period *</FieldLabel>
            <select className={configCompactSelectClass} value={billingPeriodMonths} onChange={(e) => setBillingPeriodMonths(e.target.value)}>
              <option value="">Select a billing period</option>
              {billingOptions.map((months) => (
                <option key={months} value={months}>{months} months</option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">Endless contracts do not generate an open-ended schedule. Payments are created only for this period.</p>
          </div>
        ) : null}

        {paymentTerms === "CUSTOM" ? (
          <div className="rounded-lg border border-zinc-200 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-zinc-800">Custom payments</p>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary"
                onClick={() => setCustomRows((rows) => [...rows, newCustomRow({ milestone: "CUSTOM_DATE" })])}
              >
                <Plus className="size-3.5" /> Add payment
              </button>
            </div>
            <div className="space-y-2">
              {customRows.map((row, index) => {
                const percentage = Number(row.percentage);
                const amount = Number(contractAmount);
                const calculated = Number.isFinite(percentage) && percentage > 0 && Number.isFinite(amount)
                  ? (amount * percentage) / 100
                  : 0;
                return (
                  <div key={row.key} className="grid grid-cols-1 gap-2 rounded-md border border-zinc-100 bg-zinc-50 p-2 sm:grid-cols-[72px_1fr_1fr_7.5rem_auto]">
                    <input
                      type="number"
                      min={0.01}
                      max={100}
                      step="0.01"
                      className={configCompactInputClass}
                      value={row.percentage}
                      placeholder="%"
                      onChange={(e) => setCustomRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, percentage: e.target.value } : item))}
                    />
                    <select
                      className={configCompactSelectClass}
                      value={row.milestone}
                      onChange={(e) => setCustomRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, milestone: e.target.value } : item))}
                    >
                      {PAYMENT_MILESTONES.filter((milestone) => isEndless ? milestone.value !== "CONTRACT_COMPLETION" : true).map((milestone) => (
                        <option key={milestone.value} value={milestone.value}>{milestone.label}</option>
                      ))}
                    </select>
                    {row.milestone === "CUSTOM_DATE" ? (
                      <input type="date" className={configCompactInputClass} value={row.dueDate} min={startDate || undefined} max={!isEndless && endDate ? endDate : undefined} onChange={(e) => setCustomRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, dueDate: e.target.value } : item))} />
                    ) : (
                      <p className="flex items-center px-1 text-xs text-zinc-600">${calculated.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    )}
                    <input
                      type="time"
                      className={configCompactInputClass}
                      value={row.dueTime || "00:00"}
                      onChange={(e) => setCustomRows((rows) => rows.map((item, itemIndex) => itemIndex === index ? { ...item, dueTime: e.target.value } : item))}
                    />
                    <button type="button" className="text-zinc-400 hover:text-red-600" aria-label="Remove payment" onClick={() => setCustomRows((rows) => rows.filter((item) => item.key !== row.key))}>
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {paymentPreview && (
          <div className="rounded-lg border border-zinc-200 bg-zinc-50/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment schedule preview</p>
            {paymentPreview.error ? (
              <p className="mt-2 text-sm text-red-600">{paymentPreview.error}</p>
            ) : (
              <>
                <div className="mt-2 grid gap-2 text-sm text-zinc-700 sm:grid-cols-2">
                  <p><span className="text-zinc-500">Total amount: </span><span className="font-semibold">${paymentPreview.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></p>
                  <p><span className="text-zinc-500">Payment terms: </span><span className="font-semibold">{contractPaymentTermsLabel(paymentTerms)}</span></p>
                </div>
                <div className="mt-3 overflow-x-auto rounded-md border border-zinc-100 bg-white">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead className="border-b border-zinc-100 bg-zinc-50 text-zinc-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Payment</th>
                        <th className="px-3 py-2 font-semibold">Percentage</th>
                        <th className="px-3 py-2 font-semibold">Due</th>
                        <th className="px-3 py-2 font-semibold">Status</th>
                        <th className="px-3 py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentPreview.installments.map((row) => (
                        <tr key={row.installmentNumber} className="border-b border-zinc-50 last:border-0">
                          <td className="px-3 py-2 text-zinc-800">Payment {String(row.installmentNumber).padStart(2, "0")}</td>
                          <td className="px-3 py-2 text-zinc-600">{row.percentage}%</td>
                          <td className="px-3 py-2 text-zinc-600">{paymentMilestoneLabel(row.dueMilestone)} · {formatDate(row.dueDate, true)}{row.dueTime ? ` · ${row.dueTime}` : ""}</td>
                          <td className="px-3 py-2 text-zinc-600">{paymentStatusLabel(row.status)}</td>
                          <td className="px-3 py-2 text-right font-medium text-zinc-800">${row.dueAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-2 text-[11px] text-zinc-500">This schedule shows when payment is due. It does not record money received.</p>
              </>
            )}
          </div>
        )}

        <div>
          <FieldLabel>Status *</FieldLabel>
          <select
            className={configCompactSelectClass}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            {CONTRACT_REGISTRATION_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel>Signed contract (PDF or image)</FieldLabel>
          {formType === "edit" && existingDocument && !pendingFile ? (
            <p className="mb-2 text-xs text-zinc-500">
              Current file: {existingDocument.fileName}
              {existingDocument.version ? ` (v${existingDocument.version})` : ""}. Choose a new file to add
              another version.
            </p>
          ) : null}
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
              className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-zinc-300 hover:bg-zinc-50"
            >
              <Paperclip className="h-4 w-4 text-zinc-500" />
              {pendingFile ? "Change file" : "Attach document"}
            </button>
            {pendingFile ? (
              <div className="flex items-center gap-1.5 rounded-md bg-zinc-100 px-3 py-1.5 text-xs text-zinc-600">
                <Upload className="h-3.5 w-3.5 text-primary" />
                <span className="max-w-[200px] truncate">{pendingFile.name}</span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="ml-1 text-zinc-400 hover:text-zinc-700"
                  aria-label="Remove file"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">Optional. Upload the signed agreement PDF.</p>
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
