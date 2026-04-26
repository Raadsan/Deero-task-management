"use client";
import { getPaymentOverviews } from "@/lib/actions/payment.action";
import { PaymentSummaryType } from "@/lib/types";
import {
  CreditCard,
  DollarSign,
  PiggyBank,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import { ReactNode } from "react";
import useSWR from "swr";
import { SummarySkeltonLoader } from "../Shared/Loader";

function getData({
  totalIncomes,
  totalExpenses,
  totalReceivables,
  totalPayables,
  tatalIncomeByCash,
  totalExpenseByCash,
  totalExpeneseByOnline,
  totalIncomeByOnline,
  totalNumberOfSalaryPaid,
}: PaymentSummaryType) {
  return [
    {
      title: "Total Income",
      value: totalIncomes,
      description:
        "This is your total income excluding recievables and salary Expenses",
      icon: <DollarSign className="h-6 w-6 scale-[2] text-green-500" />,
    },
    {
      title: "Total Expenses",
      value: totalExpenses,
      description:
        "This is your total expenses excluding paybales salary Expenses",
      icon: <CreditCard className="h-6 w-6 scale-[2] text-red-500" />,
    },
    {
      title: "Total Receivables",
      value: totalReceivables,
      description: "This is your total receivables.",
      icon: <PiggyBank className="h-6 w-6 scale-[2] text-blue-500" />,
    },
    {
      title: "Total Payables",
      value: totalPayables,
      description: "This is total amount that you have to pay.",
      icon: <WalletCards className="h-6 w-6 scale-[2] text-orange-500" />,
    },
    [
      {
        title: "Income Cash flow",
        value: tatalIncomeByCash,
        description: "This is your total Income Cashflow.",
        icon: <TrendingUp className="h-6 w-6 scale-[2] text-purple-500" />,
      },
      {
        title: "Expense Cash flow",
        value: totalExpenseByCash,
        description: "This is your total Expense Cashflow.",
        icon: <TrendingUp className="h-6 w-6 scale-[2] text-purple-500" />,
      },
    ],
    [
      {
        title: "Income Digital Flow",
        value: totalIncomeByOnline,
        description: "This is your total Income Digital Payment",
        icon: <CreditCard className="h-6 w-6 scale-[2] text-purple-500" />,
      },
      {
        title: "Expense Digital Flow",
        value: totalExpeneseByOnline,
        description: "This is your total Income Digital Payment",
        icon: <CreditCard className="h-6 w-6 scale-[2] text-purple-500" />,
      },
      {
        title: "Total Salary Expense",
        value: totalNumberOfSalaryPaid,
        description: "This is your salary Expenses Paid",
        icon: <Users className="h-6 w-6 scale-[2] text-purple-500" />,
      },
    ],
  ];
}

interface Props {
  startDate: string;
  endDate: string;
}

export default function PaymentSummary({
  startDate = "",
  endDate = "",
}: Props) {
  const { isLoading, data: results } = useSWR(
    ["payment summary", startDate, endDate],
    () => getPaymentOverviews({ startDate, endDate }),
  );

  if (isLoading) return <SummarySkeltonLoader />;

  let summaries = results?.data! as unknown as PaymentSummaryType | undefined;

  return (
    <section className="grid w-full grid-cols-1 gap-[20px] md:grid-cols-3">
      {summaries ? (
        getData(summaries).map((item, index) => {
          if (Array.isArray(item)) {
            return item.map((eachSubElement, i) => {
              return <RenderElement key={i} {...eachSubElement} />;
            });
          }
          return <RenderElement key={index} {...item} />;
        })
      ) : (
        <div>NOt data to show</div>
      )}
    </section>
  );
}

function RenderElement(item: {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <div className="flex w-full gap-4 rounded-[10px] border border-black/10 bg-white p-6 shadow-sm transition-shadow duration-300 hover:shadow-md">
      <div className="flex w-full flex-col gap-[15px]">
        <h3 className="text-lg font-semibold">{item.title}</h3>
        <p className="text-2xl font-bold">{item.value}</p>
        <p className="text-sm text-gray-500">{item.description}</p>
      </div>
      <div className="flex items-center justify-center">{item.icon}</div>
    </div>
  );
}
