import ClientPerformanceReport from "@/components/reports/ClientPerformanceReport";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function ClientsReportRoutePage() {
  return (
    <ManagementPageShell title="Client Report" subtitle="Complete overview of client projects, services, tasks, contracts, invoices, and balances.">
      <ClientPerformanceReport />
    </ManagementPageShell>
  );
}
