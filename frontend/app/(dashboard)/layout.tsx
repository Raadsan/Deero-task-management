import AppSidebarWrapper from "@/components/Shared/AppSidebarWrapper";
import Header from "@/components/Shared/Header";
import { SidebarSkeletonLoader } from "@/components/Shared/Loader";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Suspense } from "react";
import { getUserSession } from "@/lib/actions/auth.action";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { data } = await getUserSession();

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "200px",
        } as React.CSSProperties
      }
      className="h-full w-full"
    >
      <div className="flex h-full w-full shrink-0 gap-0 p-0">
        <Suspense fallback={<SidebarSkeletonLoader />}>
          <AppSidebarWrapper />
        </Suspense>
        <SidebarInset className="h-full w-full p-0 m-0">
          {children}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
