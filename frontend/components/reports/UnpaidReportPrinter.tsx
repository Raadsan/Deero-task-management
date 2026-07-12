"use client";

import { RecievableType } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import { Button } from "../ui/button";

type Props = {
  items: RecievableType[];
  total: number;
  startDate?: string;
  endDate?: string;
};

export default function UnpaidReportPrinter({
  items,
  total,
  startDate,
  endDate,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({ contentRef: ref, documentTitle: "Unpaid Balances Report" });

  return (
    <div>
      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={() => handlePrint()} className="bg-dark-red text-white">
          Print report
        </Button>
      </div>

      <div ref={ref} className="rounded-lg border border-zinc-200 bg-white p-6">
        <header className="mb-6 border-b border-zinc-200 pb-4 text-center">
          <h1 className="text-2xl font-bold text-zinc-900">Unpaid Balances Report</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {startDate || endDate
              ? `Period: ${startDate ? formatDate(startDate) : "start"} — ${endDate ? formatDate(endDate) : "today"}`
              : "All outstanding balances"}
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Generated {formatDate(new Date().toISOString())}
          </p>
        </header>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 text-left">
              <th className="p-2 font-semibold">#</th>
              <th className="p-2 font-semibold">Client</th>
              <th className="p-2 font-semibold">Amount</th>
              <th className="p-2 font-semibold">Due date</th>
              <th className="p-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((row, index) => (
              <tr key={index} className="border-b border-zinc-100">
                <td className="p-2">{index + 1}</td>
                <td className="p-2">{row.client}</td>
                <td className="p-2">${Number(row.amount).toFixed(2)}</td>
                <td className="p-2">{formatDate(row.duetoDate ?? "")}</td>
                <td className="p-2">{row.status}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-zinc-50 font-semibold">
              <td className="p-2" colSpan={2}>
                Total unpaid
              </td>
              <td className="p-2" colSpan={3}>
                ${total.toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>

        <p className="mt-6 text-center text-xs text-zinc-400">
          Deero Management System — Unpaid Balances Report
        </p>
      </div>
    </div>
  );
}
