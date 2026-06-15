"use client";

import PaymentReport from "@/components/payments/paymentReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { DatePicker, SelectElement } from "@/components/Shared/FormElements";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import { getPaymentReport } from "@/lib/actions/payment.action";
import { ROUTES } from "@/lib/constants";
import { useState } from "react";
import useSWR from "swr";

export default function IncomeExpenseReportPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();
  const [type, setType] = useState<"income" | "expense" | undefined>();

  const { data: reportData } = useSWR(
    ["Report", toDate ?? "", fromDate ?? "", type],
    () =>
      getPaymentReport({
        fromMonth: fromDate,
        toMonth: toDate,
        type: type ?? "income",
      }),
  );

  return (
    <ManagementPageShell title="Income & Expense Report">
      <PageBreadcrumb
        links={[
          {
            title: "Payments",
            link: ROUTES.payments,
          },
        ]}
      />
      <div className="mb-6 ml-auto flex w-fit min-w-[300px] items-center gap-3">
        <DatePicker
          date={fromDate}
          setDate={(e) => setFromDate(e)}
          labelText={"From Month"}
        />
        <DatePicker
          date={toDate}
          setDate={(e) => setToDate(e)}
          labelText={"To Month"}
        />
        <SelectElement
          labelText="Select Type"
          wrapperStyle="self-end"
          onChange={(e) => setType(e.startsWith("In") ? "income" : "expense")}
          placeholder={"Select Type"}
          elements={["Income", "Expense"]}
        />
        <Button
          onClick={() => {
            setFromDate(undefined);
            setToDate(undefined);
          }}
          className="bg-dark-red self-end px-3 py-5 text-white"
        >
          Clear Date Filters
        </Button>
      </div>
      <PaymentReport
        total={reportData?.data?.total ?? ""}
        type={type ?? "income"}
        items={reportData?.data?.items ?? []}
      />
    </ManagementPageShell>
  );
}
