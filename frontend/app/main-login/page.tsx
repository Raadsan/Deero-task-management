import LoginForm from "@/components/auth/LoginForm";
import { getMainBranchBranding } from "@/lib/actions/branch.action";
import { Suspense } from "react";

export default async function MainLoginPage() {
  const branding = await getMainBranchBranding();

  return (
    <Suspense>
      <LoginForm
        initialBranding={branding.success ? branding.data : null}
        isRootLogin
      />
    </Suspense>
  );
}
