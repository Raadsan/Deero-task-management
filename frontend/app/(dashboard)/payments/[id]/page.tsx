import TransactionView from "@/components/payments/TransactionView";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";

export default function TransactionPageView() {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText={"Manage Current Transaction"}
        showBlurLine={false}
      />
      <div className="size-full">
        <PageBreadcrumb
          links={[
            {
              title: "Payment",
              link: ROUTES.payments,
            },
          ]}
        />
        <TransactionView />
      </div>
    </ColumnBuilder>
  );
}
