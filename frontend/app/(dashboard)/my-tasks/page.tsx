"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import MyTaskQuickEditModal from "@/components/tasks/MyTaskQuickEditModal";
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
import { SWR_CACH_KEYS } from "@/lib/constants";
import { normalizeMyTasksList } from "@/lib/my-task-filters";
import { fetchMyTasks } from "@/lib/my-tasks-client";
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
import { Gauge, Eye, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export default function MyTasksPage() {
  const { data: tasksRaw, isLoading } = useSWR(
    SWR_CACH_KEYS.myTasksList.key,
    fetchMyTasks,
    {
      fallbackData: [],
      revalidateOnMount: true,
      revalidateOnFocus: false,
      dedupingInterval: 0,
    },
  );

  const [mounted, setMounted] = useState(false);

  const tasks = normalizeMyTasksList(tasksRaw);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [processTarget, setProcessTarget] = useState<Task | null>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

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

  return (
    <ManagementPageShell title="My tasks">
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
              <option value="pending">Pending</option>
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
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
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
                          <span className={dashboardTextSecondary}>
                            {task.description ||
                              task.serviceInformation ||
                              "N/A"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>
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
                              className={actionBtnView}
                              title="View"
                              onClick={() => {
                                setSelectedTask(task);
                                setViewOpen(true);
                              }}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Update progress"
                              onClick={() => setProcessTarget(task)}
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

      <MyTaskQuickEditModal
        open={Boolean(processTarget)}
        onOpenChange={(open) => {
          if (!open) setProcessTarget(null);
        }}
        task={processTarget}
      />
    </ManagementPageShell>
  );
}
