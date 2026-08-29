"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PersonalTaskCreateDialog from "@/components/tasks/PersonalTaskCreateDialog";
import MyTasksBoardOwnTable from "@/components/tasks/MyTasksBoardOwnTable";
import MyTasksBoardTimeline from "@/components/tasks/MyTasksBoardTimeline";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchMyTasks, patchMyTask } from "@/lib/apis/myTasksApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  dashboardCardClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { taskTitle } from "@/lib/my-task-filters";
import { Task } from "@/lib/types";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import { AlertTriangle, CalendarDays, CheckCircle2, Circle, Clock3, LayoutGrid, Plus, Search, Table2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

type BoardLane = "todo" | "overdue" | "completed";

const LANES: Array<{
  id: BoardLane;
  label: string;
  dot: string;
  empty: string;
}> = [
  { id: "todo", label: "To Do List", dot: "bg-violet-500", empty: "No tasks to do" },
  { id: "overdue", label: "Overdue", dot: "bg-red-500", empty: "No overdue tasks" },
  { id: "completed", label: "Complete", dot: "bg-emerald-500", empty: "No completed tasks" },
];

function boardLane(task: Task): BoardLane {
  const status = resolveTaskDisplayStatus(task);
  if (status === "completed" || Number(task.progress ?? 0) >= 100) return "completed";
  if (status === "overdue") return "overdue";
  return "todo";
}

function dateLabel(value?: string | Date | null) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyTasksBoardPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data: remoteTasks, error: tasksError, isLoading, mutate } = useSWR(
    SWR_CACH_KEYS.myTasksBoard.key,
    fetchMyTasks,
    {
      fallbackData: [],
      revalidateOnMount: true,
      revalidateOnFocus: false,
    },
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"board" | "table" | "calendar">("board");
  const [createOpen, setCreateOpen] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    setTasks((remoteTasks ?? []).filter((task) => task.isPersonal));
  }, [remoteTasks]);

  const visibleTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return tasks;
    return tasks.filter((task) =>
      [task.id, taskTitle(task), task.description, task.priority]
        .some((value) => String(value ?? "").toLowerCase().includes(query)),
    );
  }, [tasks, search]);

  const laneTasks = useMemo(() => ({
    todo: visibleTasks.filter((task) => boardLane(task) === "todo"),
    overdue: visibleTasks.filter((task) => boardLane(task) === "overdue"),
    completed: visibleTasks.filter((task) => boardLane(task) === "completed"),
  }), [visibleTasks]);

  const historyTasks = useMemo(() => [...visibleTasks].sort((a, b) => {
    const aTime = new Date(a.updatedAt ?? a.createdAt ?? 0).getTime();
    const bTime = new Date(b.updatedAt ?? b.createdAt ?? 0).getTime();
    return bTime - aTime;
  }), [visibleTasks]);

  async function toggleCompleted(task: Task) {
    const id = String(task.id);
    const wasCompleted = boardLane(task) === "completed";
    const nextStatus = wasCompleted ? "pending" : "completed";
    const nextProgress = wasCompleted ? 0 : 100;
    const snapshot = tasks;
    const nextTasks = tasks.map((item) =>
      String(item.id) === id
        ? { ...item, status: nextStatus as Task["status"], progress: nextProgress }
        : item,
    );

    setUpdatingId(id);
    setTasks(nextTasks);
    try {
      await patchMyTask(id, { status: nextStatus, progress: nextProgress });
      await mutate();
      void globalMutate(SWR_CACH_KEYS.myTasksList.key);
      void globalMutate(SWR_CACH_KEYS.myTasksToday.key);
      toast.success(wasCompleted ? "Task returned to To Do" : "Task completed");
    } catch {
      setTasks(snapshot);
      toast.error("Failed to update task");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <ManagementPageShell title="My board">
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1">
            {[
              { id: "board", label: "Board", icon: LayoutGrid },
              { id: "table", label: "Table", icon: Table2 },
              { id: "calendar", label: "Calendar", icon: CalendarDays },
            ].map((item) => {
              const Icon = item.icon;
              return <button key={item.id} type="button" onClick={() => setView(item.id as "board" | "table" | "calendar")} className={cn("inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium", view === item.id ? "bg-white text-slate-900 shadow-sm" : "text-zinc-500 hover:text-zinc-800")}><Icon className="size-4" />{item.label}</button>;
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search tasks..." className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary" />
            </div>
            <Button type="button" onClick={() => setCreateOpen(true)} className="h-10"><Plus className="mr-2 size-4" />New Task</Button>
          </div>
        </div>
        {view === "board" && <p className="text-sm text-zinc-500">Personal board tasks stay here and do not appear in My Tasks or Today.</p>}
        {tasksError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            Could not load your board tasks. Please refresh or sign in again.
          </div>
        ) : null}
      </div>

      {view === "board" ? <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {LANES.map((lane) => {
          const items = laneTasks[lane.id];
          return (
            <section key={lane.id} className="min-w-0">
              <div className="mb-2 flex items-center gap-2 px-1">
                <span className={cn("size-2.5 rounded-full", lane.dot)} />
                <h2 className="text-sm font-semibold text-zinc-800">{lane.label}</h2>
                <span className="text-sm text-zinc-400">{items.length}</span>
              </div>
              <div className="min-h-[360px] space-y-2 rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
                {isLoading && tasks.length === 0 ? (
                  [...Array(3)].map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-zinc-100" />)
                ) : items.length === 0 ? (
                  <div className="flex min-h-[330px] items-center justify-center rounded-lg border border-dashed border-zinc-200 px-4 text-center text-sm text-zinc-400">{lane.empty}</div>
                ) : items.map((task) => {
                  const completed = lane.id === "completed";
                  const disabled = updatingId === String(task.id);
                  return (
                    <article key={task.id} className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm">
                      <div className="flex items-start gap-3">
                        <button type="button" disabled={disabled} onClick={() => void toggleCompleted(task)} aria-label={completed ? "Mark task incomplete" : "Mark task complete"} className={cn("mt-0.5 shrink-0 rounded-full disabled:opacity-50", completed ? "text-emerald-600" : lane.id === "overdue" ? "text-red-500" : "text-zinc-400 hover:text-primary")}>
                          {completed ? <CheckCircle2 className="size-5" /> : <Circle className="size-5" />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className={cn("text-sm font-semibold leading-5 text-zinc-800", completed && "text-zinc-500 line-through")}>{taskTitle(task)}</p>
                          <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500">{task.description}</p>
                          <div className="mt-2 flex items-center gap-1.5 text-[11px] text-zinc-400">
                            {lane.id === "overdue" ? <AlertTriangle className="size-3.5 text-red-500" /> : <Clock3 className="size-3.5" />}
                            <span>{dateLabel(task.deadline)}</span>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <section className={cn(dashboardCardClass, "mt-6 overflow-hidden p-0")}>
        <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
          <div><h2 className="font-bold text-slate-900">Task History</h2><p className="mt-1 text-xs text-zinc-500">All personal board tasks and their latest state.</p></div>
          <span className="text-sm text-zinc-400">{historyTasks.length} tasks</span>
        </div>
        <div className={cn(dashboardTableWrapClass, "border-0")}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Task</TableHead>
                <TableHead className={dashboardTableHeadClass}>Priority</TableHead>
                <TableHead className={dashboardTableHeadClass}>Due Date</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={dashboardTableHeadClass}>Completed</TableHead>
                <TableHead className={dashboardTableHeadClass}>Last Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyTasks.length ? historyTasks.map((task) => {
                const status = resolveTaskDisplayStatus(task);
                return (
                  <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}><span className="font-semibold text-slate-800">{taskTitle(task)}</span><span className="mt-1 block text-xs text-zinc-400">#{task.id}</span></TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "capitalize")}>{task.priority ?? "Normal"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{dateLabel(task.deadline)}</TableCell>
                    <TableCell className={dashboardTableCellClass}><span className={cn("inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize", getTaskStatusBadgeClass(status))}>{status === "pending" ? "To Do" : status}</span></TableCell>
                    <TableCell className={dashboardTableCellClass}>{task.completedAt ? dateLabel(task.completedAt) : "â€”"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{dateLabel(task.updatedAt ?? task.createdAt)}</TableCell>
                  </TableRow>
                );
              }) : <TableRow><TableCell colSpan={6} className="py-12 text-center text-zinc-500">No task history found</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      </section>

      </> : view === "table" ? (
        <div className={dashboardCardClass}><MyTasksBoardOwnTable tasks={visibleTasks} isLoading={isLoading} /></div>
      ) : (
        <div className={dashboardCardClass}><MyTasksBoardTimeline tasks={visibleTasks} assignableTasks={tasks} /></div>
      )}

      <PersonalTaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ManagementPageShell>
  );
}

