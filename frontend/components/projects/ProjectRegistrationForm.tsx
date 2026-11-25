"use client";

import { Button } from "@/components/ui/button";
import { getAllContracts } from "@/lib/apis/contractApi";
import { getAllClientsClient, getAllUsersClient } from "@/lib/apis/readApi";
import { getAllServices } from "@/lib/apis/serviceApi";
import { getProjectById, registerProject, ProjectRecord } from "@/lib/apis/projectApi";
import { buildMonthlyCycles, contractDate, contractProjectType, openingCycle } from "@/lib/project-cycles";
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_OPTIONS } from "@/lib/project-options";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { btnFormCancel, btnFormSubmit } from "@/lib/dashboard-ui";
import ProjectSchedulePlanner from "@/components/projects/ProjectSchedulePlanner";
import {
  DraftService,
  DraftTask,
  syncDraftTasks,
  tasksMatch,
} from "@/lib/project-schedule";
import {
  DEFAULT_COMPANY_WORKING_DAYS,
  FRIDAY_NON_WORKING_DAY_MESSAGE,
  isFridayIsoDate,
  normalizeCompanyWorkingDays,
} from "@/lib/company-working-days";
import {
  changedScheduleError,
  PROJECT_REGISTRATION_SCHEDULE_OPTIONS,
  scheduleSignature,
  zonedNowParts,
} from "@/lib/scheduled-task-window";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useSWRConfig } from "swr";
import useSWR from "swr";

const TABS = ["Project", "Services", "Schedule", "Tasks", "Review"];

const fieldClass =
  "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-primary";

/** Same calendar day next month. 2026-11-11 becomes 2026-12-11. */
function addOneMonth(isoDate: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const date = new Date(year, month, Math.min(day, lastDay));
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Props = {
  onClose: () => void;
  projectId?: string;
};

function dateInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export default function ProjectRegistrationForm({ onClose, projectId }: Props) {
  const { mutate } = useSWRConfig();
  const { data: clientsRes } = useSWR("project-clients", getAllClientsClient);
  const { data: contractsRes } = useSWR("project-contracts", getAllContracts);
  const { data: servicesRes } = useSWR("project-services", () => getAllServices({ activeOnly: true }));
  const { data: staffRes } = useSWR("project-staff", getAllUsersClient);

  const clients = (clientsRes?.data ?? []) as Array<{ id: string; institution?: string; isActive?: boolean }>;
  const contracts = contractsRes?.data ?? [];
  const services = (servicesRes?.data ?? []).filter((service) => service.isActive !== false);
  const staff = (staffRes?.data ?? []) as Array<{ id: string; name: string }>;

  const [tab, setTab] = useState(0);
  const [saving, setSaving] = useState(false);
  const [originalSchedules, setOriginalSchedules] = useState<Record<string, string>>({});
  const now = useNow();
  const todayParts = zonedNowParts(now);
  const [name, setName] = useState("");
  const [clientId, setClientId] = useState("");
  const [contractId, setContractId] = useState("");
  const [billingMode, setBillingMode] = useState("ONE_TIME");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [description, setDescription] = useState("");
  const [lifecycleStatus, setLifecycleStatus] = useState("ACTIVE");
  const [workingDays, setWorkingDays] = useState<number[]>([...DEFAULT_COMPANY_WORKING_DAYS]);
  const [hours, setHours] = useState("09:00-17:00");
  const [notes, setNotes] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [subs, setSubs] = useState<Record<string, DraftService["subServices"]>>({});
  const [tasks, setTasks] = useState<DraftTask[]>([]);
  const [hydrated, setHydrated] = useState(!projectId);
  const [loadingProject, setLoadingProject] = useState(Boolean(projectId));
  const [savedSubIds, setSavedSubIds] = useState<string[]>([]);
  const [extraOpenIds, setExtraOpenIds] = useState<string[]>([]);
  const [pendingExtras, setPendingExtras] = useState<Record<string, { quantity: string; assigneeId: string; reason: string }>>({});
  const [extraRows, setExtraRows] = useState<Array<{ id: string; subServiceId: string; quantity: number; status: string; description?: string | null }>>([]);
  const [savedCycleCount, setSavedCycleCount] = useState(0);
  const [projectSaved, setProjectSaved] = useState(false);

  const clientContracts = contracts.filter((contract) => contract.clientId === clientId);
  const selectedContract = clientContracts.find((contract) => contract.id === contractId);
  const endless = selectedContract?.duration === "ENDLESS";
  const monthly = billingMode === "MONTHLY";
  const datesFollowContract = Boolean(selectedContract) && !projectSaved;
  const datesLocked = Boolean(selectedContract) && (datesFollowContract || projectSaved);

  function applyStartDate(value: string) {
    if (datesFollowContract) return;
    setStartDate(value);
    if (monthly) setEndDate(value ? addOneMonth(value) : "");
  }

  function applyBillingMode(value: string) {
    if (datesFollowContract) return;
    setBillingMode(value);
    if (value === "MONTHLY") setEndDate(startDate ? addOneMonth(startDate) : "");
  }

  function chooseContract(nextId: string) {
    if (nextId === contractId) return;
    const next = clientContracts.find((contract) => contract.id === nextId);
    if (projectSaved) {
      if (next && contractProjectType(next) !== billingMode) {
        toast.error("This contract type does not match the saved project");
        return;
      }
      const confirmed = window.confirm("Link this contract? Saved project dates and monthly cycles will stay as they are.");
      if (!confirmed) return;
      setContractId(nextId);
      return;
    }
    if (contractId && (startDate || endDate)) {
      const confirmed = window.confirm("Use this contract’s dates? Project dates and monthly cycles will follow the contract when you save.");
      if (!confirmed) return;
    }
    setContractId(nextId);
    if (!next) return;
    setBillingMode(contractProjectType(next));
    setStartDate(contractDate(next.startDate));
    setEndDate(next.duration === "ENDLESS" ? "" : contractDate(next.endDate));
  }

  const draftServices: DraftService[] = selectedServices.map((serviceId) => {
    const service = services.find((item) => item.id === serviceId);
    return {
      serviceId,
      serviceName: service?.serviceName ?? "Service",
      subServices: subs[serviceId] ?? [],
    };
  });
  const namedTasks = syncDraftTasks(draftServices, tasks);

  function toggleService(serviceId: string) {
    setSelectedServices((current) =>
      current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current, serviceId],
    );
    setSubs((current) =>
      current[serviceId]
        ? current
        : {
            ...current,
            [serviceId]: [
              {
                clientKey: `${serviceId}-1`,
                name: "",
                description: "",
                quantity: 1,
                unit: "Items",
                targetQuantity: 1,
                assigneeId: "",
              },
            ],
          },
    );
  }

  function updateSub(serviceId: string, index: number, patch: Partial<DraftService["subServices"][number]>) {
    setSubs((current) => ({
      ...current,
      [serviceId]: (current[serviceId] ?? []).map((sub, i) => (i === index ? { ...sub, ...patch } : sub)),
    }));
  }

  function removeSub(serviceId: string, index: number) {
    setSubs((current) => ({
      ...current,
      [serviceId]: (current[serviceId] ?? []).filter((_, i) => i !== index),
    }));
  }

  function addSub(serviceId: string) {
    setSubs((current) => ({
      ...current,
      [serviceId]: [
        ...(current[serviceId] ?? []),
        {
          clientKey: `${serviceId}-${Date.now()}`,
          name: "",
          description: "",
          quantity: 1,
          unit: "Items",
          targetQuantity: 1,
          assigneeId: "",
        },
      ],
    }));
  }

  const serviceSignature = draftServices
    .map((service) =>
      [
        service.serviceId,
        service.serviceName,
        ...service.subServices.map((sub) =>
          [sub.clientKey, sub.name, sub.description, sub.quantity, sub.assigneeId].join("|"),
        ),
      ].join(";"),
    )
    .join("||");
  const servicesRef = useRef(draftServices);
  servicesRef.current = draftServices;

  useEffect(() => {
    if (!hydrated) return;
    setTasks((current) => {
      const next = syncDraftTasks(servicesRef.current, current);
      return tasksMatch(next, current) ? current : next;
    });
  }, [serviceSignature, hydrated]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    getProjectById(projectId).then((result) => {
      if (cancelled) return;
      if (!result.success || !result.data) {
        toast.error(result.errors?.message || "Could not load the project");
        setLoadingProject(false);
        return;
      }
      const project = result.data as ProjectRecord;
      const schedule = (project.scheduleConfig ?? {}) as {
        workingDays?: number[];
        hours?: string;
        notes?: string;
      };
      const nextSubs: Record<string, DraftService["subServices"]> = {};
      const nextTasks: DraftTask[] = [];
      for (const link of project.serviceLinks ?? []) {
        const serviceId = link.service?.id;
        if (!serviceId) continue;
        nextSubs[serviceId] = [];
        for (const sub of link.subServices ?? []) {
          nextSubs[serviceId].push({
            clientKey: sub.id,
            name: sub.name,
            description: sub.description || "",
            quantity: sub.quantity,
            unit: sub.unit || "Items",
            targetQuantity: sub.targetQuantity || sub.quantity,
            assigneeId: sub.assigneeId || "",
          });
          const related = (project.tasks ?? [])
            .filter((task) => String(task.features?.subServiceId || "") === sub.id && !task.features?.isExtra)
            .sort((left, right) => left.description.localeCompare(right.description));
          related.forEach((task, index) => {
            const features = task.features ?? {};
            nextTasks.push({
              id: task.id,
              clientKey: `${sub.id}-${index + 1}`,
              name: task.description,
              description: task.description,
              serviceId,
              serviceName: link.service?.serviceName || "Service",
              subServiceName: sub.name,
              subServiceKey: sub.id,
              assigneeId: task.assgineeId || sub.assigneeId || "",
              scheduledDate: String(features.scheduledDate || dateInputValue(task.startDate) || ""),
              startTime: String(features.startTime || ""),
              endTime: String(features.endTime || ""),
              notes: String(features.scheduleNotes || ""),
              priority: String(features.priorityLabel || task.priority || "medium"),
              status: String(features.projectStatus || "PENDING"),
            });
          });
          const extras = (project.tasks ?? [])
            .filter((task) => String(task.features?.subServiceId || "") === sub.id && task.features?.isExtra);
          extras.forEach((task) => {
            const features = task.features ?? {};
            nextTasks.push({
              id: task.id,
              clientKey: `${sub.id}-extra-${task.id}`,
              name: task.description,
              description: task.description,
              serviceId,
              serviceName: link.service?.serviceName || "Service",
              subServiceName: sub.name,
              subServiceKey: sub.id,
              assigneeId: task.assgineeId || "",
              scheduledDate: String(features.scheduledDate || ""),
              startTime: String(features.startTime || ""),
              endTime: String(features.endTime || ""),
              notes: String(features.scheduleNotes || ""),
              priority: String(features.priorityLabel || task.priority || "medium"),
              status: String(features.projectStatus || "PENDING"),
              isExtra: true,
            });
          });
        }
      }
      setName(project.name || "");
      setClientId(project.clientId || "");
      setContractId(project.contractId || "");
      setBillingMode(project.billingMode === "MONTHLY" ? "MONTHLY" : "ONE_TIME");
      setStartDate(dateInputValue(project.startDate));
      setEndDate(dateInputValue(project.dueDate));
      setSavedCycleCount(project.cycles?.length ?? 0);
      setProjectSaved(!(project.isDraft || project.lifecycleStatus === "DRAFT"));
      setDescription(project.description || "");
      setLifecycleStatus(project.lifecycleStatus || project.status || "ACTIVE");
      setWorkingDays(normalizeCompanyWorkingDays(schedule.workingDays));
      setHours(schedule.hours || "09:00-17:00");
      setNotes(schedule.notes || "");
      setSelectedServices(Object.keys(nextSubs));
      setSubs(nextSubs);
      setSavedSubIds(Object.values(nextSubs).flat().map((sub) => sub.clientKey));
      setExtraRows((project.extraRequests ?? []).map((request) => ({
        id: request.id,
        subServiceId: request.subService?.id || "",
        quantity: request.quantity,
        status: request.status,
        description: request.description,
      })));
      const signatures: Record<string, string> = {};
      for (const task of nextTasks) {
        if (task.id) signatures[task.id] = scheduleSignature(task);
      }
      setOriginalSchedules(signatures);
      setTasks(nextTasks);
      setHydrated(true);
      setLoadingProject(false);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const previewCycles = monthly && startDate
    ? (endDate && !endless ? buildMonthlyCycles(startDate, endDate) : openingCycle(startDate))
    : [];
  const scheduleEnd = projectSaved
    ? (endDate || previewCycles[previewCycles.length - 1]?.endDate || "")
    : monthly
      ? (previewCycles[0]?.endDate || "")
      : endDate;

  function tasksWithPendingExtras(current: DraftTask[], strict: boolean) {
    const kept = current.filter((task) => !task.pendingExtra);
    const additions: DraftTask[] = [];
    for (const service of draftServices) {
      for (const sub of service.subServices) {
        if (!extraOpenIds.includes(sub.clientKey)) continue;
        const pending = pendingExtras[sub.clientKey];
        if (!pending) continue;
        const reason = pending.reason.trim();
        const started = reason.length > 0 || pending.quantity !== "1" || pending.assigneeId !== (sub.assigneeId || "");
        if (!started) continue;
        const quantity = Number(pending.quantity);
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
          if (!strict) continue;
          return { tasks: current, error: "Enter how many extra items you need" };
        }
        if (!pending.assigneeId) {
          if (!strict) continue;
          return { tasks: current, error: "Choose an employee for the extra work" };
        }
        if (!reason) {
          if (!strict) continue;
          return { tasks: current, error: "A reason is required" };
        }
        const signature = `${quantity}|${pending.assigneeId}|${reason}`;
        const existingPending = current.filter((task) => task.pendingExtra && task.subServiceKey === sub.clientKey);
        if (existingPending.length === quantity && existingPending.every((task) => task.pendingSignature === signature)) {
          additions.push(...existingPending);
          continue;
        }
        const label = sub.name.trim() || "Item";
        let max = 0;
        for (const task of kept.filter((item) => item.isExtra && item.subServiceKey === sub.clientKey)) {
          const match = /(\d+)\s*$/.exec(task.name);
          if (match) max = Math.max(max, Number(match[1]));
        }
        for (let index = 1; index <= quantity; index += 1) {
          const number = max + index;
          const clientKey = `${sub.clientKey}-extra-new-${number}`;
          const name = `Extra ${label} ${String(number).padStart(2, "0")}`;
          const previous = current.find((task) => task.clientKey === clientKey);
          additions.push({
            clientKey,
            name,
            description: name,
            serviceId: service.serviceId,
            serviceName: service.serviceName,
            subServiceName: label,
            subServiceKey: sub.clientKey,
            assigneeId: pending.assigneeId,
            scheduledDate: previous?.scheduledDate || "",
            startTime: previous?.startTime || "",
            endTime: previous?.endTime || "",
            notes: previous?.notes || "",
            priority: previous?.priority || "medium",
            status: "PENDING",
            isExtra: true,
            pendingExtra: true,
            pendingSignature: signature,
            extraReason: reason,
          });
        }
      }
    }
    return { tasks: [...kept, ...additions], error: "" };
  }

  function scheduleIsValid(list: DraftTask[] = tasks) {
    const pastTask = list.find((task) =>
      changedScheduleError(task, originalSchedules, now, PROJECT_REGISTRATION_SCHEDULE_OPTIONS),
    );
    if (!pastTask) return true;
    toast.error(
      `${pastTask.name}: ${changedScheduleError(pastTask, originalSchedules, now, PROJECT_REGISTRATION_SCHEDULE_OPTIONS)}`,
    );
    return false;
  }

  function goToTab(index: number) {
    let nextTasks = namedTasks;
    if (index > 1) {
      const prepared = tasksWithPendingExtras(namedTasks, true);
      if (prepared.error) {
        toast.error(prepared.error);
        setTab(1);
        return;
      }
      nextTasks = prepared.tasks;
      setTasks(prepared.tasks);
    }
    if (index > tab && index > 2 && !scheduleIsValid(nextTasks)) return;
    setTab(index);
  }

  async function save(isDraft: boolean) {
    if (!name.trim() || !clientId) {
      toast.error("Project name and client are required");
      setTab(0);
      return;
    }
    if (!isDraft && monthly && !startDate) {
      toast.error("Start date is required for a monthly project");
      setTab(0);
      return;
    }
    const prepared = tasksWithPendingExtras(namedTasks, !isDraft);
    if (prepared.error) {
      toast.error(prepared.error);
      setTab(1);
      return;
    }
    const tasksToSave = prepared.tasks;
    const invalidSlot = tasksToSave.find((task) =>
      changedScheduleError(task, originalSchedules, Date.now(), PROJECT_REGISTRATION_SCHEDULE_OPTIONS),
    );
    if (!isDraft && invalidSlot) {
      toast.error(
        `${invalidSlot.name}: ${changedScheduleError(invalidSlot, originalSchedules, Date.now(), PROJECT_REGISTRATION_SCHEDULE_OPTIONS)}`,
      );
      setTab(2);
      return;
    }
    if (!isDraft && billingMode === "ONE_TIME" && !endless && (!startDate || !endDate)) {
      toast.error("Start and end dates are required for a one-time project");
      setTab(0);
      return;
    }
    if (!isDraft && datesFollowContract && !endless && !endDate) {
      toast.error("The selected contract has no end date");
      setTab(0);
      return;
    }
    if (!isDraft && datesFollowContract && monthly && endDate && previewCycles.length === 0) {
      toast.error("The contract dates do not produce a monthly cycle");
      setTab(0);
      return;
    }
    const resolvedEndDate = datesFollowContract
      ? (endless ? null : endDate || null)
      : monthly
        ? (endDate || (startDate ? addOneMonth(startDate) : null))
        : endless
          ? null
          : endDate || null;
    setSaving(true);
    const result = await registerProject({
      id: projectId,
      name,
      clientId,
      contractId: contractId || null,
      billingMode,
      startDate: startDate || null,
      endDate: resolvedEndDate,
      description,
      lifecycleStatus: isDraft ? "DRAFT" : lifecycleStatus,
      isDraft,
      services: draftServices,
      schedule: {
        startDate: startDate || null,
        endDate: resolvedEndDate,
        workingDays: normalizeCompanyWorkingDays(workingDays),
        hours,
        notes,
        holidays: [],
      },
      tasks: isDraft ? [] : tasksToSave,
    });
    setSaving(false);
    if (!result.success) {
      toast.error(result.errors?.message || "Could not save the project");
      return;
    }
    const assignedCode = result.data?.projectCode;
    toast.success(
      projectId
        ? "Project updated"
        : assignedCode
          ? `${isDraft ? "Draft" : "Project"} saved as ${assignedCode}`
          : isDraft
            ? "Project draft saved"
            : "Project registered",
    );
    await mutate(SWR_CACH_KEYS.projects.key);
    await mutate(SWR_CACH_KEYS.tasks.key);
    await mutate(SWR_CACH_KEYS.myTasksList.key);
    await mutate(SWR_CACH_KEYS.myTasksToday.key);
    onClose();
  }

  if (loadingProject) {
    return <p className="px-6 py-8 text-sm text-zinc-500">Loading project…</p>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-100 px-6 py-3">
        {TABS.map((label, index) => (
          <button
            key={label}
            type="button"
            onClick={() => goToTab(index)}
            className={cn(
              "rounded-full px-3 py-1 text-sm",
              tab === index ? "bg-primary text-white" : "bg-zinc-100 text-zinc-600",
            )}
          >
            {index + 1}. {label}
          </button>
        ))}
      </div>
      <div className="h-1 bg-zinc-100">
        <div className="h-full bg-primary" style={{ width: `${((tab + 1) / TABS.length) * 100}%` }} />
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-6">
        {tab === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-zinc-600 sm:col-span-2">Project Name
              <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="text-sm text-zinc-600">Client
              <select className={fieldClass} value={clientId} onChange={(e) => {
                setClientId(e.target.value);
                setContractId("");
                if (!projectSaved) {
                  setStartDate("");
                  setEndDate("");
                  setBillingMode("ONE_TIME");
                }
              }}>
                <option value="">Select client</option>
                {clients.filter((client) => client.isActive !== false).map((client) => (
                  <option key={client.id} value={client.id}>{client.institution}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">Contract
              <select className={fieldClass} value={contractId} onChange={(e) => chooseContract(e.target.value)}>
                <option value="">Select contract</option>
                {clientContracts.map((contract) => (
                  <option key={contract.id} value={contract.id}>
                    {contract.contractNumber} {contract.title ? `· ${contract.title}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">Project Type
              <select className={fieldClass} value={billingMode} disabled={Boolean(selectedContract)} onChange={(e) => applyBillingMode(e.target.value)}>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">Status
              <select className={fieldClass} value={lifecycleStatus} onChange={(e) => setLifecycleStatus(e.target.value)}>
                {PROJECT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="text-sm text-zinc-600">Start Date
              <input type="date" className={fieldClass} value={startDate} readOnly={datesLocked} disabled={datesLocked} onChange={(e) => applyStartDate(e.target.value)} />
            </label>
            <label className="text-sm text-zinc-600">
              End Date {datesLocked ? "(from the contract)" : monthly ? "(one month from the start date)" : endless ? "(not required for endless contracts)" : ""}
              <input
                type="date"
                className={fieldClass}
                value={datesLocked ? endDate : monthly && startDate ? addOneMonth(startDate) : endDate}
                readOnly={datesLocked || monthly}
                disabled={datesLocked || monthly}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </label>
            {monthly && !projectSaved && previewCycles.length > 0 ? (
              <div className="sm:col-span-2">
                <p className="mb-2 text-sm text-zinc-600">Monthly cycles</p>
                <div className="overflow-x-auto rounded-md border border-zinc-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-zinc-500">
                        <th className="px-3 py-2">Cycle</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">End</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewCycles.map((cycle) => (
                        <tr key={cycle.label} className="border-t border-zinc-100">
                          <td className="px-3 py-2">{cycle.label}</td>
                          <td className="px-3 py-2">{cycle.startDate}</td>
                          <td className="px-3 py-2">{cycle.endDate}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {endless ? <p className="mt-2 text-xs text-zinc-500">This contract has no end date, so the first cycle is created now. Later cycles are added one month at a time and do not replace earlier work.</p> : null}
              </div>
            ) : null}
            <label className="text-sm text-zinc-600 sm:col-span-2">Description
              <textarea className={cn(fieldClass, "h-24 py-2")} value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
          </div>
        )}

        {tab === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-zinc-500">Select main services, then add project-specific sub services. These are not saved to global Services.</p>
            <div className="flex flex-wrap gap-2">
              {services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  onClick={() => toggleService(service.id)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm",
                    selectedServices.includes(service.id) ? "border-primary bg-primary text-white" : "border-zinc-200",
                  )}
                >
                  {service.serviceName}
                </button>
              ))}
            </div>
            {draftServices.map((service) => (
              <div key={service.serviceId} className="rounded-lg border border-zinc-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-medium">{service.serviceName}</h3>
                  <Button type="button" variant="outline" size="sm" onClick={() => addSub(service.serviceId)}>Add sub service</Button>
                </div>
                {(subs[service.serviceId] ?? []).length === 0 ? (
                  <p className="text-sm text-zinc-500">No sub services. Add one when this service needs project work.</p>
                ) : null}
                {(subs[service.serviceId] ?? []).map((sub, index) => (
                  <div key={sub.clientKey} className="mb-3 rounded-md border border-zinc-100 p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-zinc-500">Sub service {index + 1}</span>
                      <div className="flex items-center gap-3">
                        {projectId && savedSubIds.includes(sub.clientKey) ? (
                          <button
                            type="button"
                            className="text-sm font-medium text-primary hover:underline"
                            onClick={() => {
                              setExtraOpenIds((current) => (current.includes(sub.clientKey) ? current : [...current, sub.clientKey]));
                              setPendingExtras((current) => current[sub.clientKey]
                                ? current
                                : { ...current, [sub.clientKey]: { quantity: "1", assigneeId: sub.assigneeId || "", reason: "" } });
                            }}
                          >
                            Add extra
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-sm text-red-600 hover:underline"
                          onClick={() => removeSub(service.serviceId, index)}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-3">
                      <input className={fieldClass} placeholder="Sub service name" value={sub.name} onChange={(e) => updateSub(service.serviceId, index, { name: e.target.value })} />
                      <input className={fieldClass} placeholder="Unit" value={sub.unit} onChange={(e) => updateSub(service.serviceId, index, { unit: e.target.value })} />
                      <input className={fieldClass} type="number" min={1} value={sub.quantity} onChange={(e) => updateSub(service.serviceId, index, { quantity: Number(e.target.value), targetQuantity: Number(e.target.value) })} />
                      <input className={cn(fieldClass, "sm:col-span-2")} placeholder="Description" value={sub.description} onChange={(e) => updateSub(service.serviceId, index, { description: e.target.value })} />
                      <select className={fieldClass} value={sub.assigneeId} onChange={(e) => updateSub(service.serviceId, index, { assigneeId: e.target.value })}>
                        <option value="">Default employee</option>
                        {staff.map((person) => (
                          <option key={person.id} value={person.id}>{person.name}</option>
                        ))}
                      </select>
                    </div>
                    {projectId && savedSubIds.includes(sub.clientKey) ? (
                      <div className="mt-3 border-t border-zinc-100 pt-3">
                        {extraRows.filter((row) => row.subServiceId === sub.clientKey).map((row) => (
                          <p key={row.id} className="text-xs text-zinc-500">Extra {sub.name || "work"}: {row.quantity} · {row.status}</p>
                        ))}
                        {extraOpenIds.includes(sub.clientKey) && pendingExtras[sub.clientKey] ? (
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <input
                              className={fieldClass}
                              type="number"
                              min={1}
                              max={50}
                              placeholder="Quantity"
                              value={pendingExtras[sub.clientKey].quantity}
                              onChange={(event) => setPendingExtras((current) => ({
                                ...current,
                                [sub.clientKey]: { ...current[sub.clientKey], quantity: event.target.value },
                              }))}
                            />
                            <select
                              className={fieldClass}
                              value={pendingExtras[sub.clientKey].assigneeId}
                              onChange={(event) => setPendingExtras((current) => ({
                                ...current,
                                [sub.clientKey]: { ...current[sub.clientKey], assigneeId: event.target.value },
                              }))}
                            >
                              <option value="">Assign employee</option>
                              {staff.map((person) => (
                                <option key={person.id} value={person.id}>{person.name}</option>
                              ))}
                            </select>
                            <input
                              className={cn(fieldClass, "sm:col-span-2")}
                              placeholder="Reason for the extra work"
                              value={pendingExtras[sub.clientKey].reason}
                              onChange={(event) => setPendingExtras((current) => ({
                                ...current,
                                [sub.clientKey]: { ...current[sub.clientKey], reason: event.target.value },
                              }))}
                            />
                            <p className="text-xs text-zinc-500 sm:col-span-2">This extra is added when you save the project.</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === 2 && (
          <ProjectSchedulePlanner
            tasks={namedTasks}
            services={draftServices}
            staff={staff}
            startDate={startDate}
            endDate={scheduleEnd}
            monthly={monthly}
            workingDays={workingDays}
            hours={hours}
            notes={notes}
            onWorkingDaysChange={(days) => setWorkingDays(normalizeCompanyWorkingDays(days))}
            onHoursChange={setHours}
            onNotesChange={setNotes}
            onTasksChange={setTasks}
            originalSchedules={originalSchedules}
          />
        )}

        {tab === 3 && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-500">These are the same work items from the schedule. Dates, times, and employees stay in place.</p>
            {namedTasks.length === 0 ? (
              <p className="text-sm text-zinc-500">Add sub services with a quantity greater than zero. Each unit becomes one task.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="text-left text-zinc-500">
                      <th className="py-2">Task</th>
                      <th>Employee</th>
                      <th>Scheduled date</th>
                      <th>Start time</th>
                      <th>End time</th>
                      <th>Priority</th>
                    </tr>
                  </thead>
                  <tbody>
                    {namedTasks.map((task) => {
                      return (
                        <tr key={task.clientKey} className="border-t border-zinc-100">
                          <td className="py-2 pr-2">
                            <div>{task.name}</div>
                            <div className="text-xs text-zinc-400">{task.serviceName} · {task.subServiceName}</div>
                          </td>
                          <td className="pr-2">
                            <select className={fieldClass} value={task.assigneeId} onChange={(e) => setTasks((current) => current.map((item) => item.clientKey === task.clientKey ? { ...item, assigneeId: e.target.value } : item))}>
                              <option value="">Unassigned</option>
                              {staff.map((person) => (
                                <option key={person.id} value={person.id}>{person.name}</option>
                              ))}
                            </select>
                            {task.startTime && task.endTime && task.endTime <= task.startTime ? <p className="text-xs text-amber-600">End time must be later than the start time</p> : null}
                            {namedTasks.some((other) => other.clientKey !== task.clientKey && other.assigneeId && other.assigneeId === task.assigneeId && other.scheduledDate && other.scheduledDate === task.scheduledDate && task.startTime && task.endTime && other.startTime && other.endTime && task.startTime < other.endTime && other.startTime < task.endTime) ? <p className="text-xs text-amber-600">Overlapping time for this employee</p> : null}
                          </td>
                          <td className="pr-2">
                            <input
                              type="date"
                              className={fieldClass}
                              value={task.scheduledDate}
                              onChange={(e) => {
                                const next = e.target.value;
                                if (isFridayIsoDate(next)) {
                                  toast.error(FRIDAY_NON_WORKING_DAY_MESSAGE);
                                  return;
                                }
                                setTasks((current) =>
                                  current.map((item) =>
                                    item.clientKey === task.clientKey ? { ...item, scheduledDate: next } : item,
                                  ),
                                );
                              }}
                            />
                            {changedScheduleError(task, originalSchedules, now, PROJECT_REGISTRATION_SCHEDULE_OPTIONS) ? (
                              <p className="text-xs text-red-600">
                                {changedScheduleError(task, originalSchedules, now, PROJECT_REGISTRATION_SCHEDULE_OPTIONS)}
                              </p>
                            ) : null}
                          </td>
                          <td className="pr-2">
                            <input type="time" className={fieldClass} value={task.startTime} onChange={(e) => setTasks((current) => current.map((item) => item.clientKey === task.clientKey ? { ...item, startTime: e.target.value } : item))} />
                          </td>
                          <td className="pr-2">
                            <input type="time" className={fieldClass} value={task.endTime} onChange={(e) => setTasks((current) => current.map((item) => item.clientKey === task.clientKey ? { ...item, endTime: e.target.value } : item))} />
                          </td>
                          <td>
                            <select className={fieldClass} value={task.priority} onChange={(e) => setTasks((current) => current.map((item) => item.clientKey === task.clientKey ? { ...item, priority: e.target.value } : item))}>
                              <option value="low">Low</option>
                              <option value="medium">Medium</option>
                              <option value="high">High</option>
                              <option value="urgent">Urgent</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 4 && (
          <div className="space-y-3 text-sm text-zinc-700">
            <p><strong>{name || "Untitled project"}</strong> · {billingMode === "MONTHLY" ? "Monthly" : "One-Time"}</p>
            <p>Client: {clients.find((client) => client.id === clientId)?.institution || "—"}</p>
            <p>Services: {draftServices.map((service) => service.serviceName).join(", ") || "None"}</p>
            <p>Tasks to create: {namedTasks.length} · Unscheduled: {namedTasks.filter((task) => !task.scheduledDate).length}</p>
            <p>Schedule: {startDate || "—"} to {datesFollowContract ? (endDate || (endless ? "Open" : "—")) : (scheduleEnd || (endless ? "Open" : "—"))}</p>
            {monthly && !projectSaved && previewCycles.length > 0 ? <p>Monthly cycles: {previewCycles.length}. Tasks created now belong to {previewCycles[0].label}. Each cycle keeps its own tasks and progress.</p> : null}
            {monthly && projectSaved ? <p>{savedCycleCount} saved monthly cycle{savedCycleCount === 1 ? "" : "s"} stay as they are.</p> : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-zinc-500">
                    <th className="py-2">Date</th>
                    <th>Task</th>
                    <th>Employee</th>
                    <th>Start time</th>
                    <th>End time</th>
                  </tr>
                </thead>
                <tbody>
                  {namedTasks.map((task) => (
                    <tr key={task.clientKey} className="border-t border-zinc-100">
                      <td className="py-2">{task.scheduledDate || "Unscheduled"}</td>
                      <td>{task.name}</td>
                      <td>{staff.find((person) => person.id === task.assigneeId)?.name || "Unassigned"}</td>
                      <td>{task.startTime || "—"}</td>
                      <td>{task.endTime || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-zinc-100 px-6 py-4">
        <Button type="button" variant="outline" className={btnFormCancel} onClick={() => (tab === 0 ? onClose() : setTab((value) => value - 1))}>
          {tab === 0 ? "Cancel" : "Back"}
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={saving} onClick={() => save(true)}>Save draft</Button>
          {tab < TABS.length - 1 ? (
            <Button type="button" className={btnFormSubmit} onClick={() => goToTab(tab + 1)}>
              Next
            </Button>
          ) : (
            <Button type="button" className={btnFormSubmit} disabled={saving} onClick={() => save(false)}>
              {saving ? "Saving…" : projectId ? "Save changes" : "Save project"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
