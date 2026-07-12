"use client";

import TimelineDayDialog from "@/components/tasks/TimelineDayDialog";
import { Task } from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { isCompanyTask, isOwnTask, taskOnDate, taskTitle } from "@/lib/my-task-filters";
import { resolveTaskDisplayStatus } from "@/lib/utils";
import {
  dashboardStatusBadgeClass,
  formatStatusLabel,
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";

type Props = {
  tasks: Task[];
  assignableTasks?: Task[];
};

const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MyTasksBoardTimeline({ tasks, assignableTasks }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogDate, setDialogDate] = useState<Date | null>(null);

  const tasksForLink = assignableTasks ?? tasks;

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const dayTasks = useMemo(
    () => tasks.filter((task) => taskOnDate(task, selected)),
    [tasks, selected],
  );

  const companyDayTasks = dayTasks.filter(isCompanyTask);
  const ownDayTasks = dayTasks.filter(isOwnTask);

  return (
    <div className="flex min-h-[520px] flex-col">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
          >
            <ChevronLeft className="size-4" />
          </button>
          <h3 className="min-w-[140px] text-center text-sm font-semibold text-zinc-800">
            {format(month, "MMMM yyyy")}
          </h3>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1 text-zinc-500 hover:bg-zinc-100"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-zinc-500">
          <span className="hidden sm:inline text-zinc-400">Double-click a date to add</span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            Company
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-violet-500" />
            My own
          </span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-zinc-100 bg-zinc-50/80">
        {weekDays.map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-400"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid flex-1 grid-cols-7 auto-rows-fr border-b border-zinc-100">
        {days.map((day) => {
          const dayList = tasks.filter((task) => taskOnDate(task, day));
          const companyCount = dayList.filter(isCompanyTask).length;
          const ownCount = dayList.filter(isOwnTask).length;
          const selectedDay = isSameDay(day, selected);
          const inMonth = isSameMonth(day, month);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                setSelected(day);
                if (!isSameMonth(day, month)) setMonth(day);
              }}
              onDoubleClick={(e) => {
                e.preventDefault();
                setSelected(day);
                if (!isSameMonth(day, month)) setMonth(day);
                setDialogDate(day);
                setDialogOpen(true);
              }}
              title="Double-click to add or schedule a task"
              className={cn(
                "min-h-[88px] border-r border-b border-zinc-100 p-1.5 text-left transition-colors hover:bg-zinc-50/80",
                !inMonth && "bg-zinc-50/40 text-zinc-300",
                selectedDay && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                isToday(day) && !selectedDay && "bg-amber-50/40",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  selectedDay && "bg-primary text-white",
                  isToday(day) && !selectedDay && "font-semibold text-amber-700",
                )}
              >
                {format(day, "d")}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayList.slice(0, 2).map((task) => (
                  <div
                    key={task.id}
                    className={cn(
                      "truncate rounded px-1 py-0.5 text-[10px] leading-tight",
                      isOwnTask(task)
                        ? "bg-violet-100 text-violet-700"
                        : "bg-sky-100 text-sky-700",
                    )}
                  >
                    {taskTitle(task)}
                  </div>
                ))}
                {dayList.length > 2 ? (
                  <p className="px-1 text-[10px] text-zinc-400">+{dayList.length - 2} more</p>
                ) : null}
              </div>
              {(companyCount > 0 || ownCount > 0) && dayList.length <= 2 ? (
                <div className="mt-1 flex gap-1 px-1">
                  {companyCount > 0 ? (
                    <span className="size-1.5 rounded-full bg-sky-500" />
                  ) : null}
                  {ownCount > 0 ? (
                    <span className="size-1.5 rounded-full bg-violet-500" />
                  ) : null}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-700">
            <span className="size-2 rounded-full bg-sky-500" />
            Company — {format(selected, "MMM d, yyyy")}
          </h4>
          <div className="space-y-1.5">
            {companyDayTasks.length === 0 ? (
              <p className="text-xs text-zinc-400">No company tasks this day</p>
            ) : (
              companyDayTasks.map((task) => (
                <TimelineTaskRow key={task.id} task={task} />
              ))
            )}
          </div>
        </section>
        <section>
          <h4 className="mb-2 flex items-center gap-2 text-xs font-semibold text-zinc-700">
            <span className="size-2 rounded-full bg-violet-500" />
            My own — {format(selected, "MMM d, yyyy")}
          </h4>
          <div className="space-y-1.5">
            {ownDayTasks.length === 0 ? (
              <p className="text-xs text-zinc-400">No personal tasks this day</p>
            ) : (
              ownDayTasks.map((task) => (
                <TimelineTaskRow key={task.id} task={task} />
              ))
            )}
          </div>
        </section>
      </div>

      <TimelineDayDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        date={dialogDate}
        tasks={tasksForLink}
      />
    </div>
  );
}

function TimelineTaskRow({ task }: { task: Task }) {
  const status = resolveTaskDisplayStatus(task);
  return (
    <div className="flex items-center justify-between rounded-md border border-zinc-100 bg-white px-2.5 py-1.5">
      <span className="truncate text-xs text-zinc-700">{taskTitle(task)}</span>
      <span
        className={cn(
          "ml-2 shrink-0 text-[10px] font-medium",
          dashboardStatusBadgeClass,
          getTaskStatusBadgeClass(status),
        )}
      >
        {formatStatusLabel(status)}
      </span>
    </div>
  );
}
