"use client";

import { getPayables } from "@/lib/actions/payment.action";
import { DateFilter } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import useSWR from "swr";
import { ReceivablePayableTableSkeleton } from "../Shared/Loader";

export default function PayablesList({ startDate, endDate }: DateFilter) {
  const { isLoading, data: payables } = useSWR("paybales", getPayables);

  if (isLoading) return <ReceivablePayableTableSkeleton />;
  return (
    <div className="flex w-full min-w-[500px] flex-col rounded-lg border border-black/10 bg-white shadow-sm">
      <h2 className="border-b border-black/5 p-4 text-2xl font-bold">
        Payables Amounts
      </h2>
      <table className="flex w-full border-collapse flex-col">
        <thead className="w-full bg-gray-100">
          <tr className="flex w-full gap-[10px] px-2.5 text-left">
            <th className="flex-1">Expense Type</th>
            <th className="flex-1">Amount</th>
            <th className="flex-1">Due Date</th>
            <th className="flex-1">Status</th>
          </tr>
        </thead>
        <tbody className="w-full space-y-3.5 py-3">
          {payables?.data?.map((r, idx) => (
            <tr
              className={cn(
                "flex w-full gap-[10px] px-2.5 not-last:border-b not-last:border-black/10",
              )}
              key={idx}
            >
              <td className="flex-1">{r.expenseType}</td>
              <td className="flex-1">${r.amount}</td>
              <td className="flex-1">{formatDate(r.duetoDate ?? "")}</td>
              <td className="flex-1">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
