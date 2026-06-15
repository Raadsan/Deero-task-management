import { ReactNode } from "react";

type AuthPageShellProps = {
  children: ReactNode;
};

export const authCardClassName =
  "relative w-full rounded-2xl border border-black/10 bg-white p-8 shadow-lg";

export const authFieldClassName =
  "w-full rounded-xl border border-black/10 bg-neutral-50 py-3 pr-4 pl-10 text-sm transition-all placeholder:text-neutral-400 focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

export default function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-neutral-50 px-4 py-12">
      {children}
    </div>
  );
}
