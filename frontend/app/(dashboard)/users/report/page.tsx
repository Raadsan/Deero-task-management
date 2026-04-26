"use client";

import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import { DatePicker } from "@/components/Shared/FormElements";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
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

  const { isLoading, data: UsersSalariesReportData } = useSWR(
    ["usersSalaiesReport", fromDate ?? "", toDate ?? ""],
    () =>
      getUserSalaryReport({
        fromMonth: fromDate,
        toMonth: toDate,
      }),
  );

  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText="Salary Report Generation"
        showBlurLine={false}
        showButton={false}
      />

      <div className="w-full px-[30px] py-[20px]">
        <PageBreadcrumb
          links={[
            {
              title: "users",
              link: ROUTES.users,
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
      </div>
    </ColumnBuilder>
  );
}
