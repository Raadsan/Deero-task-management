"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { ExpenseIncomeSourceType } from "@/lib/types";
import { formatDate } from "@/lib/utils";

interface Props {
  charData?: Array<ExpenseIncomeSourceType>;
  startDate: string;
  endDate: string;
  sourceType: "income" | "expense";
}

const chartConfig = {
  key: {
    label: "key",
    color: "var(--color-red-400)",
  },
} satisfies ChartConfig;

function getTitleAndDescription(
  sourceType: "expense" | "income",
  startDate: string,
  endDate: string,
) {
  const titleDraft = `${sourceType === "expense" ? "Expenses " : "Income"} Sources Comparison`;
  if (startDate.length > 0 && endDate.length > 0) {
    return {
      title: titleDraft,
      description: `From ${startDate} to ${endDate}`,
    };
  } else if (startDate.length > 0) {
    return {
      title: titleDraft,
      description: `From ${startDate} to current Date`,
    };
  } else if (endDate.length > 0) {
    return {
      title: titleDraft,
      description: `From All time to ${endDate}`,
    };
  } else {
    return {
      title: titleDraft,
      description: `From  all time to current Date`,
    };
  }
}

export function BarChartDisplay({
  charData,
  startDate,
  endDate,
  sourceType,
}: Props) {
  const fromDate = startDate.length > 0 ? formatDate(new Date(startDate))! : "";
  const toDate = endDate.length > 0 ? formatDate(new Date(endDate))! : "";

  const titleAndDescription = getTitleAndDescription(
    sourceType,
    fromDate,
    toDate,
  );

  return (
    <Card className="h-fit w-full flex-1 rounded-[5px] border border-black/10 shadow-none">
      <CardHeader>
        <CardTitle>{titleAndDescription.title}</CardTitle>
        <CardDescription>{titleAndDescription.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {!charData?.length ? (
          <div className="py-12 text-center text-3xl text-gray-400">
            No data to show now.
          </div>
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart accessibilityLayer data={charData}>
              <CartesianGrid vertical={false} />
              <XAxis
                className="text-[10px]"
                dataKey="key"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => value}
              />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    showDollarSign={true}
                    className="border border-gray-200 bg-white text-black shadow-md"
                    indicator="line"
                  />
                }
              />
              <Bar
                dataKey="amount"
                fill="var(--color-secondary-200)"
                radius={[8, 8, 0, 0]}
              />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-2 text-sm">
        <p className="text-muted-foreground leading-none">
          {sourceType === "expense"
            ? "Summary of all expenses by category."
            : sourceType === "income"
              ? "Summary of all incomes by category."
              : ""}
        </p>
      </CardFooter>
    </Card>
  );
}
