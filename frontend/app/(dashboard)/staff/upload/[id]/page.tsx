import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { UploadFileSkeletonLoader } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UploadUserDocumentsForm from "@/components/upload/UploadUserDocumentsForm";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function UploadEmployeeDocumentsPage({ params }: PageParams) {
  return (
    <ManagementPageShell title="Upload Documents">
      <PageBreadcrumb
        links={[
          {
            title: "Staff",
            link: ROUTES.users,
          },
        ]}
      />
      <div className="flex w-full justify-center">
        <Suspense fallback={<UploadFileSkeletonLoader />}>
          <EmployeeUploadForm params={params} />
        </Suspense>
      </div>
    </ManagementPageShell>
  );
}

async function EmployeeUploadForm({
  params,
}: {
  params: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  return <UploadUserDocumentsForm userId={id} />;
}
