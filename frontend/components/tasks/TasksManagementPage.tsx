"use client";

import DeleteAction from "@/components/Shared/DeleteAction";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
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
  dashboardTextSecondary,
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { Task } from "@/lib/types";
import { cn, formatTaskDeadline, formatTexts, resolveTaskDisplayStatus } from "@/lib/utils";
import { Edit, Eye, Plus, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

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

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: tasksRes, isLoading } = useSWR(
    SWR_CACH_KEYS.tasks.key,
    getAllTasksClient,
  );
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

  const deleteDescription = formatTexts({
    type: "tasks",
    formatType: "description",
  });
  const deleteDialogTitle = formatTexts({
    type: "tasks",
    formatType: "diaglog",
  });

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
    <ManagementPageShell title="Tasks management">
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
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    No
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
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isTasksLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(7)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedTasks.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTasks.map((task) => {
                    const serviceInfo =
                      task.serviceInformation ||
                      task.institutions?.[0]?.institution ||
                      "—";
                    const displayStatus = resolveTaskDisplayStatus(task);

                    return (
                      <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(task.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>
                            {task.assignedTo?.name || "Unassigned"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{serviceInfo}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {task.progress ?? 0}%
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {formatTaskDeadline(task.deadline, {
                              status: task.status,
                              progress: task.progress,
                            })}
                          </span>
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
                              onClick={() => openViewModal(task)}
                              className={actionBtnView}
                            >
                              <Eye className="size-4" />
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
                              <DeleteAction
                                typeOfDataToDelete="tasks"
                                idToDelete={String(task.id)}
                                description={deleteDescription ?? ""}
                                dialogTitle={deleteDialogTitle ?? "Delete Task"}
                                triggerClassNames={actionBtnDelete}
                                trigger={<Trash2 className="size-4" />}
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
