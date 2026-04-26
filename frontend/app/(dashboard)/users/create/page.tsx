import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import UserForm from "@/components/users/UsersForm";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function CreateUserPage() {
  return (
    <ColumnBuilder headerClassNames="bg-dark-red text-white">
      <HeaderBuilder
        headerText="Creating User"
        showBlurLine={false}
        showButton={false}
      />
      <div className="w-full px-[30px] py-5">
        <PageBreadcrumb
          links={[
            {
              title: "Users",
              link: ROUTES.users,
            },
          ]}
        />
        <Suspense>
          <UserForm formType={"create"} data={undefined} />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
