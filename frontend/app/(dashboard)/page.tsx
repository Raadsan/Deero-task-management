"use client";

import AdminDashboard from "@/components/dashboard/AdminDashboard";
import { Suspense } from "react";

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 animate-pulse px-1">
          <div className="h-20 rounded-xl bg-muted/20" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-muted/20" />
            ))}
          </div>
        </div>
      }
    >
      <AdminDashboard />
    </Suspense>
  );
}
