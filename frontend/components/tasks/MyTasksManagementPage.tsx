"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ProcessTaskConfirmModal from "@/components/tasks/ProcessTaskConfirmModal";
import TaskViewModal from "@/components/tasks/TaskViewModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { editTask } from "@/lib/apis/taskApi";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { isBoardOnlyTask, normalizeMyTasksList } from "@/lib/my-task-filters";
import { fetchMyCompanyTasks } from "@/lib/apis/myTasksApi";
import {
  actionBtnView,
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
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { cn, formatTaskDeadline, resolveTaskDisplayStatus } from "@/lib/utils";
import { CalendarDays, Gauge, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR from "swr";
import { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

function taskDeadlineDate(task: Task) {
  const base = task.status === "completed" && task.completedAt ? new Date(task.completedAt) : new Date(task.deadline);
  const extra = task.status === "completed" ? 0 : Number(task.extraTimeMinutes ?? 0);
  const date = new Date(base.getTime() + Math.max(0, extra) * 60000);
  return Number.isNaN(date.getTime()) ? "No due date" : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

import { useLiveTimer } from "@/hooks/useLiveTimer";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export default function MyTasksManagementPage() {
  // Live timer tick every 1 second keeps countdown and overdue timers live
  useLiveTimer(1000);

  const { data: tasksRaw, isLoading, mutate: mutateMyTasks } = useSWR(
    SWR_CACH_KEYS.myTasksList.key,
    fetchMyCompanyTasks,
    {
      fallbackData: [],
      revalidateOnMount: true,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      refreshInterval: 2500,
      dedupingInterval: 1000,
    },
  );
  const { mutate } = useSWRConfig();

  useEffect(() => {
    function onTaskUpdated() {
      void mutateMyTasks();
    }
    window.addEventListener("task-updated", onTaskUpdated);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "deero-task-updated") void mutateMyTasks();
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("task-updated", onTaskUpdated);
      window.removeEventListener("storage", storageHandler);
    };
  }, [mutateMyTasks]);

  const [mounted, setMounted] = useState(false);

  const tasks = normalizeMyTasksList(tasksRaw).filter((task) => !isBoardOnlyTask(task));
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [processTarget, setProcessTarget] = useState<Task | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [updatingTaskId, setUpdatingTaskId] = useState<string | null>(null);

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const query = search.toLowerCase();
      const serviceInfo = (
        task.serviceInformation ??
        task.institutions?.[0]?.institution ??
        ""
      ).toLowerCase();
      const description = task.description?.toLowerCase() ?? "";
      const taskId = String(task.id ?? "").toLowerCase();

      const matchesSearch =
        !query ||
        serviceInfo.includes(query) ||
        description.includes(query) ||
        taskId.includes(query);

      const displayStatus = resolveTaskDisplayStatus(task);
      const matchesStatus =
        statusFilter === "all" ||
        displayStatus.toLowerCase() === statusFilter.toLowerCase();

      return matchesSearch && matchesStatus;
    });
  }, [tasks, search, statusFilter]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  const showLoading = !mounted || isLoading;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, statusFilter]);

  function openProcessDialog(task: Task) {
    setProcessTarget(task);
  }

  async function confirmProcessTask(nextProgress: number, notes: string) {
    if (!processTarget) return;
    const progress = Math.min(100, Math.max(0, Number(nextProgress)));
    const isCompleted = progress >= 100;

    setUpdatingTaskId(String(processTarget.id));
    try {
      const result = await editTask({
        taskId: processTarget.id,
        status: isCompleted ? "completed" : "pending",
        progress,
        notes: notes.trim() || undefined,
      });
      if (result.success) {
        toast.success(
          notes.trim() && !isCompleted
            ? "Message sent successfully"
            : isCompleted
            ? "Task completed successfully"
            : "Message sent successfully",
        );
        await mutate(SWR_CACH_KEYS.myTasks.key);
        await mutate(SWR_CACH_KEYS.myTasksList.key);
        await mutate(SWR_CACH_KEYS.myTasksToday.key);
        await mutate(SWR_CACH_KEYS.myTasksBoard.key);
        await mutate(SWR_CACH_KEYS.tasks.key);
        await mutate(
          (key) =>
            (typeof key === "string" && (key.includes("dashboard") || key.includes("task"))) ||
            (Array.isArray(key) && (String(key[0]).includes("dashboard") || String(key[0]).includes("task"))),
          undefined,
          { revalidate: true },
        );
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("task-updated"));
          localStorage.setItem("deero-task-updated", String(Date.now()));
        }
        setProcessTarget(null);
      } else {
        toast.error(result.errors?.message ?? "Failed to update task");
      }
    } finally {
      setUpdatingTaskId(null);
    }
  }
  return (
    <ManagementPageShell title="My tasks" subtitle="Track and manage all tasks assigned to you." className={cn("transition-[padding] duration-200", processTarget && "lg:pr-[470px]")}>
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
              <option value={100}>100</option>
            </select>
          </div>

          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("w-32 px-2", compactSelectClass)}
            >
              <option value="all">All Status</option>
              <option value="pending">Processing</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>
          {/* <Link href={ROUTES.createTask} className="flex h-9 items-center gap-2 rounded-md bg-[#651210] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#7d1915]"><Plus className="size-4" />Create Task</Link> */}
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full table-fixed [&_th]:px-3 [&_td]:px-3 [&_th:nth-child(1)]:w-[11%] [&_th:nth-child(2)]:w-[31%] [&_th:nth-child(3)]:w-[17%] [&_th:nth-child(4)]:w-[20%] [&_th:nth-child(5)]:w-[12%] [&_th:nth-child(6)]:w-[9%]">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-left")}
                  >
                    No
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-left")}
                  >
                    Task
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-left")}
                  >
                    Progress
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-left")}
                  >
                    Deadline
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-right")}
                  >
                    Status
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-right")}
                  >
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {showLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground px-6 py-10 text-center"
                    >
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTasks.map((task) => {
                    const displayStatus = resolveTaskDisplayStatus(task);
                    const busy = updatingTaskId === String(task.id);

                    return (
                      <TableRow
                        key={task.id}
                        className={dashboardTableBodyRowClass}
                      >
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(task.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardTextSecondary, "block min-w-0 truncate")}>
                            {task.serviceInformation || task.description || "N/A"}
                            <small className="mt-1 block text-[11px] text-zinc-400">Client: {task.institutions?.[0]?.institution || "Internal"}</small>
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={cn(dashboardTextPrimary, "whitespace-nowrap")}>
                            <span className="inline-block w-9">{task.progress ?? 0}%</span>
                            <span className="ml-2 inline-block h-1.5 w-24 overflow-hidden rounded-full bg-zinc-100 align-middle"><span className="block h-full rounded-full bg-[#7b1512]" style={{ width: Math.min(100, Number(task.progress ?? 0)) + "%" }} /></span>
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <CalendarDays
                              className={cn(
                                "size-4 shrink-0",
                                displayStatus === "overdue"
                                  ? "text-rose-500"
                                  : displayStatus === "in_progress"
                                    ? "text-orange-500"
                                    : "text-emerald-500",
                              )}
                            />
                            <div className="min-w-0 leading-tight">
                              <span
                                className={cn(
                                  "block truncate text-[11px] font-semibold",
                                  displayStatus === "overdue"
                                    ? "text-rose-600"
                                    : displayStatus === "in_progress"
                                      ? "text-orange-500"
                                      : "text-zinc-700",
                                )}
                              >
                                {displayStatus === "completed"
                                  ? "Completed"
                                  : formatTaskDeadline(task.deadline, {
                                      status: task.status,
                                      progress: task.progress,
                                      startDate: task.startDate,
                                      extraTimeMinutes: task.extraTimeMinutes,
                                    })}
                              </span>
                              <span
                                className={cn(
                                  "mt-0.5 block text-[10px]",
                                  displayStatus === "overdue"
                                    ? "font-semibold text-rose-500"
                                    : "text-zinc-500",
                                )}
                              >
                                {taskDeadlineDate(task)}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell
                          className={cn(dashboardTableCellClass, "text-right")}
                        >
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              getTaskStatusBadgeClass(displayStatus),
                            )}
                          >
                            {formatStatusLabel(displayStatus)}
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(dashboardTableCellClass, "text-right")}
                        >
                          <div className="flex justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(actionBtnView, "relative")}
                              title={
                                task.progressNotes && task.progressNotes.length > 0
                                  ? `${task.progressNotes.length} message(s) on this task`
                                  : "View"
                              }
                              onClick={() => {
                                setSelectedTask(task);
                                setViewOpen(true);
                              }}
                            >
                              <Eye className="size-4" />
                              {task.progressNotes && task.progressNotes.length > 0 ? (
                                <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white ring-2 ring-white shadow-xs">
                                  {task.progressNotes.length > 9 ? "9+" : task.progressNotes.length}
                                </span>
                              ) : null}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Update progress"
                              disabled={busy}
                              onClick={() => openProcessDialog(task)}
                              className={actionBtnView}
                            >
                              <Gauge className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filteredTasks.length === 0
              ? "0 of 0"
              : `${Math.min(filteredTasks.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filteredTasks.length, currentPage * pageSize)} of ${filteredTasks.length}`}
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || totalPages === 0}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <TaskViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        task={selectedTask}
      />

      <ProcessTaskConfirmModal
        open={Boolean(processTarget)}
        onOpenChange={(open) => {
          if (!open) setProcessTarget(null);
        }}
        task={processTarget}
        loading={Boolean(
          processTarget && updatingTaskId === String(processTarget.id),
        )}
        onConfirm={confirmProcessTask}
      />
    </ManagementPageShell>
  );
}
