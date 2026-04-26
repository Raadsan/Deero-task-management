"use client";

import { getDashboardMetricData } from "@/lib/actions/task.action";
import { computeFontSize } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { SummarySkeltonLoader } from "../Shared/Loader";

export default function DashboardMetric() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const { isLoading, data: dashboardMetricData } = useSWR(
    ["dashboard-metric-data", startDate ?? "", endDate ?? ""],
    () =>
      getDashboardMetricData({
        endDate: endDate ? new Date(endDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
      }),
  );

  if (isLoading) return <SummarySkeltonLoader />;

  const result = dashboardMetricData?.data ?? [];
  return (
    <div className="dashbordMetrictsGrid w-full">
      {result.map(
        ({ title, totalEarning, totalTasks, totallPending }, index) => {
          return (
            <div
              key={index}
              className="flex flex-1 flex-col gap-2 rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
            >
              <h4
                style={{
                  fontSize: computeFontSize(16),
                }}
                className="text-center font-medium text-gray-600"
              >
                {title}
              </h4>

              <p
                style={{
                  fontSize: computeFontSize(28),
                }}
                className="text-center font-semibold text-gray-900"
              >
                {totalTasks ?? totallPending ?? totalEarning}
              </p>
            </div>
          );
        },
      )}
    </div>
  );
}
