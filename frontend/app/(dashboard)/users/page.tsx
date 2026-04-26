import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { GeneralTableSkeletonLoader } from "@/components/Shared/Loader";
import UsersHeaderButtons from "@/components/users/UsersHeaderButtons";
import UsersTable from "@/components/users/UsersTable";
import { ROUTES } from "@/lib/constants";
import { Suspense } from "react";

export default function UserPage() {
  return (
    <ColumnBuilder>
      <HeaderBuilder
        link={ROUTES.createUser}
        showBlurLine
        headerText="User Management"
      >
        <UsersHeaderButtons />
      </HeaderBuilder>
      <div className="flex w-full shrink-0 grow flex-col">
        <Suspense fallback={<GeneralTableSkeletonLoader />}>
          <UsersTable />
        </Suspense>
      </div>
    </ColumnBuilder>
  );
}
