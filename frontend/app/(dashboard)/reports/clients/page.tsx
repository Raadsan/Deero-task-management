import DeeroReportPage from "@/components/reports/DeeroReportPage";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function ClientsReportRoutePage() {
  return (
    <ManagementPageShell title="Client Report">
      <DeeroReportPage type="clients" />
    </ManagementPageShell>
  );
}
