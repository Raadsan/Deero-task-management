"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import TaskDeleteDialog from "@/components/tasks/TaskDeleteDialog";
import TaskFormModal from "@/components/tasks/TaskFormModal";
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
import { getAllTasksClient, getAllUsersClient } from "@/lib/apis/readApi";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import { Task } from "@/lib/types";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
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
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatTaskDeadline, getTaskTableLabels, isTaskNotesUnseen, resolveTaskDisplayStatus } from "@/lib/utils";
import { CalendarDays, Edit, Eye, Plus, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

function getServiceBadgeClass(serviceName: string) {
  const value = serviceName.toLowerCase();
  if (value.includes("video") || value.includes("animation")) {
    return "bg-emerald-50 text-emerald-600";
  }
  if (value.includes("design") || value.includes("poster") || value.includes("brand")) {
    return "bg-rose-50 text-rose-600";
  }
  if (value.includes("marketing") || value.includes("social")) {
    return "bg-sky-50 text-sky-600";
  }
  return "bg-violet-50 text-violet-600";
}

function taskDeadlineDate(task: Task) {
  const baseDate = task.status === "completed" && task.completedAt
    ? new Date(task.completedAt)
    : new Date(task.deadline);
  const extraMinutes = task.status === "completed" ? 0 : Number(task.extraTimeMinutes ?? 0);
  const effectiveDate = new Date(baseDate.getTime() + Math.max(0, extraMinutes) * 60_000);

  if (Number.isNaN(effectiveDate.getTime())) return "No due date";
  return effectiveDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

import { useLiveTimer } from "@/hooks/useLiveTimer";

export default function TasksManagementPage() {
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>();
  // Tick that forces badge re-render after "seen" is stored in localStorage
  const [seenTick, setSeenTick] = useState(0);

  // Live timer tick every 1 second keeps countdown and overdue timers live
  useLiveTimer(1000);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function onSeen() { setSeenTick((t) => t + 1); }
    window.addEventListener("task-notes-seen-updated", onSeen);
    return () => window.removeEventListener("task-notes-seen-updated", onSeen);
  }, []);

  const { data: tasksRes, isLoading, mutate: mutateTasks } = useSWR(
    SWR_CACH_KEYS.tasks.key,
    getAllTasksClient,
    {
      revalidateOnFocus: true,
      revalidateOnMount: true,
      revalidateOnReconnect: true,
      refreshInterval: 2500,
      dedupingInterval: 1000,
    }
  );

  useEffect(() => {
    function onTaskUpdated() {
      void mutateTasks();
    }
    window.addEventListener("task-updated", onTaskUpdated);
    const storageHandler = (e: StorageEvent) => {
      if (e.key === "deero-task-updated") void mutateTasks();
    };
    window.addEventListener("storage", storageHandler);
    return () => {
      window.removeEventListener("task-updated", onTaskUpdated);
      window.removeEventListener("storage", storageHandler);
    };
  }, [mutateTasks]);

  const { data: usersRes } = useSWR(
    "tasks-users-filter",
    getAllUsersClient,
  );

  const tasksRaw = (tasksRes?.data as Task[]) ?? [];
  const usersRaw = usersRes?.data ?? [];
  const tasks = tasksRaw;
  const users = usersRaw;

  const isTasksLoading = !mounted || isLoading;

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const query = search.toLowerCase();
      const assignedName = task.assignedTo?.name?.toLowerCase() ?? "";
      const serviceInfo = (
        task.serviceInformation ??
        task.institutions?.[0]?.institution ??
        ""
      ).toLowerCase();
      const description = task.description?.toLowerCase() ?? "";
      const taskId = String(task.id ?? "").toLowerCase();

      const matchesSearch =
        !query ||
        assignedName.includes(query) ||
        serviceInfo.includes(query) ||
        description.includes(query) ||
        taskId.includes(query);

      const displayStatus = resolveTaskDisplayStatus(task);

      const matchesStatus =
        statusFilter === "all" ||
        displayStatus.toLowerCase() === statusFilter.toLowerCase();

      const matchesUser =
        userFilter === "all" ||
        String(task.assignedTo?.id ?? "") === userFilter;

      return matchesSearch && matchesStatus && matchesUser;
    });
  }, [tasks, search, statusFilter, userFilter]);

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize, statusFilter, userFilter]);


  function openViewModal(task: Task) {
    setViewingTask(task);
    setViewOpen(true);
  }

  function openCreateModal() {
    setFormMode("create");
    setEditingTaskId(undefined);
    setFormOpen(true);
  }

  function openEditModal(taskId: string) {
    setFormMode("edit");
    setEditingTaskId(taskId);
    setFormOpen(true);
  }

  return (
    <ManagementPageShell
      title="Tasks management"
      subtitle="Manage and track all tasks in one place."
    >
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-4 py-3">
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

          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>User</span>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className={cn("w-36 px-2", compactSelectClass)}
            >
              <option value="all">All Users</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {userFilter !== "all" && tasks.length > 0 && (
            <Link
              href={ROUTES.taskReport(userFilter)}
              className="text-xs font-semibold text-emerald-600 hover:underline"
            >
              Download report
            </Link>
          )}

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

          <Button
            type="button"
            onClick={openCreateModal}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            Create Task
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="w-full overflow-hidden">
            <Table className="w-full table-fixed [&_td]:px-3 [&_th]:px-3">
              <colgroup>
                <col className="w-[7%]" />
                <col className="w-[22%]" />
                <col className="w-[16%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
                <col className="w-[13%]" />
                <col className="w-[7%]" />
                <col className="w-[11%]" />
              </colgroup>
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    No
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Task
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Assigned To
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Service Info
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Progress
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Deadline
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-center")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-center")}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTasksLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTasks.map((task) => {
                    const { taskName, clientName, serviceName } = getTaskTableLabels(task);
                    // Display status
                    const displayStatus = resolveTaskDisplayStatus(task);
                    const progress = task.progress ?? 0;
                    // Assignee info
                    const assignedName = task.assignedTo?.name || "Unassigned";
                    const assignedImage = task.assignedTo?.image ?? null;
                    const jobTitle = task.assignedTo?.jobTitle ?? null;
                    const initials = assignedName
                      .split(" ")
                      .slice(0, 2)
                      .map((w: string) => w[0] ?? "")
                      .join("")
                      .toUpperCase();

                    return (
                      <TableRow key={task.id} className={dashboardTableBodyRowClass}>

                        {/* No */}
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(task.id ?? "").slice(0, 8).toUpperCase()}
                          </span>
                        </TableCell>

                        {/* Task */}
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex flex-col gap-0.5 max-w-[220px]">
                            <span className={cn(dashboardTextPrimary, "font-medium leading-snug line-clamp-2")}>
                              {taskName}
                            </span>
                          </div>
                        </TableCell>

                        {/* Assigned To — avatar + name + job title */}
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            {assignedImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={assignedImage}
                                alt={assignedName}
                                className="size-8 shrink-0 rounded-full object-cover ring-1 ring-zinc-200"
                              />
                            ) : (
                              <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white select-none">
                                {initials}
                              </div>
                            )}
                            <div className="flex flex-col leading-tight">
                              <span className={cn(dashboardTextPrimary, "text-sm font-medium whitespace-nowrap")}>
                                {assignedName}
                              </span>
                              {jobTitle && (
                                <span className="text-[11px] text-zinc-400">{jobTitle}</span>
                              )}
                            </div>
                          </div>
                        </TableCell>

                        {/* Service Info — client name */}
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex max-w-[190px] flex-col gap-1">
                            <span className={cn(dashboardTextPrimary, "truncate text-sm font-medium")}>
                              {clientName}
                            </span>
                            <span className={cn(
                              "w-fit max-w-full truncate rounded px-1.5 py-0.5 text-[10px] font-semibold",
                              getServiceBadgeClass(serviceName),
                            )}>
                              {serviceName}
                            </span>
                          </div>
                        </TableCell>

                        {/* Progress */}
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <span className="w-8 shrink-0 text-xs font-medium text-zinc-600">
                              {progress}%
                            </span>
                            <div className="h-1.5 flex-1 min-w-[60px] rounded-full bg-zinc-100 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-primary transition-all"
                                style={{ width: `${Math.min(100, progress)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Deadline */}
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <CalendarDays className={cn(
                              "size-4 shrink-0",
                              displayStatus === "overdue"
                                ? "text-rose-500"
                                : displayStatus === "in_progress"
                                  ? "text-orange-500"
                                  : "text-primary",
                            )} />
                            <div className="flex min-w-0 flex-col leading-tight">
                              <span className={cn(
                                "text-xs font-semibold",
                                displayStatus === "overdue"
                                  ? "text-rose-600"
                                  : displayStatus === "in_progress"
                                    ? "text-orange-500"
                                    : dashboardTextPrimary,
                              )}>
                                {displayStatus === "completed"
                                  ? "Completed"
                                  : formatTaskDeadline(task.deadline, {
                                      status: task.status,
                                      progress: task.progress,
                                      startDate: task.startDate,
                                      extraTimeMinutes: task.extraTimeMinutes,
                                    })}
                              </span>
                              <span className={cn(
                                "mt-0.5 text-[10px]",
                                displayStatus === "overdue"
                                  ? "font-semibold text-rose-500"
                                  : "text-zinc-500",
                              )}>
                                {taskDeadlineDate(task)}
                              </span>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className={cn(dashboardTableCellClass, "text-center")}>
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              getTaskStatusBadgeClass(displayStatus),
                            )}
                          >
                            {formatStatusLabel(displayStatus)}
                          </span>
                        </TableCell>

                        {/* Actions */}
                        <TableCell className={cn(dashboardTableCellClass, "pr-5 text-center")}>
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(task)}
                              className={cn(actionBtnView, "relative")}
                              title={
                                isTaskNotesUnseen(task.id, task.progressNotes?.length ?? 0)
                                  ? `${task.progressNotes!.length} unread message(s)`
                                  : "View task"
                              }
                            >
                              <Eye className="size-4" />
                              {isTaskNotesUnseen(task.id, task.progressNotes?.length ?? 0) ? (
                                <span className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-[#651210] text-[9px] font-bold text-white ring-2 ring-white shadow-xs">
                                  {(task.progressNotes?.length ?? 0) > 9 ? "9+" : task.progressNotes!.length}
                                </span>
                              ) : null}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(String(task.id))}
                              className={actionBtnEdit}
                            >
                              <Edit className="size-4" />
                            </Button>
                            {task.id && (
                              <TaskDeleteDialog
                                task={task}
                                triggerClassNames={actionBtnDelete}
                              />
                            )}
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
        task={viewingTask}
      />

      <TaskFormModal
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        taskId={editingTaskId}
      />
    </ManagementPageShell>
  );
}
