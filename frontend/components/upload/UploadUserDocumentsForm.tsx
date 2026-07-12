"use client";

import { Button } from "@/components/ui/button";
import {
  getUserUploadedFiles,
  saveUserFiles,
} from "@/lib/actions/user.action";
import { USER_DOCUMENT_TYPES } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Check, FileText, Upload, X } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";
import Loader from "../Shared/Loader";

type Props = {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
};

type DocumentSelection = {
  label: string;
  file: File;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function UploadUserDocumentsForm({
  userId,
  onSuccess,
  onCancel,
}: Props) {
  const { mutate } = useSWRConfig();
  const [transition, startTransition] = useTransition();
  const [selections, setSelections] = useState<Record<string, File>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data: filesRes, isLoading } = useSWR(
    ["user-uploaded-files", userId],
    () => getUserUploadedFiles(userId),
  );

  const existingByType = useMemo(() => {
    const map: Record<string, { id: string; name: string; fileSize: number }> =
      {};
    for (const file of filesRes?.data ?? []) {
      map[file.name] = file;
    }
    return map;
  }, [filesRes?.data]);

  function handleFilePick(typeLabel: string, fileList: FileList | null) {
    if (!fileList?.length) return;
    const file = fileList[0];

    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Only PDF files are allowed.");
      return;
    }

    if (file.size > 1024 * 1024) {
      toast.error(`"${file.name}" exceeds 1MB size limit.`);
      return;
    }

    setSelections((prev) => ({ ...prev, [typeLabel]: file }));
  }

  function clearSelection(typeLabel: string) {
    setSelections((prev) => {
      const next = { ...prev };
      delete next[typeLabel];
      return next;
    });
    if (inputRefs.current[typeLabel]) {
      inputRefs.current[typeLabel]!.value = "";
    }
  }

  function handleUpload() {
    const entries: DocumentSelection[] = USER_DOCUMENT_TYPES.map(({ label }) => ({
      label,
      file: selections[label],
    })).filter((item): item is DocumentSelection => Boolean(item.file));

    if (!entries.length) {
      toast.error("Select at least one document to upload.");
      return;
    }

    startTransition(async () => {
      try {
        const payload = await Promise.all(
          entries.map(async ({ label, file }) => ({
            name: file.name,
            documentType: label,
            fileSize: file.size,
            data: await readFileAsDataUrl(file),
          })),
        );

        const result = await saveUserFiles({ userId, files: payload });
        if (!result.success) {
          toast.error(
            result.errors?.message ??
              "Failed to upload documents. Please try again.",
          );
          return;
        }

        toast.success("Documents uploaded successfully.");
        setSelections({});
        for (const { label } of USER_DOCUMENT_TYPES) {
          if (inputRefs.current[label]) {
            inputRefs.current[label]!.value = "";
          }
        }
        mutate(["user-uploaded-files", userId]);
        mutate(["user-view-modal", userId]);
        onSuccess?.();
      } catch {
        toast.error("Failed to upload documents. Please try again.");
      }
    });
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[200px] items-center justify-center px-6 py-8">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-5">
        <p className="text-sm text-zinc-500">
          Upload PDF documents for this user. Each type can have one file (max
          1MB). Uploading again replaces the previous file of that type.
        </p>

        {USER_DOCUMENT_TYPES.map(({ id, label }) => {
          const selected = selections[label];
          const existing = existingByType[label];

          return (
            <div
              key={id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-4"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-zinc-800">{label}</p>
                {existing && !selected && (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
                    <Check className="size-3.5" />
                    Uploaded
                  </span>
                )}
              </div>

              {existing && !selected && (
                <p className="mb-2 truncate text-xs text-zinc-500">
                  Current: {existing.name} ({(existing.fileSize / 1024).toFixed(1)}{" "}
                  KB)
                </p>
              )}

              <input
                ref={(node) => {
                  inputRefs.current[label] = node;
                }}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={(event) =>
                  handleFilePick(label, event.target.files)
                }
              />

              {selected ? (
                <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-white px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-800">
                        {selected.name}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {(selected.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={transition}
                    onClick={() => clearSelection(label)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={transition}
                  onClick={() => inputRefs.current[label]?.click()}
                  className={cn(
                    "flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-600 transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <Upload className="size-4" />
                  Choose PDF
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-white px-6 py-4">
        {transition ? (
          <Loader />
        ) : (
          <>
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className={btnFormCancel}
              >
                Cancel
              </Button>
            )}
            <Button type="button" onClick={handleUpload} className={btnFormSubmit}>
              Upload Documents
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
