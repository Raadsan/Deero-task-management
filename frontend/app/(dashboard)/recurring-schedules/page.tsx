"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getAllRecurringSchedules,
  getRecurringOccurrences,
  runRecurringDailyGeneration,
  toggleRecurringSchedule,
} from "@/lib/actions/recurring.action";
import { RECURRENCE_TYPE_OPTIONS, WEEKDAY_OPTIONS } from "@/lib/client-types";
import { SWR_CACH_KEYS } from "@/lib/constants";
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
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { CalendarClock, Eye, Play, Power, Search } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

function weekdayLabel(value?: number | null) {
  if (value == null) return "â€”";
  return WEEKDAY_OPTIONS.find((d) => d.value === value)?.label ?? String(value);
}

function recurrenceLabel(value: string) {
  return RECURRENCE_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export default function RecurringSchedulesPage() {
  const { mutate } = useSWRConfig();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewId, setViewId] = useState<string | null>(null);
  const [viewOpen, setViewOpen] = useState(false);

  const { data: schedules = [], isLoading } = useSWR(
    SWR_CACH_KEYS.recurringSchedules.key,
    async () => {
      const result = await getAllRecurringSchedules();
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load schedules");
      return result.data ?? [];
    },
  );

  const { data: occurrences = [], isLoading: historyLoading } = useSWR(
    viewId ? `recurring/occurrences/${viewId}` : null,
    async () => {
      const result = await getRecurringOccurrences(viewId!);
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load occurrences");
      return result.data ?? [];
    },
  );

  const viewed = schedules.find((s) => s.id === viewId);

  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return schedules.filter((row) => {
      if (activeFilter === "active" && !row.isActive) return false;
      if (activeFilter === "inactive" && row.isActive) return false;
      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.client?.institution?.toLowerCase().includes(query) ||
        String(row.id).toLowerCase().includes(query)
      );
    });
  }, [schedules, search, activeFilter]);

  const totalPages = Math.ceil(filtered.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, activeFilter, pageSize]);

  function handleToggle(id: string) {
    startTransition(async () => {
      const result = await toggleRecurringSchedule(id);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Failed to update schedule");
        return;
      }
      toast.success(result.data?.isActive ? "Schedule activated" : "Schedule paused");
      mutate(SWR_CACH_KEYS.recurringSchedules.key);
    });
  }

  function handleRunDaily(id: string) {
    startTransition(async () => {
      const result = await runRecurringDailyGeneration(id);
      if (!result.success) {
        toast.error(result.errors?.message ?? "Generation failed");
        return;
      }
      toast.success(
        `Created ${result.data?.created ?? 0} task(s), skipped ${result.data?.skipped ?? 0}`,
      );
      if (viewId === id) mutate(`recurring/occurrences/${id}`);
    });
  }

  return (
    <ManagementPageShell title="Recurring schedules">
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
            </select>
          </div>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            className={cn("min-w-[130px]", compactSelectClass)}
          >
            <option value="all">All schedules</option>
            <option value="active">Active only</option>
            <option value="inactive">Paused only</option>
          </select>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search schedules..."
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
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>ID</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Schedule</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Client</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Recurrence</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Steps</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Period</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No recurring schedules yet. Create one from a Scheduled client profile.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id} className={dashboardTableBodyRowClass}>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>
                          {String(row.id).slice(0, 8)}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextPrimary}>{row.name}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {row.client?.institution ?? "â€”"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {recurrenceLabel(row.recurrenceType)}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        {row.steps?.length ?? 0}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {formatDate(String(row.startDate))}
                          {row.endDate ? ` â†’ ${formatDate(String(row.endDate))}` : " â†’ ongoing"}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span
                          className={cn(
                            dashboardStatusBadgeClass,
                            row.isActive
                              ? getTaskStatusBadgeClass("completed")
                              : getTaskStatusBadgeClass("pending"),
                          )}
                        >
                          {row.isActive ? "Active" : "Paused"}
                        </span>
                      </TableCell>
                      <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="View schedule & history"
                            className={actionBtnView}
                            onClick={() => {
                              setViewId(row.id);
                              setViewOpen(true);
                            }}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Generate today's tasks"
                            disabled={pending}
                            className={actionBtnView}
                            onClick={() => handleRunDaily(row.id)}
                          >
                            <Play className="size-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title={row.isActive ? "Pause" : "Activate"}
                            disabled={pending}
                            className={actionBtnView}
                            onClick={() => handleToggle(row.id)}
                          >
                            <Power className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filtered.length === 0
              ? "0 of 0"
              : `${Math.min(filtered.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filtered.length, currentPage * pageSize)} of ${filtered.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 text-left">
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-[#1e293b]">
              <CalendarClock className="h-5 w-5 text-primary" />
              {viewed?.name ?? "Schedule"}
            </DialogTitle>
            <DialogDescription className="text-sm text-zinc-500">
              {viewed?.client?.institution} Â· {viewed ? recurrenceLabel(viewed.recurrenceType) : ""}
            </DialogDescription>
          </DialogHeader>

          {viewed && (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={pending} onClick={() => handleRunDaily(viewed.id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Generate today&apos;s tasks
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => handleToggle(viewed.id)}
                >
                  {viewed.isActive ? "Pause schedule" : "Activate schedule"}
                </Button>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-800">Weekly steps</h3>
                <div className={dashboardTableWrapClass}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Day</TableHead>
                        <TableHead>Task</TableHead>
                        <TableHead>Department</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(viewed.steps ?? []).map((step) => (
                        <TableRow key={step.id}>
                          <TableCell>{weekdayLabel(step.dayOfWeek)}</TableCell>
                          <TableCell>{step.label}</TableCell>
                          <TableCell>{step.department ?? "â€”"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold text-zinc-800">Auto-generated history</h3>
                {historyLoading ? (
                  <p className="text-sm text-zinc-500">Loading historyâ€¦</p>
                ) : occurrences.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No tasks generated yet. They appear automatically on scheduled days.
                  </p>
                ) : (
                  <div className={dashboardTableWrapClass}>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Step</TableHead>
                          <TableHead>Task</TableHead>
                          <TableHead>Assignee</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {occurrences.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell>{formatDate(String(row.scheduledDate))}</TableCell>
                            <TableCell>{row.scheduleStep?.label ?? "â€”"}</TableCell>
                            <TableCell>{row.task?.description ?? "â€”"}</TableCell>
                            <TableCell>{row.task?.user?.name ?? "â€”"}</TableCell>
                            <TableCell>{row.task?.status ?? "â€”"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </ManagementPageShell>
  );
}
