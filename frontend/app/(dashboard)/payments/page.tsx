import PaymentDashboard from "@/components/payments/PaymentDashboard";
import PaymentHeaderButtons from "@/components/payments/PaymentHeaderButtons";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { Suspense } from "react";

export default function PaymentsPage() {
  return (
    <ColumnBuilder>
      <HeaderBuilder headerText={"Deero Payment Dashboard"} showBlurLine={true}>
        <Suspense>
          <PaymentHeaderButtons />
        </Suspense>
      </HeaderBuilder>
      <div className="flex h-full w-full flex-col gap-[10px]">
        <Suspense>
          <PaymentDashboard />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
