"use client";

import TaskDeleteDialog from "@/components/tasks/TaskDeleteDialog";
import MyTaskQuickEditModal from "@/components/tasks/MyTaskQuickEditModal";
import PersonalTaskEditModal from "@/components/tasks/PersonalTaskEditModal";
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
import { taskTitle } from "@/lib/my-task-filters";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  dashboardCardClass,
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
import { authClient } from "@/lib/auth-client";
import { cn, formatTaskDeadline, resolveTaskDisplayStatus } from "@/lib/utils";
import { ArrowRightLeft, Edit, Eye, Gauge, Lock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type Props = {
  tasks: Task[];
  isLoading?: boolean;
};

export default function MyTasksBoardOwnTable({ tasks, isLoading }: Props) {
  const session = authClient.useSession();
  const currentUserId = session.data?.user?.id;
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [viewOpen, setViewOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const totalPages = Math.ceil(tasks.length / pageSize) || 1;
  const paginatedTasks = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return tasks.slice(start, start + pageSize);
  }, [tasks, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [tasks.length]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  return (
    <>
      <div className={dashboardCardClass}>
        <div className={dashboardTableWrapClass}>
          <div className="w-full overflow-x-auto">
            <Table className="w-full min-w-[900px] table-fixed [&_th]:px-3.5 [&_td]:px-3.5">
              <colgroup>
                <col className="w-[80px]" />
                <col className="w-[290px]" />
                <col className="w-[190px]" />
                <col className="w-[80px]" />
                <col className="w-[125px]" />
                <col className="w-[135px]" />
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
                    Deadline
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Progress
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-center")}>
                    Status
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-center")}>
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((__, j) => (
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
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No own tasks found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTasks.map((task) => {
                    const displayStatus = resolveTaskDisplayStatus(task, currentUserId);

                    return (
                      <TableRow key={task.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(task.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{taskTitle(task)}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {formatTaskDeadline(task.deadline, {
                              status: task.status,
                              progress: task.progress,
                              startDate: task.startDate,
                            })}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <div className="flex items-center gap-2">
                            <span className="w-9 shrink-0 text-xs font-semibold tabular-nums text-zinc-700">
                              {task.progress ?? 0}%
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                              <div
                                className="h-full rounded-full bg-primary transition-all duration-300"
                                style={{ width: Math.min(100, Math.max(0, Number(task.progress ?? 0))) + "%" }}
                              />
                            </div>
                          </div>
                        </TableCell>
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
                        <TableCell className={cn(dashboardTableCellClass, "text-center")}>
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
                              className={actionBtnEdit}
                              title="Edit task details"
                              onClick={() => {
                                setSelectedTask(task);
                                setEditOpen(true);
                              }}
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className={cn(
                                actionBtnEdit,
                                (displayStatus === "overdue" || displayStatus === "transferred") && "border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700",
                              )}
                              title={
                                displayStatus === "transferred"
                                  ? "Task transferred — progress disabled"
                                  : displayStatus === "overdue"
                                    ? "Progress locked — edit the task and add extra time"
                                    : "Update progress"
                              }
                              disabled={displayStatus === "overdue" || displayStatus === "transferred"}
                              onClick={() => {
                                setSelectedTask(task);
                                setProgressOpen(true);
                              }}
                            >
                              {displayStatus === "transferred" ? <ArrowRightLeft className="size-4" /> : displayStatus === "overdue" ? <Lock className="size-4" /> : <Gauge className="size-4" />}
                            </Button>
                            {task.id ? (
                              <TaskDeleteDialog
                                task={task}
                                triggerClassNames={actionBtnDelete}
                              />
                            ) : null}
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
            {tasks.length === 0
              ? "0 of 0"
              : `${Math.min(tasks.length, (currentPage - 1) * pageSize + 1)}-${Math.min(tasks.length, currentPage * pageSize)} of ${tasks.length}`}
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

      <TaskViewModal open={viewOpen} onOpenChange={setViewOpen} task={selectedTask} />
      <PersonalTaskEditModal open={editOpen} onOpenChange={setEditOpen} task={selectedTask} />
      <MyTaskQuickEditModal open={progressOpen} onOpenChange={setProgressOpen} task={selectedTask} />
    </>
  );
}
