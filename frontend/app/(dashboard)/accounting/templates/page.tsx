"use client";

import { useEffect, useState } from "react";
import { Plus, SquarePen, Trash2, FileText, CheckCircle2, RefreshCw, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountingPageShell from "@/components/accounting/AccountingPageShell";
import AccountingConfirmDialog from "@/components/accounting/AccountingConfirmDialog";
import DocumentTemplateDesigner from "@/components/config/DocumentTemplateDesigner";
import {
  accountingDialogFormWideClass,
  accountingFormFieldClass,
  accountingFormSelectClass,
  accountingToast,
  btnFormCancel,
  btnFormSubmit,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
} from "@/lib/accounting-ui";
import {
  documentTemplateApi,
  type DocumentTemplate,
  type TemplatePlaceholder,
} from "@/lib/api/documentTemplateApi";
import { btnCreatePage, dashboardCardClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

function resolveImageUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function normalizePlaceholders(raw: unknown): TemplatePlaceholder[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => ({
    id: String((item as TemplatePlaceholder).id || `${(item as TemplatePlaceholder).key}-${index}`),
    key: String((item as TemplatePlaceholder).key || ""),
    label: String((item as TemplatePlaceholder).label || (item as TemplatePlaceholder).key || ""),
    x: Number((item as TemplatePlaceholder).x ?? 5),
    y: Number((item as TemplatePlaceholder).y ?? 5),
    width: Number((item as TemplatePlaceholder).width ?? 30),
    fontSize: Number((item as TemplatePlaceholder).fontSize ?? 13),
    isTable: Boolean((item as TemplatePlaceholder).isTable),
  }));
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"quotation" | "invoice">("quotation");

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<"quotation" | "invoice">("quotation");
  const [fileUrl, setFileUrl] = useState("");
  const [placeholders, setPlaceholders] = useState<TemplatePlaceholder[]>([]);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await documentTemplateApi.getAll();
      setTemplates(data || []);
    } catch (err: unknown) {
      accountingToast(err instanceof Error ? err.message : "Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const handleOpenModal = (tpl?: DocumentTemplate) => {
    if (tpl) {
      setSelectedTemplate(tpl);
      setName(tpl.name);
      setType(tpl.type);
      setFileUrl(tpl.file_url || "");
      setPlaceholders(normalizePlaceholders(tpl.placeholders));
      setIsDefault(tpl.is_default);
    } else {
      setSelectedTemplate(null);
      setName("");
      setType(activeTab);
      setFileUrl("");
      setPlaceholders([]);
      setIsDefault(false);
    }
    setModalOpen(true);
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    if (!fileUrl) {
      accountingToast("Upload a design image before saving", "error");
      return;
    }
    if (placeholders.length === 0) {
      accountingToast("Add at least one text field on the design", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name,
        type,
        file_url: fileUrl,
        html_content: null,
        is_default: isDefault,
        placeholders,
      };

      if (selectedTemplate) {
        await documentTemplateApi.update(selectedTemplate.id, payload);
        accountingToast("Template updated successfully");
      } else {
        await documentTemplateApi.create(payload);
        accountingToast("Template created successfully");
      }
      setModalOpen(false);
      await loadData();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : err instanceof Error
            ? err.message
            : "Failed to save template";
      accountingToast(message || "Failed to save template", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      setSaving(true);
      await documentTemplateApi.delete(deleteTarget.id);
      accountingToast("Template deleted");
      setDeleteTarget(null);
      await loadData();
    } catch (err: unknown) {
      accountingToast(err instanceof Error ? err.message : "Failed to delete template", "error");
    } finally {
      setSaving(false);
    }
  };

  const filtered = templates.filter((t) => t.type === activeTab);

  return (
    <AccountingPageShell
      section="Configuration"
      title="Templates"
      description="Upload your blank quotation or invoice design, then place text fields visually. No coding required."
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          {(["quotation", "invoice"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-lg px-4 py-2 text-sm font-semibold transition-all",
                activeTab === tab
                  ? "bg-primary text-white shadow-sm"
                  : "border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50",
              )}
            >
              {tab === "quotation" ? "Quotation" : "Invoice"} Templates (
              {templates.filter((t) => t.type === tab).length})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadData()} className="h-10 gap-1 text-xs">
            <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <button type="button" onClick={() => handleOpenModal()} className={btnCreatePage}>
            <Plus className="size-4" /> Add Template
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tpl) => (
          <article key={tpl.id} className={cn(dashboardCardClass, "flex flex-col p-5")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <FileText className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-800">{tpl.name}</h3>
                  <p className="text-xs uppercase font-semibold text-zinc-400">{tpl.type}</p>
                </div>
              </div>
              {tpl.is_default ? (
                <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  <CheckCircle2 className="size-3" /> Default
                </span>
              ) : null}
            </div>

            <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50">
              {tpl.file_url ? (
                <img
                  src={resolveImageUrl(tpl.file_url)}
                  alt={tpl.name}
                  className="h-40 w-full object-cover object-top"
                />
              ) : (
                <div className="flex h-40 flex-col items-center justify-center text-zinc-400">
                  <ImageIcon className="mb-2 size-6" />
                  <span className="text-xs">System default layout</span>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-zinc-500">
              {Array.isArray(tpl.placeholders) && tpl.placeholders.length
                ? `${tpl.placeholders.length} mapped fields`
                : "Built-in system template"}
            </p>

            <div className="mt-4 flex justify-end gap-2 border-t border-zinc-100 pt-3">
              <Button size="sm" variant="outline" onClick={() => handleOpenModal(tpl)} className="h-8 text-xs gap-1">
                <SquarePen className="size-3.5" /> Edit
              </Button>
              {!tpl.is_default ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteTarget(tpl)}
                  className="h-8 text-xs text-red-600 hover:bg-red-50 gap-1"
                >
                  <Trash2 className="size-3.5" /> Delete
                </Button>
              ) : null}
            </div>
          </article>
        ))}

        {filtered.length === 0 && !loading ? (
          <div className={cn(dashboardCardClass, "col-span-full p-12 text-center text-zinc-500")}>
            No custom {activeTab} templates yet. Upload your own design to get started.
          </div>
        ) : null}
      </div>

      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent className={accountingDialogFormWideClass}>
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>
              {selectedTemplate ? `Edit Template (${selectedTemplate.name})` : "Create Document Template"}
            </DialogTitle>
            <p className="text-sm text-zinc-500">
              Upload your blank design and drag fields where the text should appear on the PDF.
            </p>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className={configDialogBodyClass}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium text-zinc-700">
                  Template Name *
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Modern Quotation"
                    className={`mt-1 ${accountingFormFieldClass}`}
                  />
                </label>
                <label className="text-sm font-medium text-zinc-700">
                  Document Type
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as "quotation" | "invoice")}
                    className={`mt-1 ${accountingFormSelectClass}`}
                  >
                    <option value="quotation">Quotation Template</option>
                    <option value="invoice">Invoice Template</option>
                  </select>
                </label>
              </div>

              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                  className="size-4 accent-primary rounded"
                />
                Set as default template for {type === "quotation" ? "quotations" : "invoices"}
              </label>

              <DocumentTemplateDesigner
                fileUrl={fileUrl}
                placeholders={placeholders}
                onFileUrlChange={setFileUrl}
                onPlaceholdersChange={setPlaceholders}
              />
            </div>

            <DialogFooter className={configDialogFooterClass}>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className={btnFormCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className={btnFormSubmit}>
                {saving ? "Saving…" : "Save Template"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AccountingConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Template"
        description="This template will be permanently removed."
        confirmLabel="Delete Template"
        destructive
        busy={saving}
        details={
          deleteTarget ? (
            <div className="flex justify-between">
              <span className="text-zinc-500">Template</span>
              <b>{deleteTarget.name}</b>
            </div>
          ) : null
        }
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />
    </AccountingPageShell>
  );
}
