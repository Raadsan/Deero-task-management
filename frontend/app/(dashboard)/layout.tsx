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
    <SidebarProvider className="h-full w-full">
      <div className="flex h-full w-full shrink-0">
        <Suspense fallback={<SidebarSkeletonLoader />}>
          <AppSidebarWrapper data={data} />
        </Suspense>
        <main className="h-full w-full">
          <SidebarTrigger />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
