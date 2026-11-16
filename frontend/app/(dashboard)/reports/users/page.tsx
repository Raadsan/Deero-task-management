import EmployeesPerformanceReport from "@/components/reports/EmployeesPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function UsersReportPage() {
  return (
    <ManagementPageShell title="Employees Report" subtitle="Assigned projects, task status, and service performance for the selected period.">
      <EmployeesPerformanceReport />
    </ManagementPageShell>
  );
}