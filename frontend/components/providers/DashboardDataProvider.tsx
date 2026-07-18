"use client";

import { SWRConfig } from "swr";

export default function DashboardDataProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <SWRConfig
      value={{
        dedupingInterval: 5 * 60 * 1000,
        focusThrottleInterval: 5 * 60 * 1000,
        keepPreviousData: true,
        revalidateIfStale: false,
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        shouldRetryOnError: false,
      }}
    >
      {children}
    </SWRConfig>
  );
}
