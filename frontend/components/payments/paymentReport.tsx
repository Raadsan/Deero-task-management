import { ICONS } from "@/lib/constants";
import { ReportType } from "@/lib/types";
import Image from "next/image";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import ButtonBuilder from "../Shared/ButtonBuilder";

interface Props {
  type: "income" | "expense";
  items: Array<ReportType>;
  total: string;
}
export default function PaymentReport({ total, type, items }: Props) {
  const printRef = useRef<HTMLDivElement | null>(null);
  const pageStyle = `
    @page { size: letter; margin: 20mm }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none !important; }
      .print-scale { transform: scale(1); transform-origin: top center; }
      .print-full-width { max-width: 100% !important; width: 100% !important; margin: 0 !important; }
      .no-shadow { box-shadow: none !important; }
      .show-in-print { display: inline-block !important; }
      .hide-in-print { display: none !important; }
    }
  `;

  const getDocumentTitle = () => {
    return type === "expense" ? "Expense Report" : "Income Report";
  };

  const getHeaderTitle = () => {
    return type === "expense" ? "EXPENSE REPORT" : "INCOME REPORT";
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: getDocumentTitle(),
    pageStyle,
    onAfterPrint: () => void 0,
  });

  const tableColumns = [
    "Date",
    type == "income" ? "Income type" : "Expense Type",
    "Amount",
  ];

  return (
    <main className="flex h-full w-full flex-col bg-gray-50 p-6">
      <div
        ref={printRef}
        className="print-scale print-full-width no-shadow mx-auto my-8 w-full rounded-lg bg-white shadow-lg"
      >
        {/* Header Information */}
        <div className="bg-secondary-200 flex items-center justify-between rounded-t-lg border-b border-gray-200 p-4 text-white">
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
              <h1 className="text-xl font-bold">{getHeaderTitle()}</h1>
              <p className="text-xs opacity-80">Deero Management System</p>
            </div>
            <span className="ml-auto rounded bg-white/10 px-2 py-0.5 text-xs font-semibold tracking-wide italic">
              Disclaimer: This report includes only{" "}
              <span className="underline">{'"Paid"'}</span>{" "}
              {type === "expense" ? "expenses" : "incomes"}.
            </span>
          </div>
        </div>

        {/* Simple type header */}
        <div className="border-b border-gray-200 px-4 py-3 text-xs font-semibold text-gray-800">
          {type === "income" ? "Income Report" : "Expense Report"}
        </div>

        {/* Table Section */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b-2 border-gray-300 bg-gray-100">
                {tableColumns.map((col) => (
                  <th
                    key={col}
                    className="border border-gray-300 px-2 py-2 text-left font-semibold text-gray-700"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((item: ReportType, index: number) => (
                <tr
                  key={index}
                  className="border-b border-gray-200 hover:bg-gray-50"
                >
                  <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap text-gray-800">
                    {item.Date || item.date || "-"}
                  </td>
                  <td className="border border-gray-300 px-2 py-1.5 whitespace-nowrap text-gray-800">
                    {item["Expense Type"] ||
                      item["Income Type"] ||
                      item.expenseType ||
                      item.incomeType ||
                      "-"}
                  </td>

                  <td className="border border-gray-300 px-2 py-1.5 text-right whitespace-nowrap text-gray-800">
                    ${item.Amount}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="border-t-2 border-gray-400 bg-gray-100 font-bold">
                <td
                  colSpan={3}
                  className="border border-gray-300 px-2 py-2 text-right text-gray-800"
                >
                  Total Actual {type === "expense" ? "Expenses" : "Income"}
                </td>
                <td className="border border-gray-300 px-2 py-2 text-right text-gray-800">
                  ${total}
                </td>
                <td className="border border-gray-300 px-2 py-2"></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="mt-4 border-t border-gray-200 px-4 py-3">
          <div className="flex items-end justify-between text-xs">
            <div className="text-gray-500">
              <p>Generated by Deero Management System</p>
              <p>Contact: +252617909090 | Email: derro.support@gmail.com</p>
            </div>
            <div className="text-right">
              <div className="border-primary mb-1 w-32 border-b-2"></div>
              <p className="text-gray-600">Authorized Signature</p>
            </div>
          </div>
        </div>
      </div>

      <div className="no-print mx-auto mt-6 w-fit print:hidden">
        <ButtonBuilder onClick={handlePrint} type="normal">
          Print / Save PDF
        </ButtonBuilder>
      </div>
    </main>
  );
}
