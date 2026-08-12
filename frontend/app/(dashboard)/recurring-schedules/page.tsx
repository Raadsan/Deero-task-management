"use client";

import TaskFormModal from "@/components/tasks/TaskFormModal";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getClientsForForm, getClientById } from "@/lib/apis/clientApi";
import { getAllUsers } from "@/lib/apis/userApi";
import {
  createRecurringSchedule,
  CreateRecurringScheduleInput,
  deleteRecurringSchedule,
  getAllRecurringSchedules,
  getRecurringOccurrences,
  RecurringScheduleRecord,
  runRecurringDailyGeneration,
  toggleRecurringSchedule,
  updateRecurringSchedule,
} from "@/lib/apis/recurringApi";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnView,
  btnFormCancel,
  btnFormSubmit,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableIdClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { CalendarClock, Download, Edit, Eye, Play, Plus, Power, Printer, Search, Trash2, Users, UserCheck, X } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const fieldInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

const fieldSelectClass =
  "h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const WEEKDAYS_TABLE = [
  { dayNum: 6, labelEn: "Saturday", labelAr: "السبت" },
  { dayNum: 0, labelEn: "Sunday", labelAr: "الأحد" },
  { dayNum: 1, labelEn: "Monday", labelAr: "الإثنين" },
  { dayNum: 2, labelEn: "Tuesday", labelAr: "الثلاثاء" },
  { dayNum: 3, labelEn: "Wednesday", labelAr: "الأربعاء" },
  { dayNum: 4, labelEn: "Thursday", labelAr: "الخميس" },
  { dayNum: 5, labelEn: "Friday", labelAr: "الجمعة" },
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-sm font-medium text-zinc-700">{children}</label>;
}

function weekdayLabel(value?: number | null) {
  if (value == null) return "N/A";
  return WEEKDAY_OPTIONS.find((d) => d.value === value)?.label ?? String(value);
}

function recurrenceLabel(value: string) {
  return RECURRENCE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

// ---------- Schedule Form Modal (Create & Edit) ----------

type StepRow = {
  dayOfWeek: string;
  label: string;
  department: string;
  assigneeId: string;
  startHour: string;
  estimatedHours: string;
};

function ScheduleFormModal({
  open,
  onOpenChange,
  onSaved,
  scheduleToEdit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: (savedId?: string) => void;
  scheduleToEdit?: RecurringScheduleRecord | null;
}) {
  const [pending, startTransition] = useTransition();

  const isEdit = Boolean(scheduleToEdit?.id);

  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("WEEKLY");
  const [contentType, setContentType] = useState("OTHER");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [autoGenerate, setAutoGenerate] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [globalAssigneeId, setGlobalAssigneeId] = useState("");
  const [steps, setSteps] = useState<StepRow[]>([
    { dayOfWeek: "6", label: "", department: "", assigneeId: "", startHour: "09:00", estimatedHours: "2" },
  ]);

  const { data: clients = [] } = useSWR("recurring/clients", async () => {
    const result = await getClientsForForm();
    return result.data ?? [];
  });

  const { data: staffList = [] } = useSWR("recurring/staffs", async () => {
    const result = await getAllUsers();
    return result.data ?? [];
  });

  // Prefill when editing
  useEffect(() => {
    if (scheduleToEdit) {
      setName(scheduleToEdit.name || "");
      setClientId(scheduleToEdit.clientId || "");
      setRecurrenceType(scheduleToEdit.recurrenceType || "WEEKLY");
      setContentType(scheduleToEdit.contentType || "OTHER");
      setStartDate(
        scheduleToEdit.startDate
          ? String(scheduleToEdit.startDate).slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      );
      setEndDate(
        scheduleToEdit.endDate ? String(scheduleToEdit.endDate).slice(0, 10) : "",
      );
      setAutoGenerate(scheduleToEdit.autoGenerateTasks !== false);
      setIsActive(scheduleToEdit.isActive !== false);

      if (scheduleToEdit.steps && scheduleToEdit.steps.length > 0) {
        const firstAssigneeId = scheduleToEdit.steps[0]?.assigneeId
          || (Array.isArray(scheduleToEdit.steps[0]?.assigneeIds) && scheduleToEdit.steps[0]?.assigneeIds?.[0])
          || "";
        setGlobalAssigneeId(String(firstAssigneeId));
        setSteps(
          scheduleToEdit.steps.map((st) => ({
            dayOfWeek: String(st.dayOfWeek ?? 6),
            label: st.label || "",
            department: st.department || "",
            assigneeId: st.assigneeId || (Array.isArray(st.assigneeIds) && st.assigneeIds[0] ? st.assigneeIds[0] : ""),
            startHour: st.startHour || "09:00",
            estimatedHours: String(st.estimatedHours ?? 2),
          })),
        );
      } else {
        setGlobalAssigneeId("");
        setSteps([{ dayOfWeek: "6", label: "", department: "", assigneeId: "", startHour: "09:00", estimatedHours: "2" }]);
      }
    } else {
      resetForm();
    }
  }, [scheduleToEdit, open]);

  // Auto-fill on client change in Create Mode
  useEffect(() => {
    if (isEdit || !clientId) return;
    void (async () => {
      try {
        const res = await getClientById(clientId);
        if (res.success && res.data) {
          const client = res.data as any;
          setName(`${client.institution || "Client"} Schedule`);
          const start = client.contractStartDate
            ? String(client.contractStartDate).slice(0, 10)
            : new Date().toISOString().slice(0, 10);
          setStartDate(start);
          if (client.contractEndDate) {
            setEndDate(String(client.contractEndDate).slice(0, 10));
          } else {
            const d = new Date(start);
            d.setFullYear(d.getFullYear() + 1);
            setEndDate(d.toISOString().slice(0, 10));
          }
          if (client.schedule?.contentType) {
            setContentType(client.schedule.contentType);
          }
          if (client.schedule?.recurrenceType) {
            setRecurrenceType(client.schedule.recurrenceType);
          }
          if (client.schedule?.steps && client.schedule.steps.length > 0) {
            const firstAid = client.schedule.steps[0]?.assigneeId || "";
            setGlobalAssigneeId(String(firstAid));
            setSteps(
              client.schedule.steps.map((st: any) => ({
                dayOfWeek: String(st.dayOfWeek ?? 6),
                label: st.label || "",
                department: st.department || "",
                assigneeId: st.assigneeId || (Array.isArray(st.assigneeIds) && st.assigneeIds[0] ? st.assigneeIds[0] : ""),
                startHour: st.startHour || "09:00",
                estimatedHours: String(st.estimatedHours ?? 2),
              })),
            );
          }
        }
      } catch (err) {
        // ignore auto-fill error
      }
    })();
  }, [clientId, isEdit]);

  function addStep() {
    setSteps((prev) => [...prev, { dayOfWeek: "6", label: "", department: "", assigneeId: "", startHour: "09:00", estimatedHours: "2" }]);
  }

  function removeStep(idx: number) {
    setSteps((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateStep<K extends keyof StepRow>(idx: number, field: K, value: StepRow[K]) {
    setSteps((prev) => prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  }

  function resetForm() {
    setName("");
    setClientId("");
    setRecurrenceType("WEEKLY");
    setContentType("OTHER");
    setStartDate("");
    setEndDate("");
    setAutoGenerate(true);
    setIsActive(true);
    setGlobalAssigneeId("");
    setSteps([{ dayOfWeek: "6", label: "", department: "", assigneeId: "", startHour: "09:00", estimatedHours: "2" }]);
  }

  function handleSubmit() {
    if (!name.trim()) { toast.error("Schedule name is required"); return; }
    if (!clientId) { toast.error("Select a client"); return; }
    if (!startDate) { toast.error("Start date is required"); return; }
    if (steps.some((s) => !s.label.trim())) { toast.error("All steps need a label"); return; }

    startTransition(async () => {
      const payload: CreateRecurringScheduleInput = {
        name: name.trim(),
        clientId,
        recurrenceType: recurrenceType as any,
        contentType,
        startDate,
        endDate: endDate || undefined,
        autoGenerateTasks: autoGenerate,
        isActive,
        steps: steps.map((s, i) => ({
          dayOfWeek: Number(s.dayOfWeek),
          stepOrder: i + 1,
          label: s.label.trim(),
          department: s.department || undefined,
          assigneeId: s.assigneeId || globalAssigneeId || undefined,
          startHour: s.startHour || "09:00",
          estimatedHours: Number(s.estimatedHours) || 2,
        })),
      };

      if (isEdit && scheduleToEdit?.id) {
        const result = await updateRecurringSchedule(scheduleToEdit.id, payload);
        if (!result.success) {
          toast.error(result.errors?.message ?? "Failed to update schedule");
          return;
        }
        toast.success("Schedule updated successfully");
        onOpenChange(false);
        onSaved(scheduleToEdit.id);
      } else {
        const result = await createRecurringSchedule(payload);
        if (!result.success) {
          toast.error(result.errors?.message ?? "Failed to create schedule");
          return;
        }
        toast.success("Schedule created successfully");
        const createdId = result.data?.id;
        resetForm();
        onOpenChange(false);
        onSaved(createdId);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#1e293b]">
            <CalendarClock className="h-5 w-5 text-primary" />
            {isEdit ? "Edit Recurring Schedule" : "New Recurring Schedule"}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-500">
            {isEdit
              ? "Update schedule rules and weekly steps."
              : "Set up an automated recurring task schedule for a client."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel>Schedule name *</FieldLabel>
              <input
                className={fieldInputClass}
                placeholder="e.g. Weekly Content Plan"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Client *</FieldLabel>
              <select
                className={fieldInputClass}
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
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
              <FieldLabel>Recurrence type</FieldLabel>
              <select
                className={fieldInputClass}
                value={recurrenceType}
                onChange={(e) => setRecurrenceType(e.target.value)}
              >
                {RECURRENCE_TYPE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <FieldLabel>Content type</FieldLabel>
              <select
                className={fieldInputClass}
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
              >
                <option value="VIDEO">Video</option>
                <option value="GRAPHIC_DESIGN">Graphic Design</option>
                <option value="PHOTOGRAPHY">Photography</option>
                <option value="SOCIAL_MEDIA_POST">Social Media Post</option>
                <option value="MARKETING_CAMPAIGN">Marketing Campaign</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <FieldLabel>Start date *</FieldLabel>
              <input
                type="date"
                className={fieldInputClass}
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>End date (optional)</FieldLabel>
              <input
                type="date"
                className={fieldInputClass}
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel>Status</FieldLabel>
              <select
                className={fieldInputClass}
                value={isActive ? "active" : "paused"}
                onChange={(e) => setIsActive(e.target.value === "active")}
              >
                <option value="active">Active (Running)</option>
                <option value="paused">Paused (Inactive)</option>
              </select>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-600">
            <input
              type="checkbox"
              checked={autoGenerate}
              onChange={(e) => setAutoGenerate(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 accent-primary"
            />
            Auto-generate tasks on scheduled days
          </label>

          {/* Global Assignee Picker */}
         

          {/* Steps */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Schedule steps</h3>
              <button
                type="button"
                onClick={addStep}
                className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
              >
                <Plus className="h-3.5 w-3.5" />
                Add step
              </button>
            </div>

            <div className="space-y-3">
              {steps.map((step, idx) => (
                <div
                  key={idx}
                  className="space-y-2.5 rounded-lg border border-zinc-200 bg-zinc-50/70 p-3.5 shadow-sm"
                >
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">Day</p>
                      <select
                        className="h-8 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                        value={step.dayOfWeek}
                        onChange={(e) => updateStep(idx, "dayOfWeek", e.target.value)}
                      >
                        {WEEKDAY_OPTIONS.map((w) => (
                          <option key={w.value} value={String(w.value)}>
                            {w.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">Step label *</p>
                      <input
                        className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                        placeholder="e.g. Shoot videos"
                        value={step.label}
                        onChange={(e) => updateStep(idx, "label", e.target.value)}
                      />
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">Department</p>
                      <input
                        className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                        placeholder="Optional"
                        value={step.department}
                        onChange={(e) => updateStep(idx, "department", e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Assignee, Start Time & Duration row */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">Assigned Staff (for this day)</p>
                      <select
                        className="h-8 w-full cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                        value={step.assigneeId || ""}
                        onChange={(e) => updateStep(idx, "assigneeId", e.target.value)}
                      >
                        <option value="">Default (Global Staff)</option>
                        {staffList.map((s: any) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-medium text-zinc-500">Start Time (Hour)</p>
                      <input
                        type="time"
                        className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                        value={step.startHour || "09:00"}
                        onChange={(e) => updateStep(idx, "startHour", e.target.value)}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <p className="mb-1 text-xs font-medium text-zinc-500">Duration (Hours)</p>
                        <input
                          type="number"
                          min="0.5"
                          step="0.5"
                          className="h-8 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs text-zinc-700 outline-none focus:border-primary"
                          placeholder="2"
                          value={step.estimatedHours || "2"}
                          onChange={(e) => updateStep(idx, "estimatedHours", e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={steps.length === 1}
                        onClick={() => removeStep(idx)}
                        className="mb-0.5 rounded p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30"
                        title="Remove step"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className={btnFormCancel}
            onClick={() => { resetForm(); onOpenChange(false); }}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={btnFormSubmit}
            onClick={handleSubmit}
            disabled={pending}
          >
            {pending ? "Saving…" : isEdit ? "Update Schedule" : "Create Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Main Page ----------

export default function RecurringSchedulesPage() {
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<RecurringScheduleRecord | null>(null);
  const [deletingSchedule, setDeletingSchedule] = useState<RecurringScheduleRecord | null>(null);
  const [togglingSchedule, setTogglingSchedule] = useState<RecurringScheduleRecord | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskModalInitialData, setTaskModalInitialData] = useState<any>(null);

  function handleOpenGenerateTaskModal(schedule: RecurringScheduleRecord) {
    const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const todayDateStr = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const clientName = schedule.client?.institution ?? "Client";
    const generatedDescription = `Scheduled task execution for ${clientName} (${schedule.name}) — ${todayName}, ${todayDateStr}.\n\nTasks:\n- Perform today's scheduled services and deliverables for ${clientName}\n- Verify service quality and update task progress upon completion.`;

    setTaskModalInitialData({
      clientInstitutionId: schedule.clientId,
      serviceInformation: schedule.name,
      taskKind: "client",
      department: "General",
      description: generatedDescription,
      portfolioId: (schedule as any).portfolioId ?? schedule.portfolio?.id,
    });
    setTaskModalOpen(true);
  }

  const { data: schedules = [], isLoading } = useSWR(
    SWR_CACH_KEYS.recurringSchedules.key,
    async () => {
      const result = await getAllRecurringSchedules();
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load schedules");
      return result.data ?? [];
    },
    { refreshInterval: 4000, revalidateOnFocus: true }
  );

  const { data: occurrences = [], isLoading: historyLoading } = useSWR(
    viewId ? `recurring/occurrences/${viewId}` : null,
    async () => {
      const result = await getRecurringOccurrences(viewId!);
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load occurrences");
      return result.data ?? [];
    },
    { refreshInterval: 4000, revalidateOnFocus: true }
  );

  const viewed = schedules.find((s) => s.id === viewId);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return schedules.filter((row) => {
      if (activeFilter === "active" && !row.isActive) return false;
      if (activeFilter === "inactive" && row.isActive) return false;
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.client?.institution?.toLowerCase().includes(query) ||
        String(row.id).toLowerCase().includes(query)
      );
    });
  }, [schedules, search, activeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, pageSize]);

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleRecurringSchedule(id);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to update schedule");
        return;
      }
      toast.success(result.data?.isActive ? "Schedule activated" : "Schedule paused");
      mutate(SWR_CACH_KEYS.recurringSchedules.key);
    });
  }

  function handleRunDaily(id: string) {
    startTransition(async () => {
      const result = await runRecurringDailyGeneration(id);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Generation failed");
        return;
      }
      toast.success(
        `Created ${result.data?.created ?? 0} task(s), skipped ${result.data?.skipped ?? 0}`,
      );
      if (viewId === id) mutate(`recurring/occurrences/${id}`);
    });
  }

  function handleConfirmDelete() {
    if (!deletingSchedule) return;
    startTransition(async () => {
      const result = await deleteRecurringSchedule(deletingSchedule.id);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to delete schedule");
        return;
      }
      toast.success("Schedule deleted");
      setDeletingSchedule(null);
      mutate(SWR_CACH_KEYS.recurringSchedules.key);
    });
  }

  function handlePrintSchedule() {
    if (!viewed) return;
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const getStepsForDay = (dayNum: number) => {
      const matches = (viewed.steps ?? []).filter((s) => s.dayOfWeek === dayNum);
      if (matches.length === 0) return "N/A";
      return matches.map((s) => s.label).join("<br/>");
    };

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${viewed.client?.institution || viewed.name} - Weekly Content Schedule</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 20px; color: #111; }
            h2 { text-align: center; margin-bottom: 5px; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; color: #1e293b; }
            p.sub { text-align: center; margin-top: 0; font-size: 13px; color: #666; margin-bottom: 25px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th, td { border: 1px solid #e2e8f0; padding: 12px; text-align: center; font-size: 13px; }
            th { background-color: #f8fafc; color: #334155; font-weight: 600; }
            td { color: #374151; }
            .day-ar { font-size: 11px; display: block; opacity: 0.7; }
            @media print {
              body { margin: 0; }
              @page { size: landscape; margin: 15mm; }
            }
          </style>
        </head>
        <body>
          <h2>${viewed.client?.institution || viewed.name}</h2>
          <p class="sub">Official Content Schedule & Posting Calendar</p>
          <table>
            <thead>
              <tr>
                ${WEEKDAYS_TABLE.map(
                  (day) =>
                    `<th><div>${day.labelEn}</div><div class="day-ar">${day.labelAr}</div></th>`
                ).join("")}
              </tr>
            </thead>
            <tbody>
              <tr>
                ${WEEKDAYS_TABLE.map((day) => `<td>${getStepsForDay(day.dayNum)}</td>`).join("")}
              </tr>
            </tbody>
          </table>
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
    <ManagementPageShell title="Recurring schedules">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-6 py-3">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("w-16", compactSelectClass)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className={cn("min-w-[130px]", compactSelectClass)}
          >
            <option value="all">All schedules</option>
            <option value="active">Active only</option>
            <option value="inactive">Paused only</option>
          </select>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search schedules..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {/* ADD SCHEDULE BUTTON */}
          <Button
            type="button"
            onClick={() => {
              setEditingSchedule(null);
              setFormOpen(true);
            }}
            className={cn(btnFormSubmit, "flex items-center gap-2")}
          >
            <Plus className="h-4 w-4" />
            Add Schedule
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>ID</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Schedule</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Client</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Recurrence</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Steps</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Period</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No recurring schedules yet.{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline-offset-2 hover:underline"
                        onClick={() => {
                          setEditingSchedule(null);
                          setFormOpen(true);
                        }}
                      >
                        Create one now
                      </button>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>
                          {String(row.id).slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextPrimary}>{row.name}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {row.client?.institution ?? "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {recurrenceLabel(row.recurrenceType)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {row.steps?.length ?? 0}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {new Date(row.startDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
                          {row.endDate
                            ? ` – ${new Date(row.endDate).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`
                            : " – ongoing"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <button
                          type="button"
                          title={row.isActive ? "Click to pause" : "Click to activate"}
                          onClick={() => setTogglingSchedule(row)}
                          className={cn(
                            dashboardStatusBadgeClass,
                            "cursor-pointer transition-opacity hover:opacity-80",
                            row.isActive
                              ? getTaskStatusBadgeClass("completed")
                              : getTaskStatusBadgeClass("pending"),
                          )}
                        >
                          {row.isActive ? "Active" : "Paused"}
                        </button>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex justify-end gap-1">
                          {/* VIEW BUTTON */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="View schedule & history"
                            className={actionBtnView}
                            onClick={() => {
                              setViewId(row.id);
                              setViewOpen(true);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>

                          {/* EDIT BUTTON */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Edit schedule"
                            className={actionBtnView}
                            onClick={() => {
                              setEditingSchedule(row);
                              setFormOpen(true);
                            }}
                          >
                            <Edit className="size-4" />
                          </Button>

                          {/* DELETE BUTTON */}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Delete schedule"
                            className="h-8 w-8 p-0 text-zinc-500 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeletingSchedule(row)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      {/* View / Table / History Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-5xl">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#1e293b]">
              <CalendarClock className="h-5 w-5 text-primary" />
              {viewed?.name ?? "Schedule"}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              {viewed?.client?.institution} · {viewed ? recurrenceLabel(viewed.recurrenceType) : ""}
            </DialogDescription>
          </DialogHeader>

          {viewed && (
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 pb-3">
                <div className="flex gap-2">
                  {/* PAUSE / ACTIVATE SCHEDULE (INSIDE VIEW MODAL) */}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pending}
                    onClick={() => setTogglingSchedule(viewed)}
                  >
                    <Power className="mr-1.5 h-4 w-4" />
                    {viewed.isActive ? "Pause schedule" : "Activate schedule"}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handlePrintSchedule}
                    className="border-zinc-300 text-zinc-700"
                  >
                    <Printer className="mr-1.5 h-4 w-4 text-zinc-600" />
                    Print Schedule
                  </Button>
                  <Button
                    size="sm"
                    onClick={handlePrintSchedule}
                    className="bg-primary text-white hover:bg-primary/90"
                  >
                    <Download className="mr-1.5 h-4 w-4" />
                    Export PDF
                  </Button>
                </div>
              </div>

              {/* Saturday to Friday Weekly Table Layout */}
              <div>
                <h3 className="mb-2 text-sm font-bold text-zinc-800">Weekly Schedule Grid</h3>
                <div className="overflow-x-auto rounded-lg border border-zinc-200 shadow-xs">
                  <table className="w-full border-collapse text-center text-sm">
                    <thead className={dashboardTableHeaderClass}>
                      <tr className={dashboardTableHeadRowClass}>
                        {WEEKDAYS_TABLE.map((day) => (
                          <th
                            key={day.dayNum}
                            className={cn(dashboardTableHeadClass, "border-r border-rose-900/20 text-center last:border-r-0")}
                          >
                            <div className="text-xs font-extrabold uppercase tracking-wider text-white">
                              {day.labelEn}
                            </div>
                            <div className="text-[11px] font-medium text-white/80">
                              {day.labelAr}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="bg-white">
                        {WEEKDAYS_TABLE.map((day) => {
                          const matchingSteps = (viewed.steps ?? []).filter(
                            (s) => s.dayOfWeek === day.dayNum,
                          );
                          return (
                            <td
                              key={day.dayNum}
                              className="border-r border-zinc-200 p-3 align-top text-zinc-700 last:border-r-0"
                            >
                              {matchingSteps.length > 0 ? (
                                <div className="space-y-1.5">
                                  {matchingSteps.map((st) => (
                                    <span
                                      key={st.id}
                                      className="inline-block text-xs font-medium text-zinc-700"
                                    >
                                      {st.label}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs font-semibold text-zinc-400">N/A</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-800">Auto-generated history</h3>
                {historyLoading ? (
                  <p className="text-sm text-zinc-500">Loading history...</p>
                ) : occurrences.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No tasks generated yet. They appear automatically on scheduled days.
                  </p>
                ) : (
                  <div className={dashboardTableWrapClass}>
                    <Table>
                      <TableHeader className={dashboardTableHeaderClass}>
                        <TableRow className={dashboardTableHeadRowClass}>
                          <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Date</TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Step</TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task</TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Assignee</TableHead>
                          <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {occurrences.map((row) => (
                          <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                            <TableCell className={dashboardTableCellClass}>{formatDate(String(row.scheduledDate))}</TableCell>
                            <TableCell className={dashboardTableCellClass}>{row.scheduleStep?.label ?? "N/A"}</TableCell>
                            <TableCell className={dashboardTableCellClass}>{row.task?.description ?? "N/A"}</TableCell>
                            <TableCell className={dashboardTableCellClass}>{row.task?.user?.name ?? "N/A"}</TableCell>
                            <TableCell className={dashboardTableCellClass}>
                              <span
                                className={cn(
                                  dashboardStatusBadgeClass,
                                  getTaskStatusBadgeClass(row.task?.status ?? "pending"),
                                )}
                              >
                                {row.task?.status ?? "N/A"}
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create / Edit Schedule Modal */}
      <ScheduleFormModal
        open={formOpen}
        onOpenChange={(v) => {
          setFormOpen(v);
          if (!v) setEditingSchedule(null);
        }}
        scheduleToEdit={editingSchedule}
        onSaved={(savedId) => {
          mutate(SWR_CACH_KEYS.recurringSchedules.key);
          if (savedId) {
            setViewId(savedId);
            setViewOpen(true);
          }
        }}
      />

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        open={Boolean(deletingSchedule)}
        onOpenChange={(v) => {
          if (!v) setDeletingSchedule(null);
        }}
        title="Delete Schedule"
        description={`Are you sure you want to delete "${deletingSchedule?.name}"? This action cannot be undone.`}
        onConfirm={handleConfirmDelete}
        confirmLabel={pending ? "Deleting..." : "Delete Schedule"}
        destructive
      />

      {/* Confirm Toggle Status Dialog */}
      <ConfirmDialog
        open={Boolean(togglingSchedule)}
        onOpenChange={(v) => {
          if (!v) setTogglingSchedule(null);
        }}
        title={togglingSchedule?.isActive ? "Pause Schedule" : "Activate Schedule"}
        description={
          togglingSchedule?.isActive
            ? `Are you sure you want to pause the schedule "${togglingSchedule?.name}"?`
            : `Are you sure you want to activate the schedule "${togglingSchedule?.name}"?`
        }
        onConfirm={() => {
          if (togglingSchedule) {
            handleToggle(togglingSchedule.id);
            setTogglingSchedule(null);
          }
        }}
        confirmLabel={pending ? "Updating..." : togglingSchedule?.isActive ? "Pause schedule" : "Activate schedule"}
        destructive={togglingSchedule?.isActive}
      />

      {/* Create Task Modal */}
      <TaskFormModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        mode="create"
        initialData={taskModalInitialData}
      />
    </ManagementPageShell>
  );
}
