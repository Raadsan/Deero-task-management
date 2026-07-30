import SalaryDetailsAndForm from "@/components/payments/SalaryDetailsAndForm";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { getUserById } from "@/lib/apis/userApi";
import { Suspense } from "react";

export default function EmployeeSalaryPage({ params }: PageParams) {
  return (
    <ManagementPageShell title="Employee Salary Management">
      <PageBreadcrumb
        links={[
          {
            title: "Staff",
            link: ROUTES.users,
          },
        ]}
      />
      <Suspense fallback={<ClientFormSkeleton />}>
        <EmployeeSalaryDetails params={params} />
      </Suspense>
    </ManagementPageShell>
  );
}

async function EmployeeSalaryDetails({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const { data: employee } = await getUserById(id);
  return <SalaryDetailsAndForm user={employee} />;
}
