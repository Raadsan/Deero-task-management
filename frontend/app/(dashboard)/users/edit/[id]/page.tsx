import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import EditUsersDashboard from "@/components/users/EditUsersDashboard";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function EditUserPage() {
  return (
    <ColumnBuilder headerClassNames="bannerGradinetBg text-white">
      <HeaderBuilder
        headerText="Editing The User"
        showBlurLine={false}
        showButton={false}
      />
      <div className="h-full w-full">
        <PageBreadcrumb
          links={[
            {
              title: "Users",
              link: ROUTES.users,
            },
          ]}
        />
        <Suspense fallback={<div>loading...</div>}>
          <EditUsersDashboard />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
