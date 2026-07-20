import DeeroReportPage from "@/components/reports/DeeroReportPage";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";

export default function UsersReportPage() {
  return (
    <ManagementPageShell title="Users Report">
      <DeeroReportPage type="users" />
    </ManagementPageShell>
  );
}