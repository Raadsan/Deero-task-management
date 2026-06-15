import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { UploadFileSkeletonLoader } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UploadFileWrapper from "@/components/upload/UploadFileWrapper";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function UploadUserDocumentsPage({ params }: PageParams) {
  return (
    <ManagementPageShell title="Upload Documents">
      <PageBreadcrumb
        links={[
          {
            title: "Users",
            link: ROUTES.users,
          },
        ]}
      />
      <div className="flex w-full justify-center">
        <Suspense fallback={<UploadFileSkeletonLoader />}>
          <UploadFileWrapper params={params} />
        </Suspense>
      </div>
    </ManagementPageShell>
  );
}
