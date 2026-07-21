/** Shared dashboard layout & table styles (Restaurant / Trezo pattern). */

export const dashboardPageClass =
  "animate-in fade-in slide-in-from-bottom-4 duration-700 mx-1 pt-0 pb-8";

export const dashboardPageStyle = {
  fontFamily: "var(--poppinsFont), sans-serif",
} as const;

export const pageHeaderTitleClass =
  "text-2xl font-semibold text-[#1e293b] tracking-tight";

export const pageHeaderBarTitleClass =
  "text-sm font-semibold tracking-tight text-[#1e293b]";

export const pageHeaderSubtitleClass =
  "text-[12px] text-zinc-500 uppercase tracking-wider mt-1 font-medium";

export const pageHeaderWrapperClass = "mb-6 px-1";

export const dashboardTableHeaderClass =
  "table-head-brand border-b";

export const dashboardTableHeadRowClass = "hover:bg-transparent border-none";

export const dashboardTableHeadClass =
  "px-6 py-3.5 text-[11px] font-bold uppercase text-white tracking-wider border-none";

export const dashboardTableBodyRowClass =
  "border-zinc-100 hover:bg-zinc-50/50 transition-colors";

export const dashboardTableCellClass = "px-6 py-3 text-foreground";

export const dashboardTableIdClass =
  "text-[13px] font-bold text-primary";

export const dashboardStatusBadgeClass =
  "px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-md";

export const chartPrimary = "var(--color-brand-primary)";
export const chartSecondary = "var(--color-brand-secondary)";
export const chartPrimaryVariants = [
  "var(--color-brand-primary)",
  "color-mix(in srgb, var(--color-brand-primary) 82%, white)",
  "color-mix(in srgb, var(--color-brand-primary) 65%, white)",
  "color-mix(in srgb, var(--color-brand-primary) 48%, white)",
  "var(--color-brand-secondary)",
] as const;

export const chartTooltipStyle = {
  backgroundColor: "var(--color-brand-primary)",
  borderColor: "var(--color-brand-primary)",
  borderRadius: "12px",
  fontSize: "12px",
  fontWeight: 600,
  color: "#ffffff",
} as const;

export const chartAxisTick = {
  fontSize: 10,
  fontWeight: 700,
  fill: "#64748b",
} as const;

const dashboardStatIconBaseClass =
  "w-fit shrink-0 self-start p-2.5 rounded-xl text-white shadow-md shadow-primary/15 transition-all group-hover:scale-110 group-hover:brightness-105 [&_svg]:text-white";

const dashboardStatIconBgClasses = [
  "bg-primary",
  "bg-primary/90",
  "bg-primary/75",
  "bg-secondary/90",
  "bg-secondary",
] as const;

export function dashboardStatIconClass(index = 0): string {
  const bg =
    dashboardStatIconBgClasses[index % dashboardStatIconBgClasses.length];
  return `${dashboardStatIconBaseClass} ${bg}`;
}

export function getTaskStatusBadgeClass(status: string): string {
  switch (status?.toLowerCase()) {
    case "completed":
    case "done":
      return "bg-emerald-600 text-white";
    case "pending":
      return "bg-amber-500 text-white";
    case "active":
    case "inprogres":
      return "bg-blue-600 text-white";
    case "overdue":
      return "bg-rose-600 text-white";
    case "transferred":
    case "reassigned":
      return "bg-indigo-600 text-white";
    default:
      return "bg-zinc-500 text-white";
  }
}

export function formatStatusLabel(status: string): string {
  if (!status) return "—";
  const lower = status.toLowerCase();
  if (lower === "pending") return "Processing";
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export const dashboardCardClass =
  "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm";

export const dashboardControlsRowClass =
  "flex flex-wrap items-center gap-6 border-b border-zinc-50 px-8 py-4";

export const dashboardTableWrapClass =
  "overflow-hidden border-t border-zinc-100 bg-white";

export const dashboardPaginationClass =
  "flex flex-col justify-between gap-4 border-t border-zinc-100 bg-zinc-50/30 px-8 py-2 text-xs text-zinc-400 md:flex-row md:items-center";

export const dashboardSelectClass =
  "h-[42px] cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm font-normal text-zinc-600 outline-none transition-colors focus:border-primary";

export const dashboardInputClass =
  "h-[42px] w-full rounded-md border border-zinc-200 bg-zinc-50 pl-10 pr-4 text-sm font-normal text-zinc-600 outline-none transition-all placeholder:text-zinc-400 focus:border-primary focus:ring-1 focus:ring-primary/10";

export const dashboardTextPrimary =
  "text-[13px] font-medium text-zinc-700";

export const dashboardTextSecondary =
  "text-[13px] font-medium text-zinc-600";

export const dashboardLabelClass =
  "shrink-0 text-[13px] font-normal text-zinc-400";

export const actionBtnView =
  "action-icon-view h-8 w-8 rounded-lg p-0";

export const actionBtnEdit =
  "action-icon-edit h-8 w-8 rounded-lg p-0";

export const actionBtnDelete =
  "action-icon-delete h-8 w-8 rounded-lg p-0";

export const btnCreatePage =
  "btn-brand flex h-[42px] items-center gap-2 rounded-md border-none px-6 text-sm font-medium shadow-sm hover:shadow-md";

export const btnFormSubmit =
  "btn-brand h-10 min-w-[100px] rounded-md border-none px-6 text-sm font-semibold";

export const btnFormCancel =
  "h-10 min-w-[100px] rounded-md border border-zinc-200 bg-white px-6 text-sm font-semibold text-zinc-700 hover:bg-zinc-50";
