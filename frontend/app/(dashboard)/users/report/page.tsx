"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { DatePicker } from "@/components/Shared/FormElements";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { Button } from "@/components/ui/button";
import SalaryReportPrinter from "@/components/users/SalaryReportPrinter";
import { getUserSalaryReport } from "@/lib/actions/payment.action";
import { ROUTES } from "@/lib/constants";
import { useState } from "react";
import useSWR from "swr";

export default function UsersSalaryReportPage() {
  const [fromDate, setFromDate] = useState<Date | undefined>();
  const [toDate, setToDate] = useState<Date | undefined>();

  const { data: UsersSalariesReportData } = useSWR(
    ["usersSalaiesReport", fromDate ?? "", toDate ?? ""],
    () =>
      getUserSalaryReport({
        fromMonth: fromDate,
        toMonth: toDate,
      }),
  );

  return (
    <ManagementPageShell title="Salary Report">
      <PageBreadcrumb
        links={[
          {
            title: "Users",
            link: ROUTES.users,
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
      <SalaryReportPrinter items={UsersSalariesReportData?.data ?? []} />
    </ManagementPageShell>
  );
}
