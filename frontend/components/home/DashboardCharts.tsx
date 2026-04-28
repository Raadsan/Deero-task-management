"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  getMonthlyDashbaordGraphData,
  getYearlyDashbaordGraph,
} from "@/lib/actions/task.action";
import { cn, formatDate } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { SelectElement } from "../Shared/FormElements";
import { ChartSkeletonLoader } from "../Shared/Loader";
import { Button } from "../ui/button";

const chartConfig = {
  "Registered Tasks": {
    label: "Registered Tasks",
    color: "var(--color-dark-red)",
  },
  "Completed Tasks": {
    label: "Completed Tasks",
    color: "var(--color-foreground)",
  },
} satisfies ChartConfig;

type ChartType = {
  type: "Yearly" | "Monthly";
};

const baseDescription =
  "This Graph shows Number Of Tasks Completed And Registered ";

export function DashboardCharts() {
  const [ChartType, setChartType] = useState<ChartType>({ type: "Monthly" });
  const [graphType, setGraphType] = useState("Bar Chart");
  const searchParams = useSearchParams();

  const startDate = formatDate(searchParams.get("startDate") ?? "");
  const endDate = formatDate(searchParams.get("endDate") ?? "");

  const toggle = (type: "Yearly" | "Monthly") => {
    setChartType({ type });
  };

  const { isLoading: isYearlyDataLoading, data: yearlyGraphData } = useSWR(
    ["dashboardYearlyGraphData", startDate ?? "", endDate ?? ""],
    () =>
      getYearlyDashbaordGraph({
        endDate: endDate ? new Date(endDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
      }),
  );

  const { isLoading: isMonthlyDataLoading, data: monthlyGraphData } = useSWR(
    ["dashboardMonthlyGraphData", startDate ?? "", endDate ?? ""],
    () =>
      getMonthlyDashbaordGraphData({
        endDate: endDate ? new Date(endDate) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
      }),
  );

  const currentData =
    ChartType.type === "Monthly"
      ? monthlyGraphData?.data
      : yearlyGraphData?.data;

  if (isMonthlyDataLoading || isYearlyDataLoading)
    return <ChartSkeletonLoader />;

  return (
    <Card className="h-full w-full border-none shadow-md">
      <CardHeader className="grid grid-cols-[1fr_auto] place-content-center">
        <CardTitle className="text-2xl font-semibold">
          {startDate && endDate
            ? `${baseDescription} from ${startDate} to ${endDate} `
            : startDate
              ? `${baseDescription} from ${startDate} upto latest `
              : endDate
                ? `${baseDescription} from first tasks created upto this ${endDate} `
                : baseDescription}
          by {ChartType.type}
        </CardTitle>
        <div className="flex items-center gap-3">
          <SelectElement
            defaultValue={graphType}
            elements={["Bar Chart", "Line Graph"]}
            onChange={function (value: string): void {
              setGraphType(value);
            }}
            placeholder={"Select Graph Type"}
          />
          <Button
            onClick={() => toggle("Monthly")}
            className={cn(
              "hover: cursor-pointer border border-black/20 bg-gray-50 text-black",
              ChartType.type === "Monthly" &&
                "from-dark-red via-secondary-200 border-dark-red bg-linear-to-br to-orange-100 text-white",
            )}
          >
            Monthly
          </Button>
          <Button
            onClick={() => toggle("Yearly")}
            className={cn(
              "cursor-pointer border border-black/20 bg-gray-50 text-black",
              ChartType.type === "Yearly" &&
                "from-dark-red via-secondary-200 border-dark-red bg-linear-to-br to-orange-100 text-white",
            )}
          >
            Yearly
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-full w-full">
        {currentData && currentData.length ? (
          graphType.includes("Bar Chart") ? (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <BarChart accessibilityLayer data={currentData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={ChartType.type === "Monthly" ? "month" : "year"}
                  tickLine={false}
                  tickMargin={10}
                  axisLine={false}
                  tickFormatter={(value) => value}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      className="border border-gray-200 bg-white text-black shadow-md"
                      indicator="line"
                    />
                  }
                />
                <Bar
                  dataKey="Registered Tasks"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="Completed Tasks"
                  fill="var(--color-foreground)"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <ChartContainer config={chartConfig} className="h-[400px] w-full">
              <LineChart
                accessibilityLayer
                data={currentData}
                margin={{
                  left: 12,
                  right: 12,
                  top: 10,
                }}
              >
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey={ChartType.type === "Monthly" ? "month" : "year"}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  tickFormatter={(value) => value}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent />}
                />

                <Line
                  dataKey="Registered Tasks"
                  type="monotone"
                  height={100}
                  xHeight={100}
                  stroke="var(--color-secondary-100)"
                  strokeWidth={2}
                  dot={true}
                />
                <Line
                  dataKey="Completed Tasks"
                  type="monotone"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={true}
                />
              </LineChart>
            </ChartContainer>
          )
        ) : (
          <div className="text-dark-gray mx-auto h-[50px] w-fit text-2xl font-medium">
            Not Data to show
          </div>
        )}
      </CardContent>
    </Card>
  );
}
