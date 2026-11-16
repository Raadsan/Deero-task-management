import TasksPerformanceReport from "@/components/reports/TasksPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function TasksReportRoutePage() {
  return (
    <ManagementPageShell title="Tasks Report" subtitle="System-wide task status, assignments, and schedule.">
      <TasksPerformanceReport />
    </ManagementPageShell>
  );
}