"use client";

import PaymentReport from "@/components/payments/paymentReport";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import { DatePicker, SelectElement } from "@/components/Shared/FormElements";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
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

  const { isLoading, data: reportData } = useSWR(
    ["Report", toDate ?? "", fromDate ?? "", type],
    () =>
      getPaymentReport({
        fromMonth: fromDate,
        toMonth: toDate,
        type: type ?? "income",
      }),
  );
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText="Income and Expenses Report Generation"
        showBlurLine={false}
        showButton={false}
      />

      <div className="w-full px-[30px] py-[20px]">
        <PageBreadcrumb
          links={[
            {
              title: "Payments dashboard",
              link: ROUTES.tasks,
            },
          ]}
        />
        <div className="ml-auto flex h-full w-fit min-w-[300px] items-center gap-3">
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
      </div>
    </ColumnBuilder>
  );
}
