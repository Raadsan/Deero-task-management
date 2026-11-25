"use client";

import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import {
  FRIDAY_DAY_INDEX,
  FRIDAY_LEGACY_SCHEDULE_WARNING,
  FRIDAY_NON_WORKING_DAY_MESSAGE,
  fridayLegacyScheduleWarning,
  isCompanyWorkingDayIndex,
  isFridayIsoDate,
  normalizeCompanyWorkingDays,
  SELECTABLE_WORKING_DAY_INDICES,
  WEEKDAY_SHORT,
} from "@/lib/company-working-days";
import {
  DraftService,
  DraftTask,
  formatIsoDate,
  parseIsoDate,
  projectTaskOverlapWarning,
} from "@/lib/project-schedule";
import {
  changedScheduleError,
  isHistoricalScheduledDate,
  PAST_SCHEDULE_MESSAGE,
  PROJECT_REGISTRATION_SCHEDULE_OPTIONS,
  zonedNowParts,
} from "@/lib/scheduled-task-window";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

const PALETTE = [
  "bg-rose-100 text-rose-800",
  "bg-sky-100 text-sky-800",
  "bg-amber-100 text-amber-900",
  "bg-emerald-100 text-emerald-800",
  "bg-violet-100 text-violet-800",
  "bg-orange-100 text-orange-800",
  "bg-teal-100 text-teal-800",
];

const fieldClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm outline-none focus:border-primary";

type Staff = { id: string; name: string };

type Props = {
  tasks: DraftTask[];
  services: DraftService[];
  staff: Staff[];
  startDate: string;
  endDate: string;
  monthly: boolean;
  workingDays: number[];
  hours: string;
  notes: string;
  onWorkingDaysChange: (days: number[]) => void;
  onHoursChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onTasksChange: (tasks: DraftTask[]) => void;
  originalSchedules?: Record<string, string>;
};

function serviceColor(serviceId: string) {
  let hash = 0;
  for (const char of serviceId) hash = (hash + char.charCodeAt(0)) % PALETTE.length;
  return PALETTE[hash];
}

function staffName(staff: Staff[], id: string) {
  return staff.find((person) => person.id === id)?.name || "Unassigned";
}

function buildMonthCells(cursor: Date) {
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (let index = 0; index < first.getDay(); index += 1) {
    cells.push({ date: formatIsoDate(new Date(year, month, index - first.getDay() + 1)), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: formatIsoDate(new Date(year, month, day)), inMonth: true });
  }
  let extra = 1;
  while (cells.length % 7 !== 0) {
    cells.push({ date: formatIsoDate(new Date(year, month + 1, extra)), inMonth: false });
    extra += 1;
  }
  return cells;
}

export default function ProjectSchedulePlanner({
  tasks,
  services,
  staff,
  startDate,
  endDate,
  workingDays,
  hours,
  notes,
  onWorkingDaysChange,
  onHoursChange,
  onNotesChange,
  onTasksChange,
  originalSchedules = {},
}: Props) {
  const now = useNow();
  const todayParts = zonedNowParts(now);
  const initial = parseIsoDate(startDate) ?? new Date();
  const openingDay = startDate || zonedNowParts().date;
  const opening = parseIsoDate(openingDay) ?? initial;
  const [cursor, setCursor] = useState(() => new Date(opening.getFullYear(), opening.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(openingDay);
  const [view, setView] = useState<"calendar" | "list">("calendar");
  const [serviceFilter, setServiceFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [sortKey, setSortKey] = useState<"date" | "task" | "service" | "employee">("date");
  const [sortAsc, setSortAsc] = useState(true);
  const [placeKey, setPlaceKey] = useState("");
  const [moreDate, setMoreDate] = useState<string | null>(null);
  const [focusKey, setFocusKey] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const today = zonedNowParts().date;
    const day = startDate || today;
    const next = parseIsoDate(day);
    if (!next) return;
    setCursor(new Date(next.getFullYear(), next.getMonth(), 1));
    setSelectedDate(day);
  }, [startDate]);

  const rangeStart = startDate;
  const rangeEnd = endDate || startDate;
  const cells = buildMonthCells(cursor);
  const tasksByDate = useMemo(() => {
    const map = new Map<string, DraftTask[]>();
    tasks.forEach((task) => {
      if (!task.scheduledDate) return;
      const list = map.get(task.scheduledDate) ?? [];
      list.push(task);
      map.set(task.scheduledDate, list);
    });
    return map;
  }, [tasks]);

  const warnings = useMemo(() => {
    const messages = new Map<string, string[]>();
    tasks.forEach((task) => {
      const notesForTask: string[] = [];
      if (task.scheduledDate) {
        const day = parseIsoDate(task.scheduledDate)?.getDay();
        const legacyFriday = fridayLegacyScheduleWarning(task);
        if (legacyFriday) notesForTask.push(legacyFriday);
        else if (day != null && !isCompanyWorkingDayIndex(day, workingDays)) {
          notesForTask.push("Non-working day");
        }
        if (rangeStart && task.scheduledDate < rangeStart) notesForTask.push("Before the project starts");
        if (rangeEnd && task.scheduledDate > rangeEnd) notesForTask.push("After the project ends");
        if (task.startTime && task.endTime && task.endTime <= task.startTime) {
          notesForTask.push("End time must be later than the start time");
        }
        const past = changedScheduleError(task, originalSchedules, now, PROJECT_REGISTRATION_SCHEDULE_OPTIONS);
        if (past && past !== "End time must be later than the start time.") notesForTask.push(past);
        if (isHistoricalScheduledDate(task.scheduledDate, now) && !task.id) {
          notesForTask.push("Will be saved as completed (100%)");
        }
        const overlapWarning = projectTaskOverlapWarning(task, tasks);
        if (overlapWarning) notesForTask.push(overlapWarning);
      }
      if (notesForTask.length) messages.set(task.clientKey, notesForTask);
    });
    return messages;
  }, [tasks, workingDays, rangeStart, rangeEnd, originalSchedules, now]);

  function patchTask(clientKey: string, patch: Partial<DraftTask>) {
    onTasksChange(tasks.map((task) => (task.clientKey === clientKey ? { ...task, ...patch } : task)));
  }

  function applyScheduledDate(clientKey: string, date: string) {
    if (!date) {
      patchTask(clientKey, { scheduledDate: "" });
      return;
    }
    if (isFridayIsoDate(date)) {
      toast.error(FRIDAY_NON_WORKING_DAY_MESSAGE);
      return;
    }
    patchTask(clientKey, { scheduledDate: date });
  }

  function placeOnDate(clientKey: string, date: string) {
    if (!clientKey) return;
    if (isFridayIsoDate(date)) {
      toast.error(FRIDAY_NON_WORKING_DAY_MESSAGE);
      return;
    }
    patchTask(clientKey, { scheduledDate: date });
    setPlaceKey("");
    setFocusKey(clientKey);
    setSelectedDate(date);
  }

  function chooseDay(date: string) {
    setMoreDate(null);
    setSelectedDate(date);
    if (placeKey) placeOnDate(placeKey, date);
    else setFocusKey("");
  }

  function showMonth(offset: number) {
    const next = new Date(cursor.getFullYear(), cursor.getMonth() + offset, 1);
    setCursor(next);
    setMoreDate(null);
    const monthKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
    if (selectedDate.startsWith(monthKey)) return;
    const first = formatIsoDate(next);
    const day = first < todayParts.date && todayParts.date.startsWith(monthKey) ? todayParts.date : first;
    if (day.startsWith(monthKey)) setSelectedDate(day);
  }

  function openTask(date: string, clientKey: string) {
    setSelectedDate(date);
    setFocusKey(clientKey);
    setMoreDate(null);
    window.setTimeout(() => {
      editorRef.current?.querySelector(`[data-task-key="${clientKey}"]`)?.scrollIntoView({ block: "nearest" });
    }, 0);
  }

    const subRows = services.flatMap((service) =>
    service.subServices
      .filter((sub) => sub.name.trim() || Number(sub.quantity) > 0)
      .map((sub) => {
        const items = tasks.filter((task) => task.subServiceKey === sub.clientKey);
        const scheduled = items.filter((task) => task.scheduledDate).length;
        return {
          key: sub.clientKey,
          name: sub.name.trim() || "Item",
          serviceName: service.serviceName,
          serviceId: service.serviceId,
          quantity: items.length,
          unit: sub.unit,
          employee: staffName(staff, sub.assigneeId),
          status: items.length === 0 ? "No items" : scheduled === 0 ? "Not scheduled" : scheduled === items.length ? "Fully scheduled" : `${scheduled}/${items.length} scheduled`,
        };
      }),
  );

  const filtered = tasks
    .filter((task) => (serviceFilter ? task.serviceId === serviceFilter : true))
    .filter((task) => (employeeFilter ? task.assigneeId === employeeFilter : true))
    .slice()
    .sort((left, right) => {
      const value = (task: DraftTask) => {
        if (sortKey === "task") return taskLabel(task, services);
        if (sortKey === "service") return task.serviceName;
        if (sortKey === "employee") return staffName(staff, task.assigneeId);
        return task.scheduledDate || "9999-99-99";
      };
      const compared = value(left).localeCompare(value(right));
      return sortAsc ? compared : -compared;
    });

  function toggleSort(key: typeof sortKey) {
    if (sortKey === key) setSortAsc((current) => !current);
    else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  const unscheduled = tasks.filter((task) => !task.scheduledDate || !task.startTime || !task.endTime);
  const monthLabel = cursor.toLocaleString(undefined, { month: "long", year: "numeric" });

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-zinc-200 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-zinc-500">Schedule settings</p>
        <div className="flex flex-wrap items-center gap-2">
          {SELECTABLE_WORKING_DAY_INDICES.map((index) => (
            <button
              key={WEEKDAY_SHORT[index]}
              type="button"
              onClick={() => {
                const normalized = normalizeCompanyWorkingDays(workingDays);
                onWorkingDaysChange(
                  normalized.includes(index)
                    ? normalized.filter((value) => value !== index)
                    : [...normalized, index].sort((a, b) => a - b),
                );
              }}
              className={cn(
                "rounded-md border px-3 py-1 text-sm",
                workingDays.includes(index) ? "border-primary bg-primary text-white" : "border-zinc-200",
              )}
            >
              {WEEKDAY_SHORT[index]}
            </button>
          ))}
          <span
            className="rounded-md border border-zinc-200 bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-500"
            title="Friday is always a non-working day"
          >
            {WEEKDAY_SHORT[FRIDAY_DAY_INDEX]} — OFF
          </span>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-zinc-600">Working hours
            <input className={cn(fieldClass, "mt-1.5")} value={hours} onChange={(event) => onHoursChange(event.target.value)} />
          </label>
          <label className="text-sm text-zinc-600">Schedule notes
            <input className={cn(fieldClass, "mt-1.5")} value={notes} onChange={(event) => onNotesChange(event.target.value)} />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-left text-xs text-zinc-500">
              <th className="px-3 py-2.5">Sub service</th>
              <th className="px-3 py-2.5">Main service</th>
              <th className="px-3 py-2.5">Qty</th>
              <th className="px-3 py-2.5">Unit</th>
              <th className="px-3 py-2.5">Default employee</th>
              <th className="px-3 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody>
            {subRows.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-4 text-zinc-500">Add sub services on the previous tab. Each quantity becomes its own work item here.</td></tr>
            ) : subRows.map((row) => (
              <tr key={row.key} className="border-t border-zinc-100">
                <td className="px-3 py-2.5">
                  <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", serviceColor(row.serviceId).split(" ")[0])} />
                  {row.name}
                </td>
                <td className="px-3 py-2.5">{row.serviceName}</td>
                <td className="px-3 py-2.5">{row.quantity}</td>
                <td className="px-3 py-2.5">{row.unit}</td>
                <td className="px-3 py-2.5">{row.employee}</td>
                <td className="px-3 py-2.5">{row.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant={view === "calendar" ? "default" : "outline"} size="sm" onClick={() => setView("calendar")}>Calendar</Button>
        <Button type="button" variant={view === "list" ? "default" : "outline"} size="sm" onClick={() => setView("list")}>List</Button>
      </div>

      {view === "calendar" ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => showMonth(-1)}>Previous</Button>
            <h3 className="text-sm font-medium">{monthLabel}</h3>
            <Button type="button" variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => showMonth(1)}>Next</Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-zinc-500 sm:gap-1.5 sm:text-[11px]">
            {WEEKDAY_SHORT.map((day, index) => (
              <div key={day} className={cn("truncate", index === FRIDAY_DAY_INDEX && "text-zinc-400")}>
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {cells.map((cell) => {
              const dayTasksForCell = tasksByDate.get(cell.date) ?? [];
              const visibleTasks = dayTasksForCell.slice(0, 2);
              const hiddenCount = dayTasksForCell.length - visibleTasks.length;
              const inRange = (!rangeStart || cell.date >= rangeStart) && (!rangeEnd || cell.date <= rangeEnd);
              const dayIndex = parseIsoDate(cell.date)?.getDay() ?? -1;
              const isFridayOff = dayIndex === FRIDAY_DAY_INDEX;
              const working = isCompanyWorkingDayIndex(dayIndex, workingDays);
              return (
                <div key={cell.date} className={cn("relative min-w-0", moreDate === cell.date && "z-30")}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => chooseDay(cell.date)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        chooseDay(cell.date);
                      }
                    }}
                    className={cn(
                      "h-[84px] overflow-hidden rounded-md border p-1 text-left sm:h-[96px] sm:p-1.5",
                      selectedDate === cell.date ? "border-primary ring-1 ring-primary" : "border-zinc-200",
                      cell.inMonth ? "bg-white" : "bg-zinc-50 text-zinc-400",
                      !inRange && "opacity-60",
                      cell.date < todayParts.date && "opacity-70",
                      isFridayOff && cell.inMonth && "bg-zinc-100",
                      !working && !isFridayOff && "bg-zinc-50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-0.5 text-[10px] font-medium leading-none sm:text-[11px]">
                      <span>{Number(cell.date.slice(8))}</span>
                      {isFridayOff && cell.inMonth ? (
                        <span className="truncate text-[8px] font-semibold uppercase text-zinc-500 sm:text-[9px]">OFF</span>
                      ) : null}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {visibleTasks.map((task) => (
                        <button
                          key={task.clientKey}
                          type="button"
                          title={`${taskLabel(task, services)} · ${staffName(staff, task.assigneeId)}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openTask(cell.date, task.clientKey);
                          }}
                          className={cn("flex h-[18px] w-full min-w-0 items-center gap-1 truncate rounded px-1 text-left text-[10px] leading-none sm:h-5 sm:text-[11px]", serviceColor(task.serviceId))}
                        >
                          <span className="min-w-0 flex-1 truncate">{taskLabel(task, services)}</span>
                          <span className="hidden max-w-[40%] shrink-0 truncate opacity-80 sm:inline">{staffName(staff, task.assigneeId).split(" ")[0]}</span>
                        </button>
                      ))}
                      {hiddenCount > 0 ? (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMoreDate((current) => (current === cell.date ? null : cell.date));
                          }}
                          className="block h-3.5 w-full truncate text-left text-[10px] font-medium leading-none text-primary hover:underline"
                        >
                          +{hiddenCount} more
                        </button>
                      ) : null}
                    </div>
                  </div>
                  {moreDate === cell.date ? (
                    <div className={cn("absolute top-full z-30 mt-1 w-52 max-w-[70vw] rounded-md border border-zinc-200 bg-white p-1.5 shadow-lg", (parseIsoDate(cell.date)?.getDay() ?? 0) >= 5 ? "right-0" : "left-0")}>
                      <p className="px-1 pb-1 text-[10px] font-medium text-zinc-500">{cell.date}</p>
                      <div className="max-h-40 space-y-0.5 overflow-y-auto">
                        {dayTasksForCell.map((task) => (
                          <button
                            key={task.clientKey}
                            type="button"
                            onClick={() => openTask(cell.date, task.clientKey)}
                            className={cn("flex h-5 w-full min-w-0 items-center gap-1 truncate rounded px-1 text-left text-[11px] leading-none", serviceColor(task.serviceId))}
                          >
                            <span className="min-w-0 flex-1 truncate">{taskLabel(task, services)}</span>
                            <span className="max-w-[45%] shrink-0 truncate opacity-80">{staffName(staff, task.assigneeId).split(" ")[0]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div ref={editorRef} className="rounded-lg border border-zinc-200 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">Place on {selectedDate}</h3>
              <div className="flex items-center gap-2">
                <select className={cn(fieldClass, "w-56")} value={placeKey} onChange={(event) => setPlaceKey(event.target.value)}>
                  <option value="">Place an unscheduled item</option>
                  {unscheduled.map((task) => (
                    <option key={task.clientKey} value={task.clientKey}>{taskLabel(task, services)}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={!placeKey || isFridayIsoDate(selectedDate)}
                  onClick={() => placeOnDate(placeKey, selectedDate)}
                >
                  Add to this date
                </Button>
              </div>
            </div>
            {selectedDate < todayParts.date ? (
              <p className="mt-2 text-xs text-zinc-600">Past date — new tasks save as completed.</p>
            ) : null}
            {isFridayIsoDate(selectedDate) ? (
              <p className="mt-2 text-xs text-amber-700">{FRIDAY_NON_WORKING_DAY_MESSAGE}</p>
            ) : null}
            {focusKey ? (
              <div className="mt-3 space-y-3">
                {tasks.filter((task) => task.clientKey === focusKey).map((task) => (
                  <TaskEditor
                    services={services}
                    key={task.clientKey}
                    task={task}
                    staff={staff}
                    highlighted
                    warnings={warnings.get(task.clientKey) ?? []}
                    minDate=""
                    minStartTime=""
                    onChange={(patch) => {
                      if (patch.scheduledDate) {
                        applyScheduledDate(task.clientKey, patch.scheduledDate);
                        const { scheduledDate: _omit, ...rest } = patch;
                        if (Object.keys(rest).length) patchTask(task.clientKey, rest);
                        return;
                      }
                      patchTask(task.clientKey, patch);
                    }}
                    onClear={() => {
                      patchTask(task.clientKey, { scheduledDate: "" });
                      setFocusKey("");
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <select className={fieldClass} value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)}>
              <option value="">All services</option>
              {services.map((service) => <option key={service.serviceId} value={service.serviceId}>{service.serviceName}</option>)}
            </select>
            <select className={fieldClass} value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)}>
              <option value="">All employees</option>
              {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead>
                <tr className="text-left text-xs text-zinc-500">
                  <th className="py-2"><button type="button" onClick={() => toggleSort("date")}>Scheduled date</button></th>
                  <th><button type="button" onClick={() => toggleSort("task")}>Task</button></th>
                  <th><button type="button" onClick={() => toggleSort("service")}>Main service</button></th>
                  <th>Sub service</th>
                  <th><button type="button" onClick={() => toggleSort("employee")}>Employee</button></th>
                  <th>Start time</th>
                  <th>End time</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((task) => (
                  <tr key={task.clientKey} className="border-t border-zinc-100 align-top">
                    <td className="py-2 pr-2">
                      <input
                        type="date"
                        className={fieldClass}
                        value={task.scheduledDate}
                        onChange={(event) => applyScheduledDate(task.clientKey, event.target.value)}
                      />
                    </td>
                    <td className="pr-2">
                      <div>{taskLabel(task, services)}</div>
                      <input className={cn(fieldClass, "mt-1")} placeholder="Notes" value={task.notes} onChange={(event) => patchTask(task.clientKey, { notes: event.target.value })} />
                      {(warnings.get(task.clientKey) ?? []).map((warning) => (
                        <p
                          key={warning}
                          className={cn(
                            "text-xs",
                            warning === PAST_SCHEDULE_MESSAGE || warning === FRIDAY_NON_WORKING_DAY_MESSAGE
                              ? "text-red-600"
                              : "text-amber-600",
                          )}
                        >
                          {warning}
                        </p>
                      ))}
                    </td>
                    <td className="pr-2">{task.serviceName}</td>
                    <td className="pr-2">{task.subServiceName}</td>
                    <td className="pr-2">
                      <select className={fieldClass} value={task.assigneeId} onChange={(event) => patchTask(task.clientKey, { assigneeId: event.target.value })}>
                        <option value="">Unassigned</option>
                        {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
                      </select>
                    </td>
                    <td className="pr-2"><input type="time" className={fieldClass} value={task.startTime} onChange={(event) => patchTask(task.clientKey, { startTime: event.target.value })} /></td>
                    <td className="pr-2"><input type="time" className={fieldClass} value={task.endTime} onChange={(event) => patchTask(task.clientKey, { endTime: event.target.value })} /></td>
                    <td>
                      <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={() => patchTask(task.clientKey, { scheduledDate: "" })}>Clear date</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function taskLabel(task: DraftTask, services: DraftService[]) {
  const sub = services.flatMap((service) => service.subServices).find((item) => item.clientKey === task.subServiceKey);
  const label = sub?.name.trim();
  if (!label) return task.name;
  const number = (/(\d+)\s*$/.exec(task.name)?.[1] ?? "1").padStart(2, "0");
  return `${task.isExtra ? "Extra " : ""}${label} ${number}`;
}

function TaskEditor({
  task,
  services,
  staff,
  warnings,
  highlighted = false,
  minDate,
  minStartTime,
  onChange,
  onClear,
}: {
  task: DraftTask;
  services: DraftService[];
  staff: Staff[];
  warnings: string[];
  highlighted?: boolean;
  minDate?: string;
  minStartTime: string;
  onChange: (patch: Partial<DraftTask>) => void;
  onClear: () => void;
}) {
  return (
    <div data-task-key={task.clientKey} className={cn("rounded-md border border-zinc-100 p-2", highlighted && "border-primary ring-1 ring-primary")}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{taskLabel(task, services)}</p>
          <p className="text-xs text-zinc-500">{task.serviceName} · {task.subServiceName}</p>
        </div>
        <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={onClear}>Remove from this date</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <select className={fieldClass} value={task.assigneeId} onChange={(event) => onChange({ assigneeId: event.target.value })}>
          <option value="">Unassigned</option>
          {staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
        </select>
        <label className="text-xs text-zinc-500">Start time
          <input type="time" min={minStartTime || undefined} className={fieldClass} value={task.startTime} onChange={(event) => onChange({ startTime: event.target.value })} />
        </label>
        <label className="text-xs text-zinc-500">End time
          <input type="time" className={fieldClass} value={task.endTime} onChange={(event) => onChange({ endTime: event.target.value })} />
        </label>
      </div>
      <label className="mt-2 block text-xs text-zinc-500">Scheduled date
        <input
          className={fieldClass}
          type="date"
          min={minDate || undefined}
          value={task.scheduledDate}
          onChange={(event) => {
            const next = event.target.value;
            if (isFridayIsoDate(next)) {
              toast.error(FRIDAY_NON_WORKING_DAY_MESSAGE);
              return;
            }
            onChange({ scheduledDate: next });
          }}
        />
      </label>
      <input className={cn(fieldClass, "mt-2")} placeholder="Schedule notes" value={task.notes} onChange={(event) => onChange({ notes: event.target.value })} />
      {warnings.map((warning) => (
        <p
          key={warning}
          className={cn(
            "mt-1 text-xs",
            warning === PAST_SCHEDULE_MESSAGE || warning === FRIDAY_NON_WORKING_DAY_MESSAGE
              ? "text-red-600"
              : warning === FRIDAY_LEGACY_SCHEDULE_WARNING
                ? "text-amber-700"
                : "text-amber-600",
          )}
        >
          {warning}
        </p>
      ))}
    </div>
  );
}
