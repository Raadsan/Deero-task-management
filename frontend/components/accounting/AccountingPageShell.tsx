"use client";

import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

type Props = {
  title: string;
  section?: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

/** Matches Task Management page shell: H1, spacing, width, and typography. */
export default function AccountingPageShell({
  title,
  section: _section,
  description,
  children,
  className,
}: Props) {
  return (
    <div className={cn(dashboardPageClass, "text-zinc-900", className)} style={{ ...dashboardPageStyle, colorScheme: "light" }}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
