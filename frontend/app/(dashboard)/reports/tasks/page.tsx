import DeeroReportPage from "@/components/reports/DeeroReportPage";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function TasksReportRoutePage() {
  return (
    <ManagementPageShell title="Tasks Report">
      <DeeroReportPage type="tasks" />
    </ManagementPageShell>
  );
}
