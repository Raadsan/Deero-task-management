import { getUserSession } from "@/lib/apis/authApi";
import { resolveSessionBranding } from "@/lib/apis/portfolioApi";
import { BranchBranding } from "@/lib/portfolio-branding";
import { AuthSession } from "@/lib/types";
import { AppSidebar } from "./AppSidebar";

type Props = {
  session?: AuthSession | null;
  branding?: BranchBranding | null;
};

export default async function AppSidebarWrapper({
  session: sessionProp,
  branding: brandingProp,
}: Props) {
  const session =
    sessionProp !== undefined
      ? sessionProp
      : (await getUserSession()).data;
  const branding =
    brandingProp !== undefined
      ? brandingProp
      : await resolveSessionBranding(session?.user);

  return <AppSidebar data={session} branding={branding} />;
}
