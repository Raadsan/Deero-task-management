import TransactionView from "@/components/payments/TransactionView";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";

export default function TransactionPageView() {
  return (
    <ManagementPageShell title="Manage Transaction">
      <PageBreadcrumb
        links={[
          {
            title: "Payment",
            link: ROUTES.payments,
          },
        ]}
      />
      <TransactionView />
    </ManagementPageShell>
  );
}
