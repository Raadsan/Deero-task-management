"use client";

import TasksReport from "@/components/payments/TasksReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { DatePicker } from "@/components/Shared/FormElements";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { getTasksReport } from "@/lib/actions/task.action";
import { ROUTES } from "@/lib/constants";
import { useParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";

export default function UserTaskReportPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const params = useParams();

  const { isLoading, data: reportData } = useSWR(
    ["Report", toDate ?? "", fromDate ?? ""],
    () =>
      getTasksReport({
        userIdForTaskReport: String(params.id),
        startDate: fromDate,
        endDate: toDate,
      }),
  );
  const meta = reportData?.data?.meta;
  const items = reportData?.data?.tasks;

  return (
    <ManagementPageShell title="Tasks Report">
      <PageBreadcrumb
        links={[
          {
            title: "Tasks",
            link: ROUTES.tasks,
          },
        ]}
      />
      <div className="mb-6 ml-auto flex w-fit min-w-[300px] items-center gap-3">
        <DatePicker
          date={fromDate}
          setDate={(e) => setFromDate(e)}
          labelText={"From Month"}
        />
        <DatePicker
          date={toDate}
          setDate={(e) => setToDate(e)}
          labelText={"To Month"}
        />
        <Button
          onClick={() => {
            setFromDate(undefined);
            setToDate(undefined);
          }}
          className="bg-dark-red self-end px-3 py-5 text-white"
        >
          Clear Date Filters
        </Button>
      </div>
      {isLoading && (
        <div className="h-fit w-full rounded bg-gray-100 py-8 text-center text-2xl font-bold tracking-wide text-gray-600 uppercase">
          Loading...
        </div>
      )}
      <TasksReport
        meta={{
          overdue: meta?.overdue || 0,
          totalTasks: meta?.totalTasks || 0,
          completed: meta?.completed || 0,
          pending: meta?.pending || 0,
          assignedTo: meta?.assignedTo ?? "",
        }}
        tasks={items ?? []}
      />
    </ManagementPageShell>
  );
}
