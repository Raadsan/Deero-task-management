import ClientForm from "@/components/clients/ClientForm";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function CreateClientPage() {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText="Creating Client"
        showBlurLine={false}
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
        <Suspense>
          <ClientForm formType={"create"} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
