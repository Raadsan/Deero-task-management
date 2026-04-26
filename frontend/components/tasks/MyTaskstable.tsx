"use client";
import { getAssginedTasks } from "@/lib/actions/task.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { Task } from "@/lib/types";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import TableRenderer from "../Shared/TableRenderer";
import { taskColumns } from "../ui/columns";

export default function MyTasksTable() {
  const { isLoading, data: myTasksData } = useSWR(
    SWR_CACH_KEYS.myTasks.key,
    getAssginedTasks,
  );

  if (isLoading) return <GeneralTableSkeletonLoader />;
  return (
    <TableRenderer
      tableType="my-tasks"
      columns={taskColumns}
      data={(myTasksData?.data as Task[]) ?? []}
    />
  );
}
