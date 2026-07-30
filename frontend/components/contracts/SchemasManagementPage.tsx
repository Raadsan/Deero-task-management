"use client";

import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import SchemaFormModal from "@/components/contracts/SchemaFormModal";
import SchemaViewModal from "@/components/contracts/SchemaViewModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClientSchemaRecord,
  deleteSchema,
  getAllSchemas,
} from "@/lib/apis/schemaApi";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  Calendar,
  Download,
  Edit,
  Eye,
  Plus,
  Printer,
  Search,
  Trash2,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const DAYS = [
  { key: "saturday", labelEn: "Saturday", labelAr: "السبت" },
  { key: "sunday", labelEn: "Sunday", labelAr: "الأحد" },
  { key: "monday", labelEn: "Monday", labelAr: "الإثنين" },
  { key: "tuesday", labelEn: "Tuesday", labelAr: "الثلاثاء" },
  { key: "wednesday", labelEn: "Wednesday", labelAr: "الأربعاء" },
  { key: "thursday", labelEn: "Thursday", labelAr: "الخميس" },
  { key: "friday", labelEn: "Friday", labelAr: "الجمعة" },
] as const;

export default function SchemasManagementPage() {
  const [search, setSearch] = useState("");
  const [pending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [selectedSchema, setSelectedSchema] = useState<ClientSchemaRecord | null>(null);

  const [viewOpen, setViewOpen] = useState(false);
  const [viewSchema, setViewSchema] = useState<ClientSchemaRecord | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingSchema, setDeletingSchema] = useState<ClientSchemaRecord | null>(null);

  const { data: schemas = [], isLoading, mutate } = useSWR(
    "contracts/schemas",
    async () => {
      const res = await getAllSchemas();
      if (!res.success) throw new Error(res.errors?.message || "Failed to load schemas");
      return res.data ?? [];
    }
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return schemas;
    return schemas.filter((s) => {
      const name = s.client?.institution?.toLowerCase() || "";
      const phone = s.client?.phone?.toLowerCase() || "";
      return name.includes(q) || phone.includes(q);
    });
  }, [schemas, search]);

  function handleOpenCreate() {
    setSelectedSchema(null);
    setFormOpen(true);
  }

  function handleOpenEdit(item: ClientSchemaRecord) {
    setSelectedSchema(item);
    setFormOpen(true);
  }

  function handleOpenView(item: ClientSchemaRecord) {
    setViewSchema(item);
    setViewOpen(true);
  }

  function handleOpenDelete(item: ClientSchemaRecord) {
    setDeletingSchema(item);
    setDeleteOpen(true);
  }

  function confirmDelete() {
    if (!deletingSchema) return;
    startTransition(async () => {
      try {
        const res = await deleteSchema(deletingSchema.id);
        if (!res.success) throw new Error(res.errors?.message || "Failed to delete");
        toast.success("Schema deleted successfully");
        mutate();
        setDeleteOpen(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to delete schema");
      }
    });
  }

  function handleBulkPrint() {
    if (!filtered.length) {
      toast.error("No schemas to print");
      return;
    }
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const tablesHtml = filtered
      .map(
        (s) => `
        <div style="margin-bottom: 30px; page-break-inside: avoid;">
          <div style="background-color: #fce7f3; padding: 10px; border-radius: 6px; text-align: center; border: 1px solid #fbcfe8;">
            <h3 style="margin: 0; font-size: 16px; font-weight: 800; color: #831843; text-transform: uppercase;">
              ${s.client?.institution || "CLIENT SCHEMA"}
            </h3>
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
              <tr style="background-color: #f3d0d7; color: #501625;">
                ${DAYS.map(
                  (d) =>
                    `<th style="border: 1px solid #aaa; padding: 8px; font-size: 12px; text-align: center;">
                      <div>${d.labelEn}</div>
                      <div style="font-size: 10px; opacity: 0.8;">${d.labelAr}</div>
                    </th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${DAYS.map(
                  (d) =>
                    `<td style="border: 1px solid #aaa; padding: 10px; font-size: 12px; text-align: center; font-weight: 600;">
                      ${(s as any)[d.key] || "—"}
                    </td>`
                ).join("")}
              </tr>
            </tbody>
          </table>
        </div>
      `
      )
      .join("");

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Client Content Schemas</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #111; }
            h1 { text-align: center; font-size: 20px; font-weight: 900; margin-bottom: 25px; text-transform: uppercase; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 10mm; }
            }
          </style>
        </head>
        <body>
          <h1>Client Weekly Content Posting Schemas</h1>
          ${tablesHtml}
          <script>
            window.onload = function() {
              window.print();
              window.close();
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  return (
    <div className="space-y-6">
      <div className={dashboardCardClass}>
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-6 py-4">
          <div className="flex items-center gap-2">
            <Calendar className="size-5 text-primary" />
            <h2 className="text-base font-bold text-zinc-900">Client Weekly Schemas</h2>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-800">
              {filtered.length}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-60">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search schemas..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={compactInputClass}
              />
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleBulkPrint}
              className="h-9 px-3.5 text-xs font-semibold text-zinc-700 border-zinc-200 hover:bg-zinc-100"
            >
              <Printer className="size-4 mr-1.5 text-zinc-600" />
              Print / Export PDF
            </Button>

            <Button
              type="button"
              onClick={handleOpenCreate}
              className={cn(btnCreatePage, "h-9 px-4 text-xs font-semibold")}
            >
              <Plus className="size-4 mr-1" />
              Add Schema
            </Button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="space-y-4 py-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center">
              <Calendar className="mx-auto size-10 text-zinc-300" />
              <p className="mt-3 text-sm font-semibold text-zinc-700">No client schemas created yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Click "Add Schema" to create a weekly posting & content schedule for a client.
              </p>
              <Button
                type="button"
                onClick={handleOpenCreate}
                className="mt-4 h-9 px-4 text-xs font-semibold bg-primary text-white"
              >
                <Plus className="size-4 mr-1" /> Add First Schema
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-1">
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-zinc-200 bg-white shadow-2xs hover:shadow-xs transition-all overflow-hidden"
                >
                  {/* Card Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-100 bg-rose-50/50 px-5 py-3">
                    <div>
                      <h3 className="text-base font-extrabold text-rose-950 uppercase tracking-wide">
                        {item.client?.institution || "Subscription Client"}
                      </h3>
                      {item.client?.phone && (
                        <p className="text-xs text-rose-700 font-medium">{item.client.phone}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenView(item)}
                        className={cn(actionBtnView, "h-8 px-2.5 text-xs")}
                      >
                        <Eye className="size-3.5 mr-1" /> View & Print
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenEdit(item)}
                        className={cn(actionBtnEdit, "h-8 px-2.5 text-xs")}
                      >
                        <Edit className="size-3.5 mr-1" /> Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDelete(item)}
                        className={cn(actionBtnDelete, "h-8 px-2 text-xs")}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Schema Day-by-Day Table */}
                  <div className="overflow-x-auto p-4">
                    <table className="w-full text-center text-xs border-collapse">
                      <thead>
                        <tr className="bg-rose-100/70 text-rose-950">
                          {DAYS.map((day) => (
                            <th
                              key={day.key}
                              className="border border-rose-200 px-2 py-2 font-bold"
                            >
                              <div className="uppercase font-extrabold">{day.labelEn}</div>
                              <div className="font-arabic font-normal text-[10px] text-rose-800">
                                {day.labelAr}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="bg-white">
                          {DAYS.map((day) => {
                            const val = (item as any)[day.key];
                            return (
                              <td
                                key={day.key}
                                className="border border-zinc-200 p-3 font-semibold text-zinc-800 align-middle"
                              >
                                {val ? (
                                  <span className="inline-block rounded-md bg-rose-50 border border-rose-100 px-2 py-1 text-xs text-rose-900 font-medium">
                                    {val}
                                  </span>
                                ) : (
                                  <span className="text-zinc-300 font-normal">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Form Modal */}
      <SchemaFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        schema={selectedSchema}
        onSuccess={mutate}
      />

      {/* View & Print Modal */}
      <SchemaViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        schema={viewSchema}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Schema"
        description={`Are you sure you want to delete the content schema for ${deletingSchema?.client?.institution || "this client"}?`}
        onConfirm={confirmDelete}
        confirmLabel={pending ? "Deleting..." : "Delete Schema"}
        destructive
      />
    </div>
  );
}
