import DeeroReportPage from "@/components/reports/DeeroReportPage";
import StaffTasksSummaryReport from "@/components/reports/StaffTasksSummaryReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function TasksReportRoutePage() {
  return (
    <ManagementPageShell title="Tasks Report">
      <div className="space-y-6">
        <DeeroReportPage type="tasks" chartsOnly />
        <StaffTasksSummaryReport />
      </div>
    </ManagementPageShell>
  );
}