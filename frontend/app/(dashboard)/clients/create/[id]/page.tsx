import AddServiceWrapper from "@/components/clients/AddServiceWrapper";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { ClientFormSkeleton } from "@/components/Shared/Loader";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { PageParams } from "@/lib/types";
import { Suspense } from "react";

export default function AddServicePage({ params }: PageParams) {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText={`Create Another Service For The Cient`}
        showBlurLine
        showButton={false}
      />
      <div className="w-full px-[30px] py-[20px]">
        <PageBreadcrumb
          links={[
            {
              title: "Clients",
              link: ROUTES.clients,
            },
          ]}
        />
        <Suspense fallback={<ClientFormSkeleton />}>
          <AddServiceWrapper params={params} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
