"use client";

import UserTaskReport from "@/components/tasks/UserTaskReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { dashboardTextSecondary } from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";

export default function EmployeeTasksReportPage() {
  return (
    <ManagementPageShell title="Employee Tasks Report">
      <PageBreadcrumb links={[{ title: "Reports", link: ROUTES.reports }]} />
      <p className={cn("mb-6", dashboardTextSecondary)}>
        Select an employee to open their task productivity report with date filters.
      </p>
      <UserTaskReport />
    </ManagementPageShell>
  );
}
