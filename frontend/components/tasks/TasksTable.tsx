"use client";
import { getAllTasks } from "@/lib/apis/taskApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { Task } from "@/lib/types";
import useSWR from "swr";
import TableRenderer from "../Shared/TableRenderer";
import { taskColumns } from "../ui/columns";

export default function TasksTable() {
  const { isLoading, data: tasks } = useSWR(
    SWR_CACH_KEYS.tasks.key,
    getAllTasks,
  );

  return (
    <TableRenderer
      tableType="tasks"
      columns={taskColumns}
      data={isLoading ? [] : ((tasks?.data as Task[]) ?? [])}
    />
  );
}
