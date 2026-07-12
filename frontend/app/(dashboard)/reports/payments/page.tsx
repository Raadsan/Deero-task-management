import DeeroReportPage from "@/components/reports/DeeroReportPage";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function PaymentsReportPage() {
  return (
    <ManagementPageShell title="Payment Report">
      <DeeroReportPage type="payments" />
    </ManagementPageShell>
  );
}
