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
import { getAllProjects } from "@/lib/apis/projectApi";
import { getAllServices } from "@/lib/apis/serviceApi";
import {
  getAllClientsClient,
  getManagementTasksClient,
  type ManagementTaskFilters,
  getAllUsersClient,
} from "@/lib/apis/readApi";
import { ROUTES } from "@/lib/constants";
import { TASK_STATUS_FILTER_OPTIONS } from "@/lib/task-status";
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
import { useNow } from "@/lib/use-now";
import { cn, formatScheduledTask, formatTaskDeadline, getTaskTableLabels, isTaskNotesUnseen, resolveTaskDisplayStatus } from "@/lib/utils";
import { CalendarDays, Download, Edit, Eye, Plus, Search, X } from "lucide-react";
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

function managementTaskDisplayStatus(task: Task, now: number) {
  return task.displayStatus || resolveTaskDisplayStatus(task, undefined, now);
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
  const now = useNow();
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    function onSeen() { setSeenTick((t) => t + 1); }
    window.addEventListener("task-notes-seen-updated", onSeen);
    return () => window.removeEventListener("task-notes-seen-updated", onSeen);
  }, []);

  const managementFilters = useMemo<ManagementTaskFilters>(
    () => ({
      status: statusFilter,
      taskType: taskTypeFilter,
      clientId: clientFilter,
      projectId: projectFilter,
      serviceId: serviceFilter,
      employeeId: userFilter,
      scheduledFrom: dateFrom || undefined,
      scheduledTo: dateTo || undefined,
      search: debouncedSearch || undefined,
    }),
    [
      statusFilter,
      taskTypeFilter,
      clientFilter,
      projectFilter,
      serviceFilter,
      userFilter,
      dateFrom,
      dateTo,
      debouncedSearch,
    ],
  );

  const { data: tasksRes, isLoading, mutate: mutateTasks } = useSWR(
    ["tasks-management", managementFilters],
    () => getManagementTasksClient(managementFilters),
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

  const { data: usersRes } = useSWR("tasks-users-filter", getAllUsersClient);
  const { data: clientsRes } = useSWR("tasks-clients-filter", getAllClientsClient);
  const { data: projectsRes } = useSWR("tasks-projects-filter", () => getAllProjects());
  const { data: servicesRes } = useSWR("tasks-services-filter", () => getAllServices());

  const tasks = (tasksRes?.data as Task[]) ?? [];
  const users = usersRes?.data ?? [];
  const clients = clientsRes?.data ?? [];
  const projects = projectsRes?.data ?? [];
  const services = servicesRes?.data ?? [];

  const projectOptions = useMemo(() => {
    if (clientFilter === "all") return projects;
    return projects.filter((project) => String(project.clientId) === clientFilter);
  }, [projects, clientFilter]);

  const isTasksLoading = !mounted || isLoading;
  const filteredTasks = tasks;

  const totalPages = Math.ceil(filteredTasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    pageSize,
    statusFilter,
    taskTypeFilter,
    clientFilter,
    projectFilter,
    serviceFilter,
    userFilter,
    dateFrom,
    dateTo,
  ]);

  function clearFilters() {
    setSearchInput("");
    setDebouncedSearch("");
    setStatusFilter("all");
    setTaskTypeFilter("all");
    setClientFilter("all");
    setProjectFilter("all");
    setServiceFilter("all");
    setUserFilter("all");
    setDateFrom("");
    setDateTo("");
    setCurrentPage(1);
  }

  function taskTypeLabel(task: Task) {
    return task.projectId || (task as any).taskType === "project" ? "Project Task" : "Standalone Task";
  }

  function taskProjectName(task: Task) {
    const project = (task as any).project;
    if (task.projectId || project) return project?.name || "—";
    return "N/A";
  }

  function taskClientName(task: Task) {
    const projectClient = (task as any).project?.client?.institution;
    if (projectClient) return projectClient;
    return getTaskTableLabels(task).clientName;
  }

  function downloadFilteredReport() {
    const header = [
      "Task ID",
      "Task Name",
      "Task Type",
      "Client",
      "Project",
      "Employee",
      "Service",
      "Progress",
      "Scheduled Date",
      "Start - End",
      "Status",
    ];
    const rows = filteredTasks.map((task) => {
      const { taskName, serviceName } = getTaskTableLabels(task);
      const displayStatus = managementTaskDisplayStatus(task, now);
      const schedule = formatScheduledTask(task);
      return [
        task.id,
        taskName,
        taskTypeLabel(task),
        taskClientName(task),
        taskProjectName(task),
        task.assignedTo?.name || "Unassigned",
        serviceName,
        `${task.progress ?? 0}%`,
        schedule?.date ||
          (task.startDate
            ? new Date(String(task.startDate)).toISOString().slice(0, 10)
            : "—"),
        schedule?.time || "—",
        formatStatusLabel(displayStatus),
      ];
    });
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `tasks-management-report-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }


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
        <div className="space-y-2 border-b border-zinc-50 px-4 py-3">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
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

            <div className="group relative w-full sm:w-52">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className={compactInputClass}
              />
            </div>

            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex h-9 items-center gap-1 rounded-md border border-zinc-200 px-3 text-xs font-semibold text-zinc-600 hover:bg-zinc-50"
            >
              <X className="size-3.5" />
              Clear filters
            </button>

            {filteredTasks.length > 0 && (
              <button
                type="button"
                onClick={downloadFilteredReport}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
              >
                <Download className="size-3.5" />
                Download report
              </button>
            )}

            {userFilter !== "all" && (
              <Link
                href={ROUTES.taskReport(userFilter)}
                className="text-xs font-semibold text-emerald-600 hover:underline"
              >
                Employee PDF report
              </Link>
            )}

            <div className="min-w-4 flex-1" />

            <Button
              type="button"
              onClick={openCreateModal}
              className={cn(btnCreatePage, "h-9 w-full sm:w-auto px-4 text-sm")}
            >
              <Plus className="size-4" />
              Create Task
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <select
              aria-label="Status filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={cn("min-w-[9.5rem]", compactSelectClass)}
            >
              {TASK_STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label="Task type filter"
              value={taskTypeFilter}
              onChange={(e) => setTaskTypeFilter(e.target.value)}
              className={cn("min-w-[9.5rem]", compactSelectClass)}
            >
              <option value="all">All Types</option>
              <option value="project">Project Task</option>
              <option value="standalone">Standalone Task</option>
            </select>

            <select
              aria-label="Client filter"
              value={clientFilter}
              onChange={(e) => {
                setClientFilter(e.target.value);
                setProjectFilter("all");
              }}
              className={cn("min-w-[11rem] max-w-[14rem]", compactSelectClass)}
            >
              <option value="all">All Clients</option>
              {clients.map((client) => (
                <option key={client.id} value={String(client.id)}>
                  {client.institution}
                </option>
              ))}
            </select>

            <select
              aria-label="Project filter"
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className={cn("min-w-[11rem] max-w-[14rem]", compactSelectClass)}
            >
              <option value="all">All Projects</option>
              {projectOptions.map((project) => (
                <option key={project.id} value={String(project.id)}>
                  {project.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Service filter"
              value={serviceFilter}
              onChange={(e) => setServiceFilter(e.target.value)}
              className={cn("min-w-[10rem] max-w-[14rem]", compactSelectClass)}
            >
              <option value="all">All Services</option>
              {services.map((service) => (
                <option key={service.id} value={String(service.id)}>
                  {service.serviceName}
                </option>
              ))}
            </select>

            <select
              aria-label="Employee filter"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className={cn("min-w-[10rem] max-w-[14rem]", compactSelectClass)}
            >
              <option value="all">All Employees</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name}
                </option>
              ))}
            </select>

            <input
              aria-label="Scheduled date from"
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className={cn("w-[9.5rem]", compactSelectClass)}
            />
            <input
              aria-label="Scheduled date to"
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className={cn("w-[9.5rem]", compactSelectClass)}
            />
          </div>
        </div>

        <div className={dashboardTableWrapClass}>
          <Table className="w-full min-w-[1500px] table-fixed [&_td]:px-3.5 [&_th]:px-3.5">
            <colgroup>
              <col className="w-[82px]" />
              <col className="w-[200px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[170px]" />
              <col className="w-[160px]" />
              <col className="w-[110px]" />
              <col className="w-[150px]" />
              <col className="w-[105px]" />
              <col className="w-[108px]" />
            </colgroup>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task ID</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task Name</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Task Type</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Client</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Project</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Assigned Employee</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Service</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Progress</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Scheduled Date</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-center")}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-center")}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isTasksLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i} className="h-14 animate-pulse">
                    {[...Array(11)].map((_, j) => (
                      <TableCell key={j} className="px-6 py-4">
                        <div className="h-4 w-full rounded bg-zinc-100" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : paginatedTasks.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={11}
                    className="px-6 py-10 text-center text-muted-foreground"
                  >
                    No tasks found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTasks.map((task) => {
                  const { taskName, serviceName } = getTaskTableLabels(task);
                  const clientName = taskClientName(task);
                  const displayStatus = managementTaskDisplayStatus(task, now);
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
                      <TableCell className={cn(dashboardTableCellClass, "font-mono")}>
                        <span className={dashboardTableIdClass}>
                          {String(task.id ?? "").slice(0, 8).toUpperCase()}
                        </span>
                      </TableCell>

                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(dashboardTextPrimary, "font-medium leading-snug line-clamp-2")}
                          title={taskName}
                        >
                          {taskName}
                        </span>
                      </TableCell>

                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            "inline-flex rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                            task.projectId ? "bg-sky-50 text-sky-700" : "bg-zinc-100 text-zinc-700",
                          )}
                        >
                          {taskTypeLabel(task)}
                        </span>
                      </TableCell>

                      <TableCell className={cn(dashboardTableCellClass, "truncate")} title={clientName}>
                        {clientName}
                      </TableCell>

                      <TableCell className={cn(dashboardTableCellClass, "truncate")} title={taskProjectName(task)}>
                        {taskProjectName(task)}
                      </TableCell>

                      {/* Assigned To — avatar + name + job title */}
                      <TableCell className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2.5 min-w-0">
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
                          <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span
                              className={cn(dashboardTextPrimary, "truncate text-sm font-medium")}
                              title={assignedName}
                            >
                              {assignedName}
                            </span>
                            {jobTitle && (
                              <span
                                className="truncate text-[11px] text-zinc-400"
                                title={jobTitle}
                              >
                                {jobTitle}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            "inline-flex max-w-full truncate rounded px-2 py-0.5 text-[10.5px] font-semibold",
                            getServiceBadgeClass(serviceName),
                          )}
                          title={serviceName}
                        >
                          {serviceName}
                        </span>
                      </TableCell>

                      {/* Progress */}
                      <TableCell className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-9 shrink-0 text-xs font-semibold text-zinc-700 tabular-nums">
                            {progress}%
                          </span>
                          <div className="h-2 flex-1 min-w-[50px] overflow-hidden rounded-full bg-zinc-100">
                            <div
                              className="h-full rounded-full bg-primary transition-all duration-300"
                              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* Deadline */}
                      <TableCell className={dashboardTableCellClass}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CalendarDays className={cn(
                            "size-4 shrink-0",
                            displayStatus === "overdue"
                              ? "text-rose-500"
                              : displayStatus === "in_progress"
                                ? "text-orange-500"
                                : "text-primary",
                          )} />
                          <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            {formatScheduledTask(task) ? (
                              <>
                                <span className={cn("truncate text-xs font-semibold", dashboardTextPrimary)}>{formatScheduledTask(task)?.date}</span>
                                <span className="mt-0.5 truncate text-[10px] text-zinc-500">{formatScheduledTask(task)?.time}</span>
                              </>
                            ) : (
                              <>
                            <span
                              className={cn(
                                "truncate text-xs font-semibold",
                                displayStatus === "overdue"
                                  ? "text-rose-600"
                                  : displayStatus === "in_progress"
                                    ? "text-orange-500"
                                    : dashboardTextPrimary,
                              )}
                              title={
                                displayStatus === "completed"
                                  ? "Completed"
                                  : formatTaskDeadline(task.deadline, {
                                      status: task.status,
                                      progress: task.progress,
                                      startDate: task.startDate,
                                      extraTimeMinutes: task.extraTimeMinutes,
                                    })
                              }
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
                            <span className={cn(
                              "mt-0.5 truncate text-[10px]",
                              displayStatus === "overdue"
                                ? "font-semibold text-rose-500"
                                : "text-zinc-500",
                            )}>
                              {taskDeadlineDate(task)}
                            </span>
                              </>
                            )}
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
                      <TableCell className={cn(dashboardTableCellClass, "text-center")}>
                        <div className="flex items-center justify-center gap-1.5">
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
                            title="Edit task"
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
