"use client";

import { useCallback, useRef, useState } from "react";
import { GripVertical, Plus, Trash2, Upload } from "lucide-react";
import {
  accountingFormFieldClass,
  accountingFormSelectClass,
  accountingToast,
} from "@/lib/accounting-ui";
import { documentTemplateApi, type TemplatePlaceholder } from "@/lib/api/documentTemplateApi";
import { cn } from "@/lib/utils";

export const TEMPLATE_FIELD_CATALOG: Array<{ key: string; label: string; isTable?: boolean }> = [
  { key: "company_name", label: "Company Name" },
  { key: "company_address", label: "Company Address" },
  { key: "client_name", label: "Customer Name" },
  { key: "client_address", label: "Customer Address" },
  { key: "client_email", label: "Customer Email" },
  { key: "client_phone", label: "Customer Phone" },
  { key: "quotation_number", label: "Quotation Number" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "quotation_date", label: "Quotation Date" },
  { key: "invoice_date", label: "Invoice Date" },
  { key: "quotation_valid_until", label: "Valid Until" },
  { key: "invoice_due_date", label: "Due Date" },
  { key: "items", label: "Line Items Table", isTable: true },
  { key: "subtotal", label: "Subtotal" },
  { key: "discount", label: "Discount" },
  { key: "tax", label: "Tax" },
  { key: "total", label: "Grand Total" },
  { key: "amount_paid", label: "Amount Paid" },
  { key: "balance_due", label: "Balance Due" },
  { key: "payment_terms", label: "Payment Terms" },
  { key: "terms", label: "Terms & Conditions" },
  { key: "notes", label: "Notes" },
];

type Props = {
  fileUrl: string;
  placeholders: TemplatePlaceholder[];
  onFileUrlChange: (url: string) => void;
  onPlaceholdersChange: (fields: TemplatePlaceholder[]) => void;
};

function resolveImageUrl(url: string) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export default function DocumentTemplateDesigner({
  fileUrl,
  placeholders,
  onFileUrlChange,
  onPlaceholdersChange,
}: Props) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      accountingToast("Please upload a PNG or JPG design image", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        setUploading(true);
        const dataUrl = String(reader.result || "");
        const result = await documentTemplateApi.uploadBackground(dataUrl, file.name);
        onFileUrlChange(result.file_url);
        accountingToast("Design uploaded successfully");
      } catch (error) {
        accountingToast(error instanceof Error ? error.message : "Upload failed", "error");
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [onFileUrlChange]);

  function addField(catalogKey: string) {
    const meta = TEMPLATE_FIELD_CATALOG.find((item) => item.key === catalogKey);
    if (!meta) return;
    if (placeholders.some((field) => field.key === catalogKey)) {
      accountingToast("This field is already on the design", "error");
      return;
    }
    const nextY = 8 + placeholders.length * 6;
    onPlaceholdersChange([
      ...placeholders,
      {
        id: `${catalogKey}-${Date.now()}`,
        key: catalogKey,
        label: meta.label,
        x: meta.isTable ? 5 : 8,
        y: Math.min(nextY, meta.isTable ? 42 : 85),
        width: meta.isTable ? 90 : 35,
        fontSize: meta.isTable ? 11 : 13,
        isTable: meta.isTable,
      },
    ]);
  }

  function updateField(id: string, patch: Partial<TemplatePlaceholder>) {
    onPlaceholdersChange(
      placeholders.map((field) => (field.id === id ? { ...field, ...patch } : field)),
    );
  }

  function removeField(id: string) {
    onPlaceholdersChange(placeholders.filter((field) => field.id !== id));
  }

  function handleCanvasPointerMove(event: React.PointerEvent) {
    if (!dragId || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    updateField(dragId, {
      x: Math.max(0, Math.min(95, x - 2)),
      y: Math.max(0, Math.min(95, y - 1)),
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="space-y-3 rounded-xl border border-zinc-200 bg-white p-4">
        <div>
          <p className="text-sm font-semibold text-zinc-800">1. Upload design</p>
          <p className="mt-1 text-xs text-zinc-500">
            Upload your blank quotation or invoice design (PNG/JPG). No coding required.
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center hover:bg-zinc-100">
          <Upload className="mb-2 size-5 text-primary" />
          <span className="text-xs font-semibold text-zinc-700">
            {uploading ? "Uploading…" : "Choose design file"}
          </span>
          <span className="mt-1 text-[11px] text-zinc-500">PNG or JPG, max 8MB</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadFile(file);
              event.target.value = "";
            }}
          />
        </label>

        <div className="border-t border-zinc-100 pt-3">
          <p className="text-sm font-semibold text-zinc-800">2. Add text fields</p>
          <p className="mt-1 text-xs text-zinc-500">Click a field, then drag it on the design.</p>
          <div className="mt-3 max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
            {TEMPLATE_FIELD_CATALOG.map((item) => {
              const added = placeholders.some((field) => field.key === item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  disabled={added}
                  onClick={() => addField(item.key)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs transition",
                    added
                      ? "cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-zinc-200 bg-white hover:border-primary/30 hover:bg-primary/5",
                  )}
                >
                  <span className="font-medium">{item.label}</span>
                  {!added ? <Plus className="size-3.5 text-primary" /> : <span className="text-[10px]">Added</span>}
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-4">
        {!fileUrl ? (
          <div className="flex min-h-[520px] items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white text-sm text-zinc-500">
            Upload a design to start placing fields
          </div>
        ) : (
          <div
            ref={canvasRef}
            className="relative mx-auto aspect-[794/1123] w-full max-w-[640px] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm"
            style={{
              backgroundImage: `url(${resolveImageUrl(fileUrl)})`,
              backgroundSize: "cover",
              backgroundPosition: "top center",
            }}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={() => setDragId(null)}
            onPointerLeave={() => setDragId(null)}
          >
            {placeholders.map((field) => (
              <div
                key={field.id}
                className={cn(
                  "group absolute cursor-grab rounded border border-primary/40 bg-white/90 px-2 py-1 shadow-sm active:cursor-grabbing",
                  dragId === field.id && "ring-2 ring-primary",
                )}
                style={{
                  left: `${field.x}%`,
                  top: `${field.y}%`,
                  width: `${field.width}%`,
                  fontSize: `${field.fontSize || 13}px`,
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setDragId(field.id);
                  (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
                }}
              >
                <div className="flex items-center gap-1">
                  <GripVertical className="size-3 shrink-0 text-zinc-400" />
                  <span className="truncate text-[11px] font-semibold text-primary">{field.label}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeField(field.id);
                    }}
                    className="ml-auto rounded p-0.5 text-rose-600 opacity-0 transition group-hover:opacity-100 hover:bg-rose-50"
                  >
                    <Trash2 className="size-3" />
                  </button>
                </div>
                {field.isTable ? (
                  <div className="mt-1 rounded border border-dashed border-zinc-300 bg-zinc-50 px-2 py-3 text-[10px] text-zinc-500">
                    Items table area
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}

        {fileUrl && placeholders.length > 0 ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {placeholders.map((field) => (
              <div key={`cfg-${field.id}`} className="rounded-lg border border-zinc-200 bg-white p-3">
                <p className="text-xs font-semibold text-zinc-700">{field.label}</p>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <label className="text-[11px] text-zinc-500">
                    Width %
                    <input
                      type="number"
                      min={10}
                      max={100}
                      value={field.width}
                      onChange={(event) => updateField(field.id, { width: Number(event.target.value) })}
                      className={`mt-1 ${accountingFormFieldClass}`}
                    />
                  </label>
                  <label className="text-[11px] text-zinc-500">
                    Font size
                    <input
                      type="number"
                      min={8}
                      max={28}
                      value={field.fontSize || 13}
                      onChange={(event) => updateField(field.id, { fontSize: Number(event.target.value) })}
                      className={`mt-1 ${accountingFormFieldClass}`}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
