import {
  pageHeaderSubtitleClass,
  pageHeaderTitleClass,
  pageHeaderWrapperClass,
} from "@/lib/dashboard-ui";

interface PageHeaderProps {
  title: string;
  subtitle: string;
  className?: string;
}

export function PageHeader({ title, subtitle, className }: PageHeaderProps) {
  return (
    <div className={className ?? pageHeaderWrapperClass}>
      <h1 className={pageHeaderTitleClass}>{title}</h1>
      <p className={pageHeaderSubtitleClass}>{subtitle}</p>
    </div>
  );
}
