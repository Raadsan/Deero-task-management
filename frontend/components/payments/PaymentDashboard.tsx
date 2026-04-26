"use client";

import {
  getExpensesIncomesBySource,
  getExpenseTableData,
  getIncomeTableData,
} from "@/lib/actions/payment.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import { cn, updateUrlWithQueryParams } from "@/lib/utils";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { GeneralTableSkeletonLoader } from "../Shared/Loader";
import PageDatePicker from "../Shared/PageDatePicker";
import TableRenderer from "../Shared/TableRenderer";

import { Button } from "../ui/button";
import { expenseColumns, incomeColumns } from "../ui/columns";
import { BarChartDisplay } from "./BarChartDisplay";
import PayablesList from "./PayablesList";
import { PaymentCharts } from "./PaymentCharts";
import PaymentSummary from "./PaymentSummaryCard";
import ReceivablesList from "./ReceivablesList";

export default function PaymentDashboard() {
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const router = useRouter();

  let isLoading = false;

  const { data: incomeResult, isLoading: isIncomeLoading } = useSWR(
    [SWR_CACH_KEYS.income.key, startDate ?? "", endDate ?? ""],
    () =>
      getIncomeTableData({
        startDate: startDate ?? "",
        endDate: endDate ?? "",
      }),
  );
  isLoading = isIncomeLoading;
  const { data: expenseResult, isLoading: isExpenseLoading } = useSWR(
    [SWR_CACH_KEYS.expense.key, startDate ?? "", endDate ?? ""],
    () =>
      getExpenseTableData({
        startDate: startDate ?? "",
        endDate: endDate ?? "",
      }),
  );

  isLoading = isExpenseLoading ? isExpenseLoading : isIncomeLoading;

  const { data: expenseIncomeSourceComparison } = useSWR(
    ["expense-income-source-comparison", startDate ?? "", endDate ?? ""],
    () =>
      getExpensesIncomesBySource({
        startDate: startDate ?? "",
        endDate: endDate ?? "",
      }),
  );

  return (
    <section className="h-full w-full">
      <div className="mb-[30px] flex w-full items-center justify-between gap-[10px]">
        <PageDatePicker classNames="mr-auto" />
        <Button
          onClick={() => {
            const newUrl = updateUrlWithQueryParams({
              maps: [
                {
                  key: "tab",
                  value: "overview",
                },
              ],
            });
            router.push(newUrl);
          }}
          className={cn(
            "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
            activeTab == "overview" &&
              "from-dark-red via-secondary-200 border-dark-red bg-linear-to-br to-orange-100 text-white",
          )}
        >
          Overview
        </Button>

        <Button
          onClick={() => {
            const newUrl = updateUrlWithQueryParams({
              maps: [
                {
                  key: "tab",
                  value: "income",
                },
              ],
            });
            router.push(newUrl);
          }}
          className={cn(
            "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
            activeTab == "income" &&
              "from-dark-red via-secondary-200 border-dark-red bg-linear-to-br to-orange-100 text-white",
          )}
        >
          Income
        </Button>
        <Button
          onClick={() => {
            const newUrl = updateUrlWithQueryParams({
              maps: [
                {
                  key: "tab",
                  value: "expense",
                },
              ],
            });
            router.push(newUrl);
          }}
          className={cn(
            "cursor-pointer rounded-[10px] border border-black/30 bg-gray-50 px-3 py-2 text-black hover:opacity-90",
            activeTab == "expense" &&
              "from-dark-red via-secondary-200 border-dark-red bg-linear-to-br to-orange-100 text-white",
          )}
        >
          Expense
        </Button>
      </div>
      {activeTab === "overview" && (
        <div className="flex w-full flex-col gap-[20px]">
          <PaymentSummary endDate={endDate ?? ""} startDate={startDate ?? ""} />
          <div className="grid w-full grid-cols-1 gap-[20px] md:grid-cols-2">
            <ReceivablesList
              startDate={startDate ?? ""}
              endDate={endDate ?? ""}
            />
            <PayablesList startDate={startDate ?? ""} endDate={endDate ?? ""} />
          </div>
          <div className="flex w-full items-center justify-between gap-3">
            <BarChartDisplay
              charData={expenseIncomeSourceComparison?.data?.expenses ?? []}
              startDate={startDate ?? ""}
              endDate={endDate ?? ""}
              sourceType={"expense"}
            />
            <BarChartDisplay
              charData={expenseIncomeSourceComparison?.data?.incomes ?? []}
              startDate={startDate ?? ""}
              endDate={endDate ?? ""}
              sourceType={"income"}
            />
          </div>

          <PaymentCharts />
        </div>
      )}

      {activeTab === "income" &&
        (isLoading ? (
          <GeneralTableSkeletonLoader />
        ) : (
          <TableRenderer
            columns={incomeColumns}
            data={incomeResult?.data ?? []}
            tableType={"incomes"}
          />
        ))}
      {activeTab === "expense" &&
        (isLoading ? (
          <GeneralTableSkeletonLoader />
        ) : (
          <TableRenderer
            columns={expenseColumns}
            data={expenseResult?.data ?? []}
            tableType={"expenses"}
          />
        ))}
    </section>
  );
}
