"use client";

import { ICONS } from "@/lib/constants";
import { UserSalaryReport } from "@/lib/types";
import Image from "next/image";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import ButtonBuilder from "../Shared/ButtonBuilder";

export default function SalaryReportPrinter({
  items,
}: {
  items: UserSalaryReport[];
}) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const pageStyle = `
    @page { size: letter;  margin:300px}
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      /* Ensure content stays on one page by slightly scaling */
      .print-scale { transform: scale(1); transform-origin: top center; }
      /* Avoid artificial page breaks inside blocks */
      .no-break { break-inside: avoid; page-break-inside: avoid; }
      /* Use full width, remove shadows/margins for clean PDF */
      .print-full-width { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
      .no-shadow { box-shadow: none !important; }
      .show-in-print { display: inline-block !important; }
      .hide-in-print { display: none !important; }
    }
  `;

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Salary Report",
    pageStyle,
    onAfterPrint: () => void 0,
  });

  const totalAmount = items.reduce((sum, item) => {
    const total = parseFloat(item.total) || 0;
    return sum + total;
  }, 0);

  return (
    <main className="flex h-full w-full flex-col bg-gray-50 p-6">
      <div
        ref={printRef}
        className="print-scale print-full-width no-shadow mx-auto my-8 w-full max-w-3xl rounded-lg bg-white shadow-lg"
      >
        {/* Header Information */}
        <div className="bg-secondary-200 flex items-center justify-between rounded-b-lg border-b border-gray-200 p-6 text-white">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-white/10 p-1">
              <Image
                src={ICONS.logoIcon}
                className="hide-in-print size-full rounded-full object-cover"
                width={100}
                height={100}
                alt="deero logo"
                priority
                unoptimized
              />
              <img
                src="/logo.png"
                alt="deero logo"
                className="show-in-print hidden h-full w-full rounded-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">SALARY REPORT</h1>
              <p className="text-sm opacity-80">Deero Management System</p>
            </div>
          </div>
        </div>

        <div>
          {/* Salary Table */}
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Name
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                      Paid At
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Base Salary
                    </th>
                    <th className="border border-gray-300 px-4 py-3 text-right text-sm font-semibold text-gray-700">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? (
                    items.map((item, index) => (
                      <tr
                        key={index}
                        className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
                      >
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-800">
                          {item.name}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-sm text-gray-800">
                          {item.paidAt}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-sm text-gray-800">
                          {item.baseSalary}
                        </td>
                        <td className="border border-gray-300 px-4 py-3 text-right text-sm font-medium text-gray-800">
                          {item.total}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="border border-gray-300 px-4 py-8 text-center text-sm text-gray-500"
                      >
                        No salary records found
                      </td>
                    </tr>
                  )}
                </tbody>
                {items.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-100 font-semibold">
                      <td
                        colSpan={3}
                        className="border border-gray-300 px-4 py-3 text-right text-sm text-gray-700"
                      >
                        Grand Total:
                      </td>
                      <td className="border border-gray-300 px-4 py-3 text-right text-sm text-gray-800">
                        {totalAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          <div className="border-t border-gray-200 p-6">
            <div className="mt-10 flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-500">
                  Report generated by Deero Management System
                </p>
                <p className="text-xs text-gray-500">
                  Contact Number: +252617909090
                </p>
                <p className="text-xs text-gray-500">
                  Email: derro.support@gmail.com
                </p>
                <p className="text-xs text-gray-500">
                  Address: km4, Mogadisho, Banaadir, Somalia
                </p>
              </div>
              <div className="text-right">
                <div className="border-primary mb-2 w-48 border-b-2"></div>
                <p className="text-sm text-gray-600">Authorized Signature</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mx-auto mt-6 w-fit print:hidden">
        <div className="flex items-center gap-3">
          <ButtonBuilder onClick={handlePrint} type="normal">
            Print / Save PDF
          </ButtonBuilder>
        </div>
      </div>
    </main>
  );
}
