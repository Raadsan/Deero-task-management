import ClientPerformanceReport from "@/components/reports/ClientPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function ClientsReportRoutePage() {
  return (
    <ManagementPageShell title="Client Report" subtitle="Projects, contract quantities, and completed work for the selected client and cycle.">
      <ClientPerformanceReport />
    </ManagementPageShell>
  );
}
