"use client";

import { useEffect, useState } from "react";
import {
  Plus,
  SquarePen,
  Trash2,
  FileText,
  CheckCircle2,
  RefreshCw,
  ImageIcon,
  Upload,
  FileSpreadsheet,
  FileCode,
  Download,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AccountingPageShell from "@/components/accounting/AccountingPageShell";
import AccountingConfirmDialog from "@/components/accounting/AccountingConfirmDialog";
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
} from "@/lib/api/documentTemplateApi";
import { btnCreatePage, dashboardCardClass } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

function resolveImageUrl(url?: string | null) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:7003";
  return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function getFileExtension(url?: string | null): string {
  if (!url) return "";
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "pdf";
  if (clean.endsWith(".doc")) return "doc";
  if (clean.endsWith(".docx")) return "docx";
  if (clean.endsWith(".png") || clean.endsWith(".jpg") || clean.endsWith(".jpeg") || clean.endsWith(".webp")) return "image";
  return "file";
}

export default function DocumentTemplatesPage() {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"quotation" | "invoice">("quotation");

  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DocumentTemplate | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"quotation" | "invoice">("quotation");
  const [fileUrl, setFileUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      setFileName(tpl.file_url ? tpl.file_url.split("/").pop() || "Template File" : "");
      setFileSize("");
      setIsDefault(tpl.is_default);
    } else {
      setSelectedTemplate(null);
      setName("");
      setType(activeTab);
      setFileUrl("");
      setFileName("");
      setFileSize("");
      setIsDefault(false);
    }
    setModalOpen(true);
  };

  const handleFileUpload = async (file: File) => {
    const validExtensions = [".pdf", ".doc", ".docx", ".png", ".jpg", ".jpeg", ".webp"];
    const fileExt = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

    if (!validExtensions.includes(fileExt)) {
      accountingToast("Please upload a PDF, DOC, DOCX, PNG, or JPG file", "error");
      return;
    }

    if (file.size > 16 * 1024 * 1024) {
      accountingToast("File is too large. Maximum size is 16MB.", "error");
      return;
    }

    try {
      setUploading(true);
      setFileName(file.name);
      setFileSize(`${(file.size / (1024 * 1024)).toFixed(2)} MB`);

      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const dataUrl = String(reader.result || "");
          const result = await documentTemplateApi.uploadBackground(dataUrl, file.name);
          setFileUrl(result.file_url);
          accountingToast(`${file.name} uploaded successfully!`);
        } catch (err: unknown) {
          accountingToast(err instanceof Error ? err.message : "Upload failed", "error");
          setFileUrl("");
        } finally {
          setUploading(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err: unknown) {
      accountingToast(err instanceof Error ? err.message : "Upload failed", "error");
      setUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      accountingToast("Please enter a template name", "error");
      return;
    }
    if (!fileUrl) {
      accountingToast("Please upload a PDF, DOC, or image template file", "error");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        type,
        file_url: fileUrl,
        html_content: null,
        is_default: isDefault,
        placeholders: null,
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
      title="Document Templates"
      description="Upload your official Quotation and Invoice templates (PDF, Word DOC/DOCX, or Images) to use for generating and exporting client documents."
    >
      {/* Tab Switcher & Action Bar */}
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
                  ? "bg-[#ea580c] text-white shadow-sm"
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
          <button type="button" onClick={() => handleOpenModal()} className={`${btnCreatePage} bg-[#ea580c] hover:bg-orange-700`}>
            <Plus className="size-4" /> Upload Template
          </button>
        </div>
      </div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((tpl) => {
          const ext = getFileExtension(tpl.file_url);

          return (
            <article key={tpl.id} className={cn(dashboardCardClass, "flex flex-col p-5 bg-white border border-zinc-200 rounded-xl shadow-sm hover:shadow-md transition-shadow")}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#ea580c] text-white shadow-sm">
                    {ext === "pdf" ? (
                      <FileText className="size-5 text-white" />
                    ) : ext === "doc" || ext === "docx" ? (
                      <FileSpreadsheet className="size-5 text-white" />
                    ) : (
                      <FileCode className="size-5 text-white" />
                    )}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-zinc-900">{tpl.name}</h3>
                    <p className="text-xs uppercase font-semibold text-zinc-400">{tpl.type}</p>
                  </div>
                </div>
                {tpl.is_default ? (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 className="size-3" /> Default
                  </span>
                ) : null}
              </div>

              {/* Document Preview Box */}
              <div className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center h-44">
                {tpl.file_url ? (
                  ext === "image" ? (
                    <img
                      src={resolveImageUrl(tpl.file_url)}
                      alt={tpl.name}
                      className="h-full w-full object-cover object-top"
                    />
                  ) : ext === "pdf" ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="size-14 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2 shadow-sm">
                        <FileText className="size-7" />
                      </div>
                      <span className="font-bold text-xs text-zinc-800">PDF Template Document</span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                        {tpl.file_url.split("/").pop()}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center">
                      <div className="size-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2 shadow-sm">
                        <FileSpreadsheet className="size-7" />
                      </div>
                      <span className="font-bold text-xs text-zinc-800">Word Document Template</span>
                      <span className="text-[11px] text-zinc-400 mt-0.5 truncate max-w-[200px]">
                        {tpl.file_url.split("/").pop()}
                      </span>
                    </div>
                  )
                ) : (
                  <div className="flex flex-col items-center justify-center text-zinc-400">
                    <ImageIcon className="mb-2 size-7 text-zinc-300" />
                    <span className="text-xs font-medium">Deero Branded System Layout</span>
                  </div>
                )}
              </div>

              {/* View/Download link if file uploaded */}
              <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
                <span>
                  {tpl.file_url ? (
                    <span className="font-medium text-emerald-700 flex items-center gap-1">
                      <Check className="size-3.5" /> Uploaded Document
                    </span>
                  ) : (
                    "Official System Template"
                  )}
                </span>
                {tpl.file_url && (
                  <a
                    href={resolveImageUrl(tpl.file_url)}
                    target="_blank"
                    rel="noreferrer"
                    className="font-bold text-[#ea580c] hover:underline flex items-center gap-1"
                  >
                    <Download className="size-3.5" /> View File
                  </a>
                )}
              </div>

              {/* Actions Footer */}
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
          );
        })}

        {filtered.length === 0 && !loading ? (
          <div className={cn(dashboardCardClass, "col-span-full p-12 text-center text-zinc-500")}>
            No custom {activeTab} templates yet. Click &quot;Upload Template&quot; to upload your PDF or Word document.
          </div>
        ) : null}
      </div>

      {/* Clean, Upload-Only Template Modal */}
      <Dialog open={modalOpen} onOpenChange={(open) => !saving && setModalOpen(open)}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-white">
          <DialogHeader className={`${configDialogHeaderClass} px-6 py-4 border-b`}>
            <DialogTitle className="text-lg font-bold text-zinc-900 flex items-center gap-2">
              <Upload className="size-5 text-[#ea580c]" />
              {selectedTemplate ? `Edit Template (${selectedTemplate.name})` : "Upload Document Template"}
            </DialogTitle>
            <p className="text-xs text-zinc-500 mt-1">
              Upload your official quotation or invoice document as a <strong>PDF, Word (.doc/.docx), or Image</strong>.
            </p>
          </DialogHeader>

          <form onSubmit={handleSave}>
            <div className={`${configDialogBodyClass} p-6 space-y-5`}>
              {/* Template Name & Document Type */}
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-xs font-semibold text-zinc-700">
                  Template Name *
                  <input
                    required
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="e.g. Deero Official Quotation"
                    className={`mt-1 h-9 ${accountingFormFieldClass}`}
                  />
                </label>
                <label className="text-xs font-semibold text-zinc-700">
                  Document Type *
                  <select
                    value={type}
                    onChange={(event) => setType(event.target.value as "quotation" | "invoice")}
                    className={`mt-1 h-9 ${accountingFormSelectClass}`}
                  >
                    <option value="quotation">Quotation Template</option>
                    <option value="invoice">Invoice Template</option>
                  </select>
                </label>
              </div>

              {/* Set as Default Checkbox */}
              <label className="flex items-center gap-2 text-xs font-medium text-zinc-700 cursor-pointer bg-zinc-50 p-3 rounded-lg border border-zinc-200">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(event) => setIsDefault(event.target.checked)}
                  className="size-4 text-[#ea580c] focus:ring-[#ea580c] rounded"
                />
                <span>Set as default template for {type === "quotation" ? "quotations" : "invoices"}</span>
              </label>

              {/* Upload Dropzone */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-zinc-700 block">
                  Template File (PDF, DOC, DOCX, PNG, JPG) *
                </label>

                {!fileUrl ? (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-orange-200 bg-orange-50/30 px-6 py-9 text-center hover:bg-orange-50/60 hover:border-orange-300 transition-all">
                    <div className="size-14 rounded-full bg-[#ea580c] flex items-center justify-center text-white mb-3 shadow-md">
                      <Upload className="size-6 text-white stroke-[2.5]" />
                    </div>
                    <span className="text-sm font-bold text-zinc-800">
                      {uploading ? "Uploading document…" : "Click to upload or drag & drop"}
                    </span>
                    <span className="mt-1 text-xs text-zinc-500">
                      Supports PDF, Microsoft Word (.doc, .docx), PNG, JPG (Max 16MB)
                    </span>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/jpg,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void handleFileUpload(file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                ) : (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold shrink-0">
                        <Check className="size-5" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-zinc-900 truncate max-w-[280px]">
                          {fileName || fileUrl.split("/").pop()}
                        </p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                          Document uploaded successfully {fileSize ? `(${fileSize})` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer text-xs font-bold text-[#ea580c] hover:underline px-2 py-1">
                        Replace File
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg,image/jpg,image/webp"
                          className="hidden"
                          disabled={uploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void handleFileUpload(file);
                            event.target.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setFileUrl("");
                          setFileName("");
                          setFileSize("");
                        }}
                        className="text-zinc-400 hover:text-red-600 p-1"
                        title="Remove"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <DialogFooter className={`${configDialogFooterClass} px-6 py-4 bg-zinc-50 border-t flex justify-end gap-2`}>
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className={btnFormCancel}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || uploading}
                className={`${btnFormSubmit} bg-[#ea580c] hover:bg-orange-700 font-bold`}
              >
                {saving ? "Saving…" : selectedTemplate ? "Update Template" : "Save Template"}
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
