import EditUserForm from "@/components/profile/EditUserProfile";
import ColumnBuilder from "@/components/Shared/ColumnBuilder";
import HeaderBuilder from "@/components/Shared/HeaderBuilder";
import { Suspense } from "react";

export default function UserProfile() {
  return (
    <ColumnBuilder>
      <HeaderBuilder headerText={"User Profile"} showBlurLine={false} />
      <Suspense>
        <EditUserForm />
      </Suspense>
    </ColumnBuilder>
  );
}
