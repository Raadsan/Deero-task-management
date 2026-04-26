import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { UploadFileSkeletonLoader } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UploadFileWrapper from "@/components/upload/UploadFileWrapper";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function UploadUserDocumentsPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bg-dark-red text-white">
      <HeaderBuilder showBlurLine headerText="Upload Documents of User" />
      <div className="flex w-full shrink-0 grow flex-col">
        <PageBreadcrumb
          links={[
            {
              title: "Users",
              link: ROUTES.users,
            },
          ]}
        />
        <div className="flex h-full w-full justify-center">
          <Suspense fallback={<UploadFileSkeletonLoader />}>
            <UploadFileWrapper params={params} />
          </Suspense>
        </div>
      </div>
    </ColumnBuilder>
  );
}
