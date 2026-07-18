import AppSidebarWrapper from "@/components/Shared/AppSidebarWrapper";
import BranchThemeWrapper from "@/components/branding/BranchThemeWrapper";
import DashboardAccessGuard from "@/components/dashboard/DashboardAccessGuard";
import DashboardTopBar from "@/components/dashboard/DashboardTopBar";
import { SidebarSkeletonLoader } from "@/components/Shared/Loader";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { PermissionProvider } from "@/context/PermissionContext";
import { getDashboardSession } from "@/lib/actions/portfolio.action";
import { Suspense } from "react";
import DashboardDataProvider from "@/components/providers/DashboardDataProvider";
import { cookies } from "next/headers";

export default async function DashboardShell({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { session, branding, roleId, role } = await getDashboardSession();
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  return (
    <DashboardDataProvider>
    <BranchThemeWrapper branding={branding}>
      <PermissionProvider initialRoleId={roleId} initialRole={role}>
        <DashboardAccessGuard session={session}>
          <SidebarProvider
          defaultOpen={sidebarOpen}
          style={
            {
              "--sidebar-width": "16rem",
              "--sidebar-width-icon": "5.5rem",
            } as React.CSSProperties
          }
          className="h-svh min-h-0 w-full overflow-hidden"
        >
          <div className="flex h-full min-h-0 w-full overflow-hidden">
            <Suspense fallback={<SidebarSkeletonLoader />}>
              <AppSidebarWrapper session={session} branding={branding} />
            </Suspense>
            <SidebarInset className="m-0 flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#F8F9FA] p-0">
              <DashboardTopBar user={session?.user ?? null} />
              <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
                <div className="px-2 py-4 md:px-3 lg:px-4">{children}</div>
              </main>
            </SidebarInset>
          </div>
        </SidebarProvider>
        </DashboardAccessGuard>
      </PermissionProvider>
    </BranchThemeWrapper>
    </DashboardDataProvider>
  );
}
