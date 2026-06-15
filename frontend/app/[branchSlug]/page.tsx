import LoginForm from "@/components/auth/LoginForm";
import { getPublicBranchBySlug } from "@/lib/actions/branch.action";
import { isReservedBranchSlug } from "@/lib/branch-branding";
import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ branchSlug: string }>;
};

export default async function BranchLoginPage({ params }: Props) {
  const { branchSlug } = await params;

  if (isReservedBranchSlug(branchSlug)) {
    notFound();
  }

  const branding = await getPublicBranchBySlug(branchSlug);
  if (!branding.success || !branding.data) {
    notFound();
  }

  return <LoginForm branchSlug={branchSlug} initialBranding={branding.data} />;
}
