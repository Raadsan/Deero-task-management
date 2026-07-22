"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getClientsForForm } from "@/lib/actions/client.action";
import { ClientSchemaRecord, createOrUpdateSchema } from "@/lib/actions/schema.action";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { Calendar, Check, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema?: ClientSchemaRecord | null;
  onSuccess?: () => void;
}

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/10 transition-colors";

const compactSelectClass =
  "h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-800 outline-none focus:border-primary focus:bg-white transition-colors";

const DAYS = [
  { key: "saturday", labelEn: "Saturday", labelAr: "السبت", color: "bg-rose-50 border-rose-200 text-rose-800" },
  { key: "sunday", labelEn: "Sunday", labelAr: "الأحد", color: "bg-pink-50 border-pink-200 text-pink-800" },
  { key: "monday", labelEn: "Monday", labelAr: "الإثنين", color: "bg-purple-50 border-purple-200 text-purple-800" },
  { key: "tuesday", labelEn: "Tuesday", labelAr: "الثلاثاء", color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
  { key: "wednesday", labelEn: "Wednesday", labelAr: "الأربعاء", color: "bg-blue-50 border-blue-200 text-blue-800" },
  { key: "thursday", labelEn: "Thursday", labelAr: "الخميس", color: "bg-teal-50 border-teal-200 text-teal-800" },
  { key: "friday", labelEn: "Friday", labelAr: "الجمعة", color: "bg-emerald-50 border-emerald-200 text-emerald-800" },
] as const;

export default function SchemaFormModal({
  open,
  onOpenChange,
  schema,
  onSuccess,
}: Props) {
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();

  const [clientId, setClientId] = useState("");
  const [dayValues, setDayValues] = useState<Record<string, string>>({
    saturday: "",
    sunday: "",
    monday: "",
    tuesday: "",
    wednesday: "",
    thursday: "",
    friday: "",
  });
  const [notes, setNotes] = useState("");

  const { data: clients = [] } = useSWR(open ? "schema/clients" : null, async () => {
    const res = await getClientsForForm();
    return res.data ?? [];
  });

  useEffect(() => {
    if (!open) return;
    if (schema) {
      setClientId(schema.clientId);
      setDayValues({
        saturday: schema.saturday ?? "",
        sunday: schema.sunday ?? "",
        monday: schema.monday ?? "",
        tuesday: schema.tuesday ?? "",
        wednesday: schema.wednesday ?? "",
        thursday: schema.thursday ?? "",
        friday: schema.friday ?? "",
      });
      setNotes(schema.notes ?? "");
    } else {
      setClientId("");
      setDayValues({
        saturday: "",
        sunday: "",
        monday: "",
        tuesday: "",
        wednesday: "",
        thursday: "",
        friday: "",
      });
      setNotes("");
    }
  }, [open, schema]);

  function handleDayChange(key: string, val: string) {
    setDayValues((prev) => ({ ...prev, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      toast.error("Please select a client");
      return;
    }

    startTransition(async () => {
      try {
        const result = await createOrUpdateSchema({
          id: schema?.id,
          clientId,
          saturday: dayValues.saturday,
          sunday: dayValues.sunday,
          monday: dayValues.monday,
          tuesday: dayValues.tuesday,
          wednesday: dayValues.wednesday,
          thursday: dayValues.thursday,
          friday: dayValues.friday,
          notes,
        });

        if (!result.success) {
          throw new Error(result.errors?.message ?? "Failed to save schema");
        }

        toast.success(schema ? "Schema updated" : "Schema created");
        mutate("contracts/schemas");
        onSuccess?.();
        onOpenChange(false);
      } catch (err: any) {
        toast.error(err.message || "Failed to save schema");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-zinc-900">
            <Calendar className="size-5 text-primary" />
            {schema ? "Edit Client Schema" : "Create Client Schema"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            Define weekly content posting & recording schedule for the subscription client.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            {/* Client Select */}
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700">
                Select Client <span className="text-red-500">*</span>
              </label>
              <select
                value={clientId}
                disabled={Boolean(schema)}
                onChange={(e) => setClientId(e.target.value)}
                className={compactSelectClass}
                required
              >
                <option value="">-- Choose Subscription Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.institution} {c.phone ? `(${c.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Weekly Days Grid */}
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-semibold text-zinc-800">
                Weekly Content & Posting Schedule
              </label>
              <div className="grid gap-3 sm:grid-cols-1">
                {DAYS.map((day) => (
                  <div
                    key={day.key}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-zinc-100 p-2.5 bg-zinc-50/50 hover:bg-zinc-50 transition-colors"
                  >
                    <div
                      className={cn(
                        "flex w-36 shrink-0 items-center justify-between rounded-md border px-3 py-1.5 text-xs font-bold shadow-xs",
                        day.color
                      )}
                    >
                      <span>{day.labelEn}</span>
                      <span className="font-arabic">{day.labelAr}</span>
                    </div>
                    <input
                      type="text"
                      placeholder={`e.g. Poster, Video Recording, Video Posting...`}
                      value={dayValues[day.key] ?? ""}
                      onChange={(e) => handleDayChange(day.key, e.target.value)}
                      className={compactInputClass}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="pt-2">
              <label className="mb-1 block text-sm font-semibold text-zinc-700">
                Additional Notes
              </label>
              <textarea
                rows={2}
                placeholder="Optional schedule instructions or details..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-md border border-zinc-200 bg-zinc-50 p-2.5 text-sm text-zinc-800 outline-none focus:border-primary focus:bg-white focus:ring-1 focus:ring-primary/10"
              />
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-zinc-100 bg-zinc-50 px-6 py-3.5">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={() => onOpenChange(false)}
              className={btnFormCancel}
            >
              <X className="size-4 mr-1" />
              Cancel
            </Button>
            <Button type="submit" disabled={pending} className={btnFormSubmit}>
              <Check className="size-4 mr-1" />
              {pending ? "Saving..." : schema ? "Update Schema" : "Create Schema"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
