"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ClientSchemaRecord } from "@/lib/apis/schemaApi";
import { cn } from "@/lib/utils";
import { Calendar, Download, Printer, X } from "lucide-react";
import { useRef } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema?: ClientSchemaRecord | null;
}

const DAYS = [
  { key: "saturday", labelEn: "Saturday", labelAr: "السبت" },
  { key: "sunday", labelEn: "Sunday", labelAr: "الأحد" },
  { key: "monday", labelEn: "Monday", labelAr: "الإثنين" },
  { key: "tuesday", labelEn: "Tuesday", labelAr: "الثلاثاء" },
  { key: "wednesday", labelEn: "Wednesday", labelAr: "الأربعاء" },
  { key: "thursday", labelEn: "Thursday", labelAr: "الخميس" },
  { key: "friday", labelEn: "Friday", labelAr: "الجمعة" },
] as const;

export default function SchemaViewModal({ open, onOpenChange, schema }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!schema) return null;

  function handlePrint() {
    const content = printRef.current;
    if (!content) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${schema?.client?.institution || "Client"} - Weekly Content Schema</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #111; }
            h2 { text-align: center; margin-bottom: 20px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 2px solid #888; padding: 12px; text-align: center; font-size: 14px; }
            th { background-color: #f3d0d7; color: #501625; font-weight: bold; }
            .day-ar { font-size: 11px; display: block; opacity: 0.8; }
            .client-title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .notes { margin-top: 20px; font-style: italic; font-size: 13px; color: #444; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <h2>${schema.client?.institution || "CLIENT CONTENT SCHEMA"}</h2>
          <table>
            <thead>
              <tr>
                ${DAYS.map(
                  (day) =>
                    `<th>
                      <div>${day.labelEn}</div>
                      <div class="day-ar">${day.labelAr}</div>
                    </th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${DAYS.map(
                  (day) =>
                    `<td>${(schema as any)[day.key] || "—"}</td>`
                ).join("")}
              </tr>
            </tbody>
          </table>
          ${schema.notes ? `<div class="notes">Notes: ${schema.notes}</div>` : ""}
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] flex flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-3xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-zinc-900">
            <Calendar className="size-5 text-primary" />
            Weekly Content Schema View
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {schema.client?.institution || "Subscription Client Schema"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div ref={printRef} className="space-y-6">
            {/* Header banner */}
            <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-4 text-center">
              <h3 className="text-xl font-black uppercase tracking-wide text-rose-950">
                {schema.client?.institution || "JANAGLE SPARE PARTS GROUP"}
              </h3>
              <p className="mt-0.5 text-xs text-rose-700 font-medium">
                Official Content Schedule & Posting Calendar
              </p>
            </div>

            {/* Table layout matching paper reference */}
            <div className="overflow-x-auto rounded-lg border border-zinc-200 shadow-xs">
              <table className="w-full text-center text-sm border-collapse">
                <thead>
                  <tr className="bg-rose-100 text-rose-950 border-b border-rose-200">
                    {DAYS.map((day) => (
                      <th
                        key={day.key}
                        className="border-r border-rose-200 px-3 py-3 font-bold last:border-r-0"
                      >
                        <div className="text-xs uppercase font-extrabold tracking-wider">{day.labelEn}</div>
                        <div className="text-[11px] font-arabic font-medium text-rose-800">{day.labelAr}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="bg-white hover:bg-zinc-50/80 transition-colors">
                    {DAYS.map((day) => {
                      const val = (schema as any)[day.key];
                      return (
                        <td
                          key={day.key}
                          className="border-r border-zinc-200 p-4 font-semibold text-zinc-800 align-middle last:border-r-0"
                        >
                          {val ? (
                            <span className="inline-block rounded-md bg-rose-50/80 border border-rose-100 px-2.5 py-1.5 text-xs text-rose-900 shadow-2xs font-medium">
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

            {schema.notes && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3.5 text-xs text-amber-900">
                <span className="font-bold uppercase tracking-wider">Note: </span>
                {schema.notes}
              </div>
            )}
          </div>
        </div>

        {/* Modal actions */}
        <div className="flex shrink-0 items-center justify-between border-t border-zinc-100 bg-zinc-50 px-6 py-3.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-9 px-4 text-xs font-semibold text-zinc-700"
          >
            <X className="size-4 mr-1.5" />
            Close
          </Button>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              className="h-9 px-3.5 text-xs font-semibold border-zinc-300 text-zinc-700 hover:bg-zinc-100"
            >
              <Printer className="size-4 mr-1.5 text-zinc-600" />
              Print Schema
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              className="h-9 px-4 text-xs font-semibold bg-primary text-white hover:bg-primary/90 shadow-xs"
            >
              <Download className="size-4 mr-1.5" />
              Download PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
