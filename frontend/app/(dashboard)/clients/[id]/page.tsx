import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { ViewClientDashboardSkeletonLoader } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import ViewCLientDashboard from "@/components/clients/ViewCLientDashboard";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function ViewClientPage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        link={ROUTES.createClient}
        showBlurLine
        headerText="Manage The All Service Categories of User"
        showButton={false}
      />
      <div className="h-full w-full">
        <PageBreadcrumb
          links={[
            {
              title: "Clients",
              link: ROUTES.clients,
            },
          ]}
        />
        <Suspense fallback={<ViewClientDashboardSkeletonLoader />}>
          <ViewCLientDashboard params={params} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
