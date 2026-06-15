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
  children: ReactNode;
  className?: string;
}

export default function ManagementPageShell({
  title,
  children,
  className,
}: Props) {
  return (
    <div className={cn(dashboardPageClass, className)} style={dashboardPageStyle}>
      <div className={pageHeaderWrapperClass}>
        <h1 className={pageHeaderTitleClass}>{title}</h1>
      </div>
      {children}
    </div>
  );
}
