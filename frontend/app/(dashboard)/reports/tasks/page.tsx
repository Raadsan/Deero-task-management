import TasksPerformanceReport from "@/components/reports/TasksPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function TasksReportRoutePage() {
  return (
    <ManagementPageShell title="Tasks Report" subtitle="Comprehensive overview of task performance, assignments, completion, and overdue work.">
      <TasksPerformanceReport />
    </ManagementPageShell>
  );
}