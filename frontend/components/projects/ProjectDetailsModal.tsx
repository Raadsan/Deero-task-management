"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  createProjectExtra,
  decideProjectExtra,
  getProjectById,
  ProjectRecord,
  reassignProjectTask,
  startProjectCycle,
} from "@/lib/apis/projectApi";
import { editTask } from "@/lib/apis/taskApi";
import { authClient } from "@/lib/auth-client";
import { getAllUsersClient } from "@/lib/apis/readApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { currentProjectCycleId, currentProjectTaskStatus, summarizeProjectTasks, tasksForProjectCycle } from "@/lib/project-schedule";
import { useNow } from "@/lib/use-now";
import { cn, formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cycleOptionLabel(cycle: { label: string; startDate?: string | null; endDate?: string | null }) {
  const format = (value?: string | null) => {
    const iso = String(value || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return `${cycle.label}: ${format(cycle.startDate)} – ${format(cycle.endDate)}`;
}

function cyclesCoverContract(project: ProjectRecord) {
  if (project.primaryContract?.duration === "ENDLESS") return false;
  const contractEnd = String(project.primaryContract?.endDate || project.dueDate || "").slice(0, 10);
  const lastEnd = String(project.cycles?.[project.cycles.length - 1]?.endDate || "").slice(0, 10);
  return Boolean(contractEnd && lastEnd && lastEnd >= contractEnd);
}

const REASONS = [
  "Employee Absent",
  "Workload Redistribution",
  "Employee Unavailable",
  "Skill Requirement",
  "Other",
];

export default function ProjectDetailsModal({
  open,
  projectId,
  onOpenChange,
}: {
  open: boolean;
  projectId?: string;
  onOpenChange: (open: boolean) => void;
}) {
  const { mutate } = useSWRConfig();
  const { data, mutate: reload } = useSWR(
    open && projectId ? ["project-detail", projectId] : null,
    () => getProjectById(projectId!),
    { refreshInterval: 15000 },
  );
  const { data: staffRes } = useSWR(open ? "project-staff" : null, getAllUsersClient);
  const project = data?.data as ProjectRecord | undefined;
  const staff = (staffRes?.data ?? []) as Array<{ id: string; name: string }>;
  const [taskId, setTaskId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState("");
  const [section, setSection] = useState("overview");
  const [cycleId, setCycleId] = useState("");
  const [extraDraft, setExtraDraft] = useState<{ subId: string; serviceName: string; subName: string; quantity: string; reason: string } | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionSlot, setDecisionSlot] = useState({ assigneeId: "", scheduledDate: "", startTime: "", endTime: "" });
  const [scheduleTaskId, setScheduleTaskId] = useState<string | null>(null);
  const [slot, setSlot] = useState({ assigneeId: "", scheduledDate: "", startTime: "", endTime: "" });
  const [savingExtra, setSavingExtra] = useState(false);
  const requesterName = authClient.useSession().data?.user?.name || "Signed-in manager";
  const now = useNow();
  useEffect(() => setCycleId(""), [projectId]);

  const tasks = project?.tasks ?? [];
  const openCycleId = currentProjectCycleId(project?.cycles, now);
  const selectedCycleId = project?.billingMode === "MONTHLY" ? (cycleId || openCycleId) : "";
  const overviewTasks = selectedCycleId
    ? tasksForProjectCycle(tasks, selectedCycleId, selectedCycleId === openCycleId)
    : tasks;
  const progress = summarizeProjectTasks(overviewTasks, now);
  const selected = tasks.find((task) => task.id === taskId);

  async function reassign() {
    if (!project || !selected || !assigneeId) return;
    const result = await reassignProjectTask(project.id, selected.id, { assigneeId, reason, note });
    if (!result.success) {
      toast.error(result.errors?.message || "Could not reassign task");
      return;
    }
    toast.success("Task reassigned");
    setTaskId(null);
    await reload();
    await mutate(SWR_CACH_KEYS.projects.key);
  }

  async function submitExtra() {
    if (!project || !extraDraft) return;
    const quantity = Number(extraDraft.quantity);
    if (!Number.isInteger(quantity) || quantity < 1) {
      toast.error("Enter an extra quantity of at least 1");
      return;
    }
    if (!extraDraft.reason.trim()) {
      toast.error("A request reason is required");
      return;
    }
    setSavingExtra(true);
    const result = await createProjectExtra(project.id, {
      subServiceId: extraDraft.subId,
      quantity,
      reason: extraDraft.reason.trim(),
    });
    setSavingExtra(false);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not create the extra work request");
      return;
    }
    toast.success("Extra work request submitted for approval");
    setExtraDraft(null);
    await reload();
  }

  async function decideExtra(requestId: string, decision: "APPROVED" | "REJECTED") {
    if (!project) return;
    setSavingExtra(true);
    const result = await decideProjectExtra(project.id, requestId, decision === "APPROVED" ? {
      decision,
      assigneeId: decisionSlot.assigneeId || undefined,
      scheduledDate: decisionSlot.scheduledDate || undefined,
      startTime: decisionSlot.startTime || undefined,
      endTime: decisionSlot.endTime || undefined,
    } : { decision });
    setSavingExtra(false);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not update the extra work request");
      return;
    }
    toast.success(decision === "APPROVED" ? "Extra tasks created. Original tasks were left unchanged." : "Extra work request rejected");
    setDecidingId(null);
    await reload();
    await mutate(SWR_CACH_KEYS.projects.key);
    await mutate(SWR_CACH_KEYS.tasks.key);
  }

  async function saveExtraSchedule(task: NonNullable<ProjectRecord["tasks"]>[number]) {
    const result = await editTask({
      taskId: task.id,
      assgineeId: slot.assigneeId || task.assgineeId,
      features: {
        ...(task.features ?? {}),
        scheduledDate: slot.scheduledDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
      },
    });
    if (!result.success) {
      toast.error(result.errors?.message || "Could not schedule the extra task");
      return;
    }
    toast.success("Extra task schedule saved");
    setScheduleTaskId(null);
    await reload();
    await mutate(SWR_CACH_KEYS.tasks.key);
  }

  async function nextCycle() {
    if (!project) return;
    const result = await startProjectCycle(project.id);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not start the next cycle");
      return;
    }
    const created = result.data && typeof result.data === "object" && "created" in result.data ? result.data.created : true;
    toast.success(created === false ? "Tasks added to the next monthly cycle" : "New monthly cycle created");
    await reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[75vh] flex-col gap-3 overflow-hidden sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{project?.name || "Project"}</DialogTitle>
        </DialogHeader>
        <div className="flex shrink-0 gap-2 text-sm">
          {["overview", "tasks", "services", "cycles", "history"].map((item) => (
            <button key={item} type="button" className={section === item ? "font-semibold text-primary" : "text-zinc-500"} onClick={() => setSection(item)}>
              {item}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto text-sm">
          {project?.billingMode === "MONTHLY" && (project.cycles?.length ?? 0) > 0 ? (
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              Monthly cycle
              <select
                className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-700"
                value={selectedCycleId}
                onChange={(event) => setCycleId(event.target.value)}
              >
                {project.cycles?.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>{cycleOptionLabel(cycle)}</option>
                ))}
              </select>
            </label>
          ) : null}
          {section === "overview" && project && (
            <ProjectOverview
              project={project}
              tasks={overviewTasks}
              progress={progress}
            />
          )}
          {section === "services" && project && (
            <div className="space-y-3">
              {project.serviceLinks?.map((link) => (
                <div key={link.id} className="rounded-md border p-3">
                  <p className="font-medium">{link.service?.serviceName}</p>
                  {link.subServices?.map((sub) => (
                    <div key={sub.id} className="mt-2 flex items-center justify-between gap-2">
                      <span>{sub.name} · {sub.quantity} {sub.unit} · {sub.assignee?.name || "Unassigned"}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setExtraDraft({
                          subId: sub.id,
                          serviceName: link.service?.serviceName || "Service",
                          subName: sub.name,
                          quantity: "1",
                          reason: "",
                        })}
                      >
                        Request extra work
                      </Button>
                    </div>
                  ))}
                </div>
              ))}
              {extraDraft ? (
                <form className="space-y-2 rounded-md border p-3" onSubmit={(event) => { event.preventDefault(); void submitExtra(); }}>
                  <p className="font-medium">Extra work request</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Field label="Project" value={project.name} />
                    <Field label="Main service" value={extraDraft.serviceName} />
                    <Field label="Sub service" value={extraDraft.subName} />
                    <Field label="Requested by" value={requesterName} />
                    <Field label="Request date" value={formatDate(new Date().toISOString())} />
                    <Field label="Approval status" value="Pending" />
                  </div>
                  <label className="block text-xs text-zinc-500">Extra quantity
                    <input className="mt-1 h-10 w-full rounded-md border px-3 text-sm" type="number" min={1} max={50} value={extraDraft.quantity} onChange={(event) => setExtraDraft({ ...extraDraft, quantity: event.target.value })} />
                  </label>
                  <label className="block text-xs text-zinc-500">Request reason
                    <textarea className="mt-1 w-full rounded-md border px-3 py-2 text-sm" value={extraDraft.reason} onChange={(event) => setExtraDraft({ ...extraDraft, reason: event.target.value })} />
                  </label>
                  <div className="flex gap-2">
                    <Button type="submit" size="sm" disabled={savingExtra}>{savingExtra ? "Submitting…" : "Submit request"}</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setExtraDraft(null)}>Cancel</Button>
                  </div>
                </form>
              ) : null}
              <ExtraRequestList
                project={project}
                tasks={tasks}
                staff={staff}
                decidingId={decidingId}
                decisionSlot={decisionSlot}
                saving={savingExtra}
                onDecide={decideExtra}
                onStart={(requestId, assigneeId) => {
                  setDecidingId(requestId);
                  setDecisionSlot({ assigneeId, scheduledDate: "", startTime: "", endTime: "" });
                }}
                onSlotChange={setDecisionSlot}
              />
            </div>
          )}
          {section === "tasks" && overviewTasks.map((task) => (
            <div key={task.id} className="rounded-md border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p>{task.description}</p>
                  <p className="text-xs text-zinc-500">{task.user?.name || "Unassigned"} · {currentProjectTaskStatus(task, now).replaceAll("_", " ")} · {Number(task.progress ?? 0)}% {task.features?.isExtra ? "· Extra work" : "· Original"}</p>
                </div>
                <div className="flex gap-1">
                  {task.features?.isExtra ? (
                    <Button type="button" size="sm" variant="outline" onClick={() => {
                      setScheduleTaskId(task.id);
                      setSlot({
                        assigneeId: task.assgineeId || "",
                        scheduledDate: String(task.features?.scheduledDate || ""),
                        startTime: String(task.features?.startTime || ""),
                        endTime: String(task.features?.endTime || ""),
                      });
                    }}>Schedule</Button>
                  ) : null}
                  <Button type="button" size="sm" variant="outline" onClick={() => { setTaskId(task.id); setAssigneeId(""); }}>Reassign</Button>
                </div>
              </div>
              {scheduleTaskId === task.id ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-4">
                  <input className="h-10 rounded-md border px-3" type="date" value={slot.scheduledDate} onChange={(event) => setSlot({ ...slot, scheduledDate: event.target.value })} />
                  <input className="h-10 rounded-md border px-3" type="time" value={slot.startTime} onChange={(event) => setSlot({ ...slot, startTime: event.target.value })} />
                  <input className="h-10 rounded-md border px-3" type="time" value={slot.endTime} onChange={(event) => setSlot({ ...slot, endTime: event.target.value })} />
                  <select className="h-10 rounded-md border px-3" value={slot.assigneeId} onChange={(event) => setSlot({ ...slot, assigneeId: event.target.value })}>
                    <option value="">Employee</option>
                    {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                  </select>
                  <div className="flex gap-2 sm:col-span-4">
                    <Button type="button" size="sm" onClick={() => saveExtraSchedule(task)}>Save schedule</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setScheduleTaskId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
          {section === "cycles" && (
            <div className="space-y-2">
              {project?.billingMode === "MONTHLY" ? (
                cyclesCoverContract(project) ? (
                  <p className="text-zinc-500">All monthly cycles for this contract are already created.</p>
                ) : (
                  <Button type="button" size="sm" onClick={nextCycle}>Start next monthly cycle</Button>
                )
              ) : (
                <p className="text-zinc-500">Monthly cycles apply to monthly projects.</p>
              )}
              {project?.cycles?.map((cycle) => (
                <p key={cycle.id}>{cycleOptionLabel(cycle)}</p>
              ))}
            </div>
          )}
          {section === "history" && (
            <div className="space-y-3">
              <ExtraRequestList project={project} tasks={overviewTasks} staff={staff} readOnly />
              {tasks.flatMap((task) => task.transferHistory ?? []).map((entry) => (
                <p key={entry.id}>
                  {entry.fromAssignee?.name} → {entry.toAssignee?.name} · {entry.reason || "Reassigned"} · {entry.createdAt?.slice(0, 16)}
                </p>
              ))}
            </div>
          )}
        </div>
        {selected ? (
          <div className="space-y-2 border-t pt-3">
            <p className="text-sm font-medium">Reassign {selected.description}</p>
            <p className="text-xs text-zinc-500">Current: {selected.user?.name}</p>
            <select className="h-10 w-full rounded-md border px-3" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
              <option value="">New employee</option>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
            <select className="h-10 w-full rounded-md border px-3" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
            <textarea className="w-full rounded-md border px-3 py-2" placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
            <Button type="button" onClick={reassign}>Confirm reassignment</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function ProjectOverview({
  project,
  tasks,
  progress,
}: {
  project: ProjectRecord;
  tasks: NonNullable<ProjectRecord["tasks"]>;
  progress: { percent: number; total: number; pending: number; inProgress: number; completed: number; overdue: number };
}) {
  const schedule = (project.scheduleConfig ?? {}) as {
    workingDays?: number[];
    hours?: string;
    notes?: string;
  };
  const workingDays = (schedule.workingDays ?? []).map((day) => DAYS[day]).filter(Boolean);
  const services = project.serviceLinks ?? [];
  const claimedTaskIds = new Set<string>();
  const employees = Array.from(
    new Set(
      tasks.map((task) => task.user?.name).filter((name): name is string => Boolean(name)),
    ),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">{project.projectCode || "No code"}</span>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700">{project.billingMode === "MONTHLY" ? "Monthly" : "One-Time"}</span>
        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{project.lifecycleStatus || project.status}</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Progress" value={`${progress.percent}%`} />
        <Stat label="Total Tasks" value={String(progress.total)} />
        <Stat label="Pending" value={String(progress.pending)} />
        <Stat label="In Progress" value={String(progress.inProgress)} />
        <Stat label="Completed" value={String(progress.completed)} />
        <Stat label="Overdue" value={String(progress.overdue)} />
      </div>

      <section className="rounded-lg border border-zinc-100 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-800">Project information</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Project name" value={project.name} />
          <Field label="Client" value={project.client?.institution} />
          <Field label="Contract" value={project.primaryContract ? `${project.primaryContract.contractNumber}${project.primaryContract.title ? ` · ${project.primaryContract.title}` : ""}` : "No contract"} />
          <Field label="Contract duration" value={project.primaryContract?.duration} />
          <Field label="Start date" value={project.startDate ? formatDate(project.startDate) : "—"} />
          <Field label="End date" value={project.dueDate ? formatDate(project.dueDate) : "—"} />
          <Field label="Description" value={project.description || "—"} className="sm:col-span-2" />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-100 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-800">Services</h3>
        {services.length === 0 ? <p className="text-zinc-500">No services configured.</p> : null}
        <div className="space-y-3">
          {services.map((link) => (
            <div key={link.id}>
              <p className="font-medium text-zinc-800">{link.service?.serviceName}</p>
              <div className="mt-1 space-y-1">
                {(link.subServices ?? []).length === 0 ? <p className="text-zinc-500">No sub services.</p> : null}
                {(link.subServices ?? []).map((sub) => {
                  const planned = Math.max(0, Number(sub.quantity) || 0);
                  const original = subServiceWork(sub, tasks, claimedTaskIds, false);
                  const extra = subServiceWork(sub, tasks, claimedTaskIds, true);
                  const originalPercent = planned > 0 ? Math.min(100, Math.round((original.completed / planned) * 100)) : 0;
                  const extraPercent = extra.total > 0 ? Math.min(100, Math.round((extra.completed / extra.total) * 100)) : 0;
                  return (
                    <div key={sub.id} className="space-y-1.5 text-zinc-600">
                      <QuantityLine label={`Original ${sub.name}`} completed={original.completed} planned={planned} percent={originalPercent} detail={`${sub.unit} · ${sub.assignee?.name || "Unassigned"}`} />
                      {extra.total > 0 ? <QuantityLine label={`Extra ${sub.name}`} completed={extra.completed} planned={extra.total} percent={extraPercent} /> : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-zinc-100 p-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-800">Schedule</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Working days" value={workingDays.length ? workingDays.join(", ") : "—"} />
          <Field label="Working hours" value={schedule.hours || "—"} />
          <Field label="Notes" value={schedule.notes || "—"} className="sm:col-span-2" />
          <Field label="Employees" value={employees.length ? employees.join(", ") : "—"} className="sm:col-span-2" />
        </div>
      </section>
    </div>
  );
}

function subServiceWork(
  sub: { id: string; name: string },
  tasks: NonNullable<ProjectRecord["tasks"]>,
  claimedTaskIds: Set<string>,
  extra: boolean,
) {
  let total = 0;
  let completed = 0;
  const name = sub.name.trim().toLowerCase();
  for (const task of tasks) {
    if (claimedTaskIds.has(task.id)) continue;
    if (Boolean(task.features?.isExtra) !== extra) continue;
    const featureId = String(task.features?.subServiceId || "");
    const featureName = String(task.features?.subServiceName || "").trim().toLowerCase();
    const matches = featureId ? featureId === sub.id : featureName === name && name.length > 0;
    if (!matches) continue;
    claimedTaskIds.add(task.id);
    total += 1;
    const progress = Number(task.progress ?? 0);
    if (progress >= 100 && currentProjectTaskStatus(task) === "COMPLETED") completed += 1;
  }
  return { total, completed };
}

function QuantityLine({ label, completed, planned, percent, detail }: { label: string; completed: number; planned: number; percent: number; detail?: string }) {
  return (
    <div className="flex items-center gap-3">
      <p className="min-w-0 flex-1">
        {label}: <span className="font-semibold text-zinc-900">{completed}/{planned}</span>
        {detail ? <span className="text-zinc-400"> · {detail}</span> : null}
      </p>
      <div className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-zinc-100" aria-hidden>
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-9 shrink-0 text-right text-xs font-medium text-zinc-700">{percent}%</span>
    </div>
  );
}

const EXTRA_DECISION_MARK = "\n---extra-decision---\n";

function extraRequestDetails(description?: string | null) {
  const [reason, raw] = String(description || "").split(EXTRA_DECISION_MARK);
  let decision: { decision?: string; decidedByName?: string; decidedAt?: string; taskIds?: string[] } | null = null;
  if (raw) {
    try { decision = JSON.parse(raw); } catch { decision = null; }
  }
  return { reason: reason.trim(), decision };
}

function ExtraRequestList({
  project,
  tasks,
  staff,
  decidingId,
  decisionSlot,
  saving,
  readOnly = false,
  onDecide,
  onStart,
  onSlotChange,
}: {
  project?: ProjectRecord;
  tasks: NonNullable<ProjectRecord["tasks"]>;
  staff: Array<{ id: string; name: string }>;
  decidingId?: string | null;
  decisionSlot?: { assigneeId: string; scheduledDate: string; startTime: string; endTime: string };
  saving?: boolean;
  readOnly?: boolean;
  onDecide?: (requestId: string, decision: "APPROVED" | "REJECTED") => void;
  onStart?: (requestId: string, assigneeId: string) => void;
  onSlotChange?: (slot: { assigneeId: string; scheduledDate: string; startTime: string; endTime: string }) => void;
}) {
  const requests = project?.extraRequests ?? [];
  if (requests.length === 0) return <p className="text-zinc-500">No extra work requests.</p>;
  return (
    <div className="space-y-2">
      <p className="font-medium text-zinc-800">Extra work history</p>
      {requests.map((request) => {
        const details = extraRequestDetails(request.description);
        const related = tasks.filter((task) => String(task.features?.extraRequestId || "") === request.id);
        const open = decidingId === request.id;
        return (
          <div key={request.id} className="rounded-md border p-3">
            <p className="font-medium">{request.subService?.link?.service?.serviceName || "Service"} · {request.subService?.name}</p>
            <p className="text-zinc-600">Quantity {request.quantity} · {request.status} · {request.requestedBy?.name || "Unknown"} · {request.createdAt ? formatDate(request.createdAt) : "—"}</p>
            <p className="text-zinc-600">Reason: {details.reason || "—"}</p>
            {details.decision ? (
              <p className="text-zinc-500">{details.decision.decision} by {details.decision.decidedByName || "a manager"}{details.decision.decidedAt ? ` · ${formatDate(details.decision.decidedAt)}` : ""}</p>
            ) : null}
            {related.map((task) => (
              <p key={task.id} className="text-xs text-zinc-500">{task.description} · {task.id} · {task.user?.name || "Unassigned"} · {currentProjectTaskStatus(task).replaceAll("_", " ")} · {Number(task.progress ?? 0)}%</p>
            ))}
            {!readOnly && request.status === "PENDING" && onDecide && onStart && decisionSlot && onSlotChange ? (
              <div className="mt-2 space-y-2">
                {open ? (
                  <>
                    <div className="grid gap-2 sm:grid-cols-4">
                      <select className="h-10 rounded-md border px-3" value={decisionSlot.assigneeId} onChange={(event) => onSlotChange({ ...decisionSlot, assigneeId: event.target.value })}>
                        <option value="">Default employee</option>
                        {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                      <input className="h-10 rounded-md border px-3" type="date" value={decisionSlot.scheduledDate} onChange={(event) => onSlotChange({ ...decisionSlot, scheduledDate: event.target.value })} />
                      <input className="h-10 rounded-md border px-3" type="time" value={decisionSlot.startTime} onChange={(event) => onSlotChange({ ...decisionSlot, startTime: event.target.value })} />
                      <input className="h-10 rounded-md border px-3" type="time" value={decisionSlot.endTime} onChange={(event) => onSlotChange({ ...decisionSlot, endTime: event.target.value })} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" size="sm" disabled={saving} onClick={() => onDecide(request.id, "APPROVED")}>Approve and create tasks</Button>
                      <Button type="button" size="sm" variant="outline" disabled={saving} onClick={() => onDecide(request.id, "REJECTED")}>Reject</Button>
                    </div>
                  </>
                ) : (
                  <Button type="button" size="sm" variant="outline" onClick={() => onStart(request.id, "")}>Review</Button>
                )}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Field({ label, value, className }: { label: string; value?: string | null; className?: string }) {
  return (
    <div className={cn(className)}>
      <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
      <p className="mt-1 text-sm text-zinc-800">{value || "—"}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2">
      <p className="text-xs uppercase text-zinc-400">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}
