import {
  dashboardPageClass,
  dashboardPageStyle,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import { ReactNode } from "react";

interface Props {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
}

export default function ManagementPageShell({
  title,
  subtitle,
  children,
  className,
}: Props) {
  return (
    <div className={cn(dashboardPageClass, className)} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>{title}</h1>
        {subtitle ? (
          <p className="mt-1 text-xs font-medium text-zinc-500">{subtitle}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}
