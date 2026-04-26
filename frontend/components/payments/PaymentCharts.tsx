"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  getMonthlyPaymentData,
  getYearlyPaymentData,
} from "@/lib/actions/payment.action";
import { cn, formatDate } from "@/lib/utils";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { SelectElement } from "../Shared/FormElements";
import { ChartSkeletonLoader } from "../Shared/Loader";
import { Button } from "../ui/button";

const chartConfig = {
  income: {
    label: "Income Recieved",
    color: "var(--color-dark-red)",
  },
  expense: {
    label: "Expense Paid",
    color: "var(--color-foreground)",
  },
} satisfies ChartConfig;

type ChartType = {
  type: "Yearly" | "Monthly";
};

const baseDescription =
  "This Graph shows Income and Expense Comparison excluding  receivables, payables and salary Expenses ";
export function PaymentCharts() {
  const [ChartType, setChartType] = useState<ChartType>({ type: "Monthly" });
  const searchParams = useSearchParams();
  const [graphType, setGraphType] = useState("Bar Chart");

  const startDate = formatDate(searchParams.get("startDate") ?? "");
  const endDate = formatDate(searchParams.get("endDate") ?? "");

  const { isLoading: isLoadingMontlydata, data: monthyData } = useSWR(
    ["monthlydata", startDate ?? "", endDate ?? ""],
    () =>
      getMonthlyPaymentData({
        startDate: startDate ?? "",
        endDate: endDate ?? "",
      }),
  );
  const { isLoading: isLoadingYearlyData, data: yearlyData } = useSWR(
    ["yearlyData"],
    getYearlyPaymentData,
  );

  const toggle = (type: "Yearly" | "Monthly") => {
    setChartType({ type });
  };

  const currentData =
    ChartType.type === "Monthly" ? monthyData?.data : yearlyData?.data;

  if (isLoadingMontlydata || isLoadingYearlyData)
    return <ChartSkeletonLoader />;

  return (
    <Card className="h-fit w-full rounded-[10px] border border-black/5">
      <CardHeader className="grid grid-cols-[1fr_auto] gap-2.5">
        <CardTitle className="font-semibold">
          Comparsion Between Expenses and Incomes
        </CardTitle>
        <div className="flex items-center space-x-2.5">
          <SelectElement
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
      <CardContent className="h-full">
        {currentData && currentData.length ? (
          graphType.startsWith("Bar Chart") ? (
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
                      showDollarSign
                      className="border border-gray-200 bg-white text-black shadow-md"
                      indicator="line"
                    />
                  }
                />
                <Bar
                  dataKey="income"
                  fill="var(--color-primary)"
                  radius={[8, 8, 0, 0]}
                />
                <Bar
                  dataKey="expense"
                  fill="var(--color-secondary-200)"
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
                  dataKey="income"
                  type="monotone"
                  height={100}
                  xHeight={100}
                  stroke="var(--color-secondary-100)"
                  strokeWidth={2}
                  dot={true}
                />
                <Line
                  dataKey="expense"
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
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <div className="text-muted-foreground leading-none">
          {startDate && endDate
            ? `${baseDescription} from ${startDate} to ${endDate} `
            : startDate
              ? `${baseDescription} from ${startDate} upto latest `
              : endDate
                ? `${baseDescription} from first tasks created upto this ${endDate} `
                : baseDescription}
          by {ChartType.type}
        </div>
      </CardFooter>
    </Card>
  );
}
