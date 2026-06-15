import EditUserForm from "@/components/profile/EditUserProfile";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Suspense } from "react";

export default function UserProfile() {
  return (
    <ManagementPageShell title="User Profile">
      <Suspense>
        <EditUserForm />
      </Suspense>
    </ManagementPageShell>
  );
}
