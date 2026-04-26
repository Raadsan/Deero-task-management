"use client";
import { getAllTasks } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { Task } from "@/lib/types";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import TableRenderer from "../Shared/TableRenderer";
import { taskColumns } from "../ui/columns";

export default function TasksTable() {
  const { isLoading, data: tasks } = useSWR(
    SWR_CACH_KEYS.tasks.key,
    getAllTasks,
  );

  if (isLoading) return <GeneralTableSkeletonLoader />;

  return (
    <TableRenderer
      tableType="tasks"
      columns={taskColumns}
      data={(tasks?.data as Task[]) ?? []}
    />
  );
}
