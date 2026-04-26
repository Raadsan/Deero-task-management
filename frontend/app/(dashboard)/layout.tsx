import AppSidebarWrapper from "@/components/Shared/AppSidebarWrapper";
import { SidebarSkeletonLoader } from "@/components/Shared/Loader";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Suspense } from "react";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <SidebarProvider className="h-full w-full">
      <div className="flex h-full w-full shrink-0">
        <Suspense fallback={<SidebarSkeletonLoader />}>
          <AppSidebarWrapper />
        </Suspense>
        <main className="h-full w-full">
          <SidebarTrigger />
          {children}
        </main>
      </div>
    </SidebarProvider>
  );
}
