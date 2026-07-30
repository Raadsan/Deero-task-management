"use client";

import ClientInstallmentsTable, {
  InstallmentSummaryCards,
} from "@/components/payments/ClientInstallmentsTable";
import PageDatePicker from "@/components/Shared/PageDatePicker";
import { getInstallments } from "@/lib/apis/billingApi";
import { cn } from "@/lib/utils";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";

const TABS = [
  { id: "unpaid", label: "Unpaid" },
  { id: "partial", label: "Partial" },
  { id: "all", label: "All outstanding" },
] as const;

function PaymentUnpaidContent() {
  const searchParams = useSearchParams();
  const startDate = searchParams.get("startDate") ?? "";
  const endDate = searchParams.get("endDate") ?? "";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("unpaid");

  const swrKey = ["installments-unpaid", tab, startDate, endDate];
  const { data, isLoading } = useSWR(swrKey, async () => {
    if (tab === "all") {
      const [unpaid, partial] = await Promise.all([
        getInstallments({ tab: "unpaid" }),
        getInstallments({ tab: "partial" }),
      ]);
      const rows = [
        ...(unpaid.data?.rows ?? []),
        ...(partial.data?.rows ?? []),
      ];
      const unique = Array.from(new Map(rows.map((r) => [r.id, r])).values());
      return {
        success: true,
        data: {
          rows: unique,
          summary: unpaid.data?.summary,
        },
      };
    }
    return getInstallments({ tab });
  });

  const rows = useMemo(() => {
    const list = data?.data?.rows ?? [];
    if (!startDate && !endDate) return list;

    return list.filter((row) => {
      const due = new Date(row.dueDate).getTime();
      const from = startDate ? new Date(startDate).getTime() : null;
      const to = endDate ? new Date(endDate).getTime() : null;
      if (from && due < from) return false;
      if (to && due > to) return false;
      return true;
    });
  }, [data?.data?.rows, startDate, endDate]);

  return (
    <section className="h-full w-full space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PageDatePicker classNames="mr-auto" />
        <div className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium transition",
                tab === item.id
                  ? "bg-dark-red text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <InstallmentSummaryCards summary={data?.data?.summary} />

      {isLoading ? (
        <div className="py-10 text-center text-sm text-zinc-500">Loading unpaid balances…</div>
      ) : (
        <ClientInstallmentsTable
          rows={rows}
          swrKey={swrKey}
          emptyMessage="No unpaid balances — all clients are up to date."
        />
      )}
    </section>
  );
}

export default function PaymentUnpaidPage() {
  return (
    <Suspense
      fallback={
        <div className="py-10 text-center text-sm text-zinc-500">Loading unpaid balances…</div>
      }
    >
      <PaymentUnpaidContent />
    </Suspense>
  );
}
