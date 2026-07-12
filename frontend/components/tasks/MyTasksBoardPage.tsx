"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import MyTasksBoardOwnTable from "@/components/tasks/MyTasksBoardOwnTable";
import MyTasksBoardTimeline from "@/components/tasks/MyTasksBoardTimeline";
import PersonalTaskCreateDialog from "@/components/tasks/PersonalTaskCreateDialog";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  BoardView,
  filterBoardTasks,
  filterBoardTasksForLanes,
  taskTitle,
} from "@/lib/my-task-filters";
import {
  BOARD_LANES,
  emptyLaneOrder,
  findLaneForTaskId,
  laneOrderFromTasks,
  normalizeLaneOrder,
  reorderLaneOrder,
  resolveLaneTasks,
} from "@/lib/my-task-board-dnd";
import { fetchMyTasks, patchMyTask } from "@/lib/my-tasks-client";
import {
  getTaskLane,
  laneDotClass,
  laneLabel,
  progressForLane,
  statusForLane,
  TaskLane,
} from "@/lib/my-task-workflow";
import { Task } from "@/lib/types";
import { dashboardCardClass } from "@/lib/dashboard-ui";
import { cn, resolveTaskDisplayStatus } from "@/lib/utils";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChevronDown,
  Filter,
  Plus,
  Search,
  Table2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const LANE_NEW_PAGE: Partial<Record<TaskLane, boolean>> = {
  todo: true,
  processing: true,
  review: true,
  completed: true,
};

const VIEW_TABS: { id: BoardView; label: string; icon: typeof BriefcaseBusiness }[] = [
  { id: "company", label: "Company tasks", icon: BriefcaseBusiness },
  { id: "own", label: "My tasks", icon: UserRound },
  { id: "timeline", label: "Timeline", icon: CalendarDays },
  { id: "table", label: "Table", icon: Table2 },
];

function priorityBadge(task: Task) {
  const p = String(task.priority ?? "normal").toLowerCase();
  if (p === "urgent") {
    return (
      <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-600">
        Urgent
      </span>
    );
  }
  return null;
}

type DragState = { taskId: string; fromLane: TaskLane };
type DropHint = { lane: TaskLane; index: number };

export default function MyTasksBoardPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data: remoteTasks, isLoading } = useSWR(
    SWR_CACH_KEYS.myTasksBoard.key,
    fetchMyTasks,
    {
      fallbackData: [],
      revalidateOnFocus: false,
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );

  const [boardTasks, setBoardTasks] = useState<Task[]>([]);
  const [laneOrder, setLaneOrder] = useState(emptyLaneOrder);
  const [view, setView] = useState<BoardView>("company");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropHint, setDropHint] = useState<DropHint | null>(null);
  const pendingSyncRef = useRef(0);
  const laneOrderRef = useRef(laneOrder);
  laneOrderRef.current = laneOrder;

  const showLoading = isLoading && boardTasks.length === 0;

  const filterTasks = useCallback(
    (list: Task[]) =>
      filterBoardTasks(list, view, search, statusFilter, resolveTaskDisplayStatus),
    [view, search, statusFilter],
  );

  const filterLaneTasks = useCallback(
    (list: Task[]) => filterBoardTasksForLanes(list, view, search),
    [view, search],
  );

  // Only pull from server when remote data changes — never wipe optimistic drag updates
  useEffect(() => {
    if (pendingSyncRef.current > 0) return;
    const list = remoteTasks ?? [];
    setBoardTasks(list);
    setLaneOrder(laneOrderFromTasks(filterLaneTasks(list)));
  }, [remoteTasks, filterLaneTasks]);

  const filteredTasks = useMemo(
    () => filterTasks(boardTasks),
    [boardTasks, filterTasks],
  );

  const laneTasksList = useMemo(
    () => filterLaneTasks(boardTasks),
    [boardTasks, filterLaneTasks],
  );

  const taskMap = useMemo(
    () => new Map(laneTasksList.map((task) => [String(task.id), task])),
    [laneTasksList],
  );

  const normalizedOrder = useMemo(
    () => normalizeLaneOrder(laneOrder, taskMap),
    [laneOrder, taskMap],
  );

  const lanesDisplay = useMemo(() => {
    const display = emptyLaneOrder();
    for (const lane of BOARD_LANES) {
      display[lane] = resolveLaneTasks(lane, normalizedOrder, taskMap);
    }
    return display;
  }, [normalizedOrder, taskMap]);

  function cacheBoardState(nextTasks: Task[]) {
    void globalMutate(SWR_CACH_KEYS.myTasksBoard.key, nextTasks, {
      revalidate: false,
    });
    void globalMutate(SWR_CACH_KEYS.myTasks.key, nextTasks, { revalidate: false });
  }

  function handleDropAt(toLane: TaskLane, toIndex: number) {
    if (!dragState) return;

    const task = boardTasks.find((t) => String(t.id) === dragState.taskId);
    if (!task) {
      setDragState(null);
      setDropHint(null);
      return;
    }

    const fromLane =
      findLaneForTaskId(laneOrderRef.current, dragState.taskId) ?? dragState.fromLane;
    const progress = progressForLane(toLane, Number(task.progress ?? 0));
    const status = statusForLane(toLane);
    const tasksSnapshot = boardTasks;
    const orderSnapshot = laneOrderRef.current;

    const nextTasks = boardTasks.map((t) =>
      String(t.id) === dragState.taskId
        ? { ...t, progress, status: status as Task["status"] }
        : t,
    );
    const nextTaskMap = new Map(nextTasks.map((t) => [String(t.id), t]));
    const nextOrder = normalizeLaneOrder(
      reorderLaneOrder(
        laneOrderRef.current,
        dragState.taskId,
        fromLane,
        toLane,
        toIndex,
      ),
      nextTaskMap,
    );

    setBoardTasks(nextTasks);
    setLaneOrder(nextOrder);
    setDragState(null);
    setDropHint(null);
    cacheBoardState(nextTasks);

    if (fromLane !== toLane) {
      pendingSyncRef.current += 1;
      void patchMyTask(String(task.id), { progress, status })
        .catch(() => {
          toast.error("Failed to move task");
          setBoardTasks(tasksSnapshot);
          setLaneOrder(orderSnapshot);
          cacheBoardState(tasksSnapshot);
        })
        .finally(() => {
          pendingSyncRef.current = Math.max(0, pendingSyncRef.current - 1);
        });
    }
  }

  function onDragStart(task: Task) {
    const taskId = String(task.id);
    const fromLane =
      findLaneForTaskId(laneOrderRef.current, taskId) ?? getTaskLane(task);
    setDragState({ taskId, fromLane });
  }

  function onDragEnd() {
    setDragState(null);
    setDropHint(null);
  }

  const isKanbanView = view === "company" || view === "own";

  const boardToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-600 hover:bg-zinc-50"
        >
          <Filter className="size-4" />
          Filter
          <ChevronDown className="size-3.5" />
        </button>
        {filterOpen ? (
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-lg border border-zinc-200 bg-white p-2 shadow-md">
            <label className="mb-1 block text-[10px] font-semibold uppercase text-zinc-400">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setFilterOpen(false);
              }}
              className="h-9 w-full rounded-md border border-zinc-200 px-2 text-sm"
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        ) : null}
      </div>

      <div className="relative">
        <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search..."
          className="h-9 w-full min-w-[160px] rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-48"
        />
      </div>

      <Button
        type="button"
        size="sm"
        className="h-9 gap-1 px-4 text-sm"
        onClick={() => setCreateOpen(true)}
      >
        <Plus className="size-4" />
        New
        <ChevronDown className="size-3.5" />
      </Button>
    </div>
  );

  const viewTabs = (
    <div className="flex flex-wrap items-center gap-1">
      {VIEW_TABS.map((tab) => {
        const Icon = tab.icon;
        const active = view === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setView(tab.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700",
            )}
          >
            <Icon className="size-4" />
            {tab.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <ManagementPageShell title="My board">
      <div
        className={cn(
          "mb-4 flex flex-col gap-3 px-1 sm:flex-row sm:items-center sm:justify-between",
          !isKanbanView && "sm:mb-3",
        )}
      >
        {viewTabs}
        {isKanbanView ? boardToolbar : null}
      </div>

      {isKanbanView ? (
        <div className="overflow-x-auto">
          <div className="flex min-w-max gap-4 lg:grid lg:min-w-0 lg:w-full lg:grid-cols-4">
              {BOARD_LANES.map((lane) => {
                const laneTasks = lanesDisplay[lane];
                const showNewPage = view === "own" && LANE_NEW_PAGE[lane];
                const isColumnActive = dropHint?.lane === lane;

                return (
                  <div
                    key={lane}
                    className={cn(
                      "flex w-[300px] shrink-0 flex-col lg:w-full lg:shrink",
                      isColumnActive && "rounded-xl ring-2 ring-primary/20 ring-offset-2",
                    )}
                    onDragOver={(e) => e.preventDefault()}
                  >
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className={cn("size-2.5 rounded-full", laneDotClass(lane))} />
                      <span className="text-sm font-semibold text-zinc-800">
                        {laneLabel(lane)}
                      </span>
                      <span className="text-sm text-zinc-400">
                        {laneTasks.length} task{laneTasks.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <div
                      className="flex min-h-[440px] flex-col rounded-xl border border-zinc-200 bg-white p-3 shadow-sm"
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (!dragState) return;
                        if (dropHint?.lane !== lane) {
                          setDropHint({ lane, index: laneTasks.length });
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const index =
                          dropHint?.lane === lane ? dropHint.index : laneTasks.length;
                        handleDropAt(lane, index);
                      }}
                    >
                      {showLoading ? (
                        <div className="space-y-2">
                          {[...Array(3)].map((_, i) => (
                            <div
                              key={i}
                              className="h-12 animate-pulse rounded-lg border border-zinc-100 bg-zinc-50"
                            />
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex min-h-0 flex-1 flex-col">
                            <DropSlot
                              lane={lane}
                              index={0}
                              dropHint={dropHint}
                              onHint={setDropHint}
                              onDropAt={handleDropAt}
                            />

                            {laneTasks.length === 0 ? (
                              <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-zinc-200 px-3 py-10 text-center text-xs text-zinc-400">
                                Drop tasks here — add as many as you need
                              </div>
                            ) : (
                              laneTasks.map((task, index) => {
                                const orderNumber = index + 1;
                                const isDragging = dragState?.taskId === String(task.id);

                                return (
                                  <div key={task.id}>
                                    <div
                                      draggable
                                      onDragStart={(e) => {
                                        onDragStart(task);
                                        e.dataTransfer.effectAllowed = "move";
                                        e.dataTransfer.setData("text/plain", String(task.id));
                                      }}
                                      onDragEnd={onDragEnd}
                                      onDragOver={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (dragState) {
                                          setDropHint({ lane, index: index + 1 });
                                        }
                                      }}
                                      onDrop={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleDropAt(lane, index + 1);
                                      }}
                                      className={cn(
                                        "cursor-grab rounded-lg border border-zinc-200 bg-white px-3 py-2.5 shadow-sm transition-[box-shadow,opacity,transform] duration-75 active:cursor-grabbing hover:border-zinc-300 hover:shadow-md",
                                        isDragging &&
                                          "border-primary/40 opacity-50 ring-2 ring-primary/20",
                                      )}
                                    >
                                      <div className="flex items-start gap-2.5">
                                        <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-zinc-100 text-[11px] font-bold text-zinc-600">
                                          {orderNumber}
                                        </span>
                                        <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
                                          <p className="text-sm leading-snug text-zinc-800">
                                            {taskTitle(task)}
                                          </p>
                                          {priorityBadge(task)}
                                        </div>
                                      </div>
                                    </div>

                                    <DropSlot
                                      lane={lane}
                                      index={index + 1}
                                      dropHint={dropHint}
                                      onHint={setDropHint}
                                      onDropAt={handleDropAt}
                                    />
                                  </div>
                                );
                              })
                            )}
                          </div>

                          {showNewPage ? (
                            <button
                              type="button"
                              onClick={() => setCreateOpen(true)}
                              className="mt-auto shrink-0 rounded-lg px-2 py-2 pt-3 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-50 hover:text-zinc-600"
                            >
                              + New page
                            </button>
                          ) : null}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
      ) : (
        <div className={dashboardCardClass}>
          <div className="flex flex-col gap-3 border-b border-zinc-50 px-6 py-3 sm:flex-row sm:items-center sm:justify-end">
            {boardToolbar}
          </div>

          {view === "timeline" ? (
            <MyTasksBoardTimeline tasks={filteredTasks} assignableTasks={laneTasksList} />
          ) : (
            <MyTasksBoardOwnTable tasks={filteredTasks} isLoading={showLoading} />
          )}
        </div>
      )}

      <PersonalTaskCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </ManagementPageShell>
  );
}

function DropSlot({
  lane,
  index,
  dropHint,
  onHint,
  onDropAt,
}: {
  lane: TaskLane;
  index: number;
  dropHint: DropHint | null;
  onHint: (hint: DropHint | null) => void;
  onDropAt: (lane: TaskLane, index: number) => void;
}) {
  const active = dropHint?.lane === lane && dropHint.index === index;

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onHint({ lane, index });
      }}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropAt(lane, index);
      }}
      className={cn(
        "my-0.5 shrink-0 rounded-full transition-all duration-75",
        active ? "h-3 bg-primary" : "h-2 bg-transparent",
      )}
    />
  );
}
