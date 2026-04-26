import { getUserSession } from "@/lib/actions/auth.action";
import { AppSidebar } from "./AppSidebar";

export default async function AppSidebarWrapper() {
  const { data } = await getUserSession();

  return <AppSidebar data={data} />;
}
