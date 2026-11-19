import EmployeesPerformanceReport from "@/components/reports/EmployeesPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function UsersReportPage() {
  return (
    <ManagementPageShell title="Employees Report" subtitle="Comprehensive overview of employee workload, task performance, project participation, and productivity.">
      <EmployeesPerformanceReport />
    </ManagementPageShell>
  );
}