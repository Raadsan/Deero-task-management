"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  configInfoFieldClass,
  configInfoLabelClass,
} from "@/components/config/config-dialog-styles";
import {
  getContractById,
  uploadContractDocument,
} from "@/lib/apis/contractApi";
import { CONTRACT_STATUS_OPTIONS } from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormSubmit } from "@/lib/dashboard-ui";
import { resolveApiAssetUrl } from "@/lib/apis/config";
import { cn, formatDate } from "@/lib/utils";
import {
  Calendar,
  DollarSign,
  Download,
  FileText,
  Handshake,
  Upload,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractId?: string;
}

function statusLabel(status: string) {
  return CONTRACT_STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status;
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

export default function ContractViewModal({ open, onOpenChange, contractId }: Props) {
  const { mutate } = useSWRConfig();
  const [previewVersion, setPreviewVersion] = useState<number | null>(null);

  const { data, isLoading, mutate: mutateContract } = useSWR(
    open && contractId ? ["contract-view-modal", contractId] : null,
    () => getContractById(contractId!),
  );

  const contract = data?.data;

  useEffect(() => {
    if (!contract?.documents?.length) {
      setPreviewVersion(null);
      return;
    }
    setPreviewVersion((current) => current ?? contract.documents![0]?.version ?? null);
  }, [contract]);

  const previewDoc =
    contract?.documents?.find((doc) => doc.version === previewVersion) ??
    contract?.documents?.[0];

  async function handleUpload(file: File) {
    if (!contractId) return;
    try {
      const filePayload = await readFileAsDataUrl(file);
      const result = await uploadContractDocument(contractId, filePayload);
      if (!result.success) throw new Error(result.errors?.message ?? "Upload failed");
      toast.success(`Version ${result.data?.version} uploaded`);
      mutate(SWR_CACH_KEYS.contracts.key);
      mutateContract();
      setPreviewVersion(result.data?.version ?? null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="text-xl font-bold text-[#1e293b]">
            Contract Details
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {contract?.contractNumber ?? "View agreement, documents, and payment terms."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="space-y-4 animate-pulse py-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-lg bg-zinc-100" />
              ))}
            </div>
          ) : !contract ? (
            <p className="text-sm text-zinc-500">Contract not found.</p>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
              <div className="space-y-3">
                <div className={configInfoFieldClass}>
                  <p className={configInfoLabelClass}>Client</p>
                  <p className="mt-1 flex items-center gap-2 font-medium text-zinc-800">
                    <Handshake className="h-4 w-4 text-primary" />
                    {contract.client?.institution ?? "—"}
                  </p>
                </div>

                {contract.project?.name && (
                  <div className={configInfoFieldClass}>
                    <p className={configInfoLabelClass}>Project</p>
                    <p className="mt-1 font-medium text-zinc-800">{contract.project.name}</p>
                  </div>
                )}

                <div className={configInfoFieldClass}>
                  <p className={configInfoLabelClass}>Status</p>
                  <p className="mt-1 font-medium text-zinc-800">{statusLabel(contract.status)}</p>
                </div>

                <div className={configInfoFieldClass}>
                  <p className={configInfoLabelClass}>Amount</p>
                  <p className="mt-1 flex items-center gap-2 font-medium text-zinc-800">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                    {contract.totalAmount != null
                      ? `$${contract.totalAmount.toLocaleString()}`
                      : "—"}
                  </p>
                </div>

                <div className={configInfoFieldClass}>
                  <p className={configInfoLabelClass}>Period</p>
                  <p className="mt-1 flex items-start gap-2 text-sm text-zinc-700">
                    <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    <span>
                      {contract.startDate ? formatDate(String(contract.startDate)) : "—"}
                      {contract.endDate
                        ? ` → ${formatDate(String(contract.endDate))}`
                        : ""}
                    </span>
                  </p>
                </div>

                {contract.paymentTerms && (
                  <div className={configInfoFieldClass}>
                    <p className={configInfoLabelClass}>Payment terms</p>
                    <p className="mt-1 text-sm text-zinc-700">{contract.paymentTerms}</p>
                  </div>
                )}

                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                    Document versions
                  </p>
                  <div className="space-y-2">
                    {(contract.documents ?? []).length === 0 ? (
                      <p className="text-sm text-zinc-500">No document uploaded yet.</p>
                    ) : (
                      contract.documents?.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => setPreviewVersion(doc.version)}
                          className={cn(
                            "flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-sm transition",
                            previewVersion === doc.version
                              ? "border-primary bg-primary/5 shadow-2xs"
                              : "border-zinc-200 hover:bg-zinc-50",
                          )}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="flex items-center gap-2 font-medium text-zinc-800">
                              <FileText className="h-4 w-4 text-primary" />
                              Version {doc.version} · {doc.fileName}
                            </span>
                            <span className="text-[11px] text-zinc-500 pl-6">
                              {doc.uploadedBy?.name ? `Uploaded by ${doc.uploadedBy.name}` : "Uploaded"}{" "}
                              {doc.createdAt ? `on ${formatDate(String(doc.createdAt))}` : ""}
                            </span>
                          </div>
                          <a
                            href={resolveApiAssetUrl(doc.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-md p-1.5 text-primary hover:bg-primary/10 transition-colors"
                            title="Download version"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-3 text-sm text-zinc-600 transition hover:bg-zinc-50">
                  <Upload className="h-4 w-4" />
                  Upload new version
                  <input
                    type="file"
                    accept="application/pdf,image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void handleUpload(file);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="min-h-[320px] overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
                {previewDoc ? (
                  previewDoc.mimeType?.startsWith("image/") ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={resolveApiAssetUrl(previewDoc.fileUrl)}
                      alt={previewDoc.fileName}
                      className="h-full max-h-[55vh] w-full object-contain"
                    />
                  ) : (
                    <iframe
                      title="Contract preview"
                      src={resolveApiAssetUrl(previewDoc.fileUrl)}
                      className="h-[55vh] w-full"
                    />
                  )
                ) : (
                  <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-zinc-400">
                    <FileText className="h-10 w-10" />
                    <p className="text-sm">Upload a signed contract PDF to preview it here.</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-zinc-100 px-6 py-4">
          <Button className={btnFormSubmit} onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
