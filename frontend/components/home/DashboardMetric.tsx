"use client";

import { getDashboardMetricData } from "@/lib/actions/task.action";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { SummarySkeltonLoader } from "../Shared/Loader";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { ClipboardList, CheckCircle, Clock, Users } from "lucide-react";

const iconMap: Record<string, any> = {
  "Total Tasks": ClipboardList,
  "Completed Tasks": CheckCircle,
  "Pending Tasks": Clock,
  "Total Clients": Users,
};

const colorMap: Record<string, string> = {
  "Total Tasks": "text-blue-600 bg-blue-50",
  "Completed Tasks": "text-green-600 bg-green-50",
  "Pending Tasks": "text-orange-600 bg-orange-50",
  "Total Clients": "text-purple-600 bg-purple-50",
};

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
    <div className="grid w-full grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {result.map(({ title, totalEarning, totalTasks, totallPending }, index) => {
        const Icon = iconMap[title] || ClipboardList;
        const colorClass = colorMap[title] || "text-gray-600 bg-gray-50";
        const value = totalTasks ?? totallPending ?? totalEarning ?? 0;

        return (
          <Card key={index} className="overflow-hidden border-none shadow-md transition-all hover:shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {title}
              </CardTitle>
              <div className={`rounded-md p-2 ${colorClass}`}>
                <Icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground">
                Updated just now
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
