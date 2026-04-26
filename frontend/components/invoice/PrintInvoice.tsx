"use client";

import { ICONS } from "@/lib/constants";
import { InvoiceType } from "@/lib/types";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { useRef } from "react";
import { useReactToPrint } from "react-to-print";
import ButtonBuilder from "../Shared/ButtonBuilder";

export default function PrintInvoice({
  items,
  description,
  headerInfo,
  type = "invoice",
}: InvoiceType & {
  type?: "userTasks" | "clients" | "users" | "expense" | "income" | "invoice";
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

  const getDocumentTitle = () => {
    if (type === "invoice") {
      return headerInfo?.id ? `Invoice-${headerInfo.id}` : "Invoice";
    }
    const titles = {
      userTasks: "Tasks Report",
      users: "Users Report",
      expense: "Expense Report",
      income: "Income Report",
      clients: "Clients Report",
    };
    return titles[type] || "Report";
  };

  const getHeaderTitle = () => {
    const titles = {
      invoice: "INVOICE",
      userTasks: "TASKS REPORT",
      users: "USERS REPORT",
      expense: "EXPENSE REPORT",
      income: "INCOME REPORT",
      clients: "Clients Report",
    };
    return titles[type] || "REPORT";
  };

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: getDocumentTitle(),
    pageStyle,
    onAfterPrint: () => void 0,
  });

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
              <h1 className="text-2xl font-bold">{getHeaderTitle()}</h1>
              <p className="text-sm opacity-80">Deero Management System</p>
            </div>
          </div>
          {headerInfo?.id && (
            <div className="text-right">
              <p className="text-xl font-bold text-white/90">
                #Ref {headerInfo.id}
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="grid grid-cols-2 gap-6 border-b border-gray-200 p-6">
            <div className="space-y-2">
              <div className="flex items-center">
                <h2 className="me-2.5 text-sm font-medium text-gray-500 uppercase">
                  Date Issued:
                </h2>
                <p className="font-semibold text-gray-800">
                  {headerInfo?.createdAt}
                </p>
              </div>
            </div>
            <div className="border-l border-gray-200 pl-6">
              <h2 className="text-sm font-medium text-gray-500 uppercase">
                Bill To:
              </h2>
              <div className="ml-[50px]">
                <p className="text-gray-800">{headerInfo?.clientName}</p>
                <p className="text-gray-600">{headerInfo?.email}</p>
                <p className="text-gray-600">{headerInfo?.phone}</p>
                <p className="text-gray-600">Mogadisho, Banaadir, Somalia</p>
              </div>
            </div>
          </div>

          <div className="py-6 text-xs">
            <div className="space-y-2.5">
              {items.map((each, index) => {
                return (
                  <div
                    className="space-y-2.5 rounded-[10px] border border-black/10"
                    key={index}
                  >
                    {Object.entries(each).map((eachItem, index) => {
                      const [key, value] = eachItem;
                      return (
                        <div
                          key={index}
                          className={cn(
                            "grid grid-cols-2 px-4 py-1",
                            index % 2 === 0 ? "bg-gray-50" : "bg-gray-100",
                          )}
                        >
                          <div className="text-gray-800 capitalize">{key}</div>
                          <div className="text-right font-medium text-gray-800">
                            {value}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3">
            <h3 className="mb-2 text-sm font-semibold text-gray-800">
              Description
            </h3>
            <div className="text-xs whitespace-pre-line text-gray-700">
              {description?.trim().length > 0 ? (
                description
              ) : (
                <span className="text-gray-400 italic">Not provided</span>
              )}
            </div>
          </div>

          <div className="border-t border-gray-200 p-6">
            <div className="mt-10 flex items-end justify-between">
              <div>
                <p className="text-xs text-gray-500">
                  Invoice generated by Deero Management System
                </p>
                <p className="text-xs text-gray-500">
                  contact Number: +252617909090
                </p>
                <p className="text-xs text-gray-500">
                  Email:derro.support@gmail.com
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
