export const configCompactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export const configCompactSelectClass =
  "h-9 w-full cursor-pointer rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export const configTextareaClass =
  "min-h-[88px] w-full resize-none rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

export const configDialogShellClass =
  "flex max-h-[90vh] flex-col overflow-hidden border-zinc-200 bg-white p-0 sm:max-w-lg";

export const configDialogHeaderClass =
  "shrink-0 border-b border-zinc-100 px-6 py-4 text-left";

export const configDialogBodyClass =
  "min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4";

export const configDialogFooterClass =
  "flex shrink-0 justify-end gap-2 border-t border-zinc-100 px-6 py-4";

export const configInfoFieldClass =
  "rounded-lg border border-zinc-100 bg-zinc-50 p-3";

export const configInfoLabelClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-400";

export function preventConfigDialogClose(event: Event) {
  event.preventDefault();
}
