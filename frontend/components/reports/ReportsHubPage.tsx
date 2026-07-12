"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { ROUTES } from "@/lib/constants";
import {
  dashboardCardClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn } from "@/lib/utils";
import {
  BriefcaseBusiness,
  ChevronRight,
  Handshake,
  ReceiptText,
  Users,
} from "lucide-react";
import Link from "next/link";

const REPORT_CARDS = [
  {
    title: "Payment Report",
    description: "Monthly client bills — paid, partial, unpaid, charts and export.",
    href: ROUTES.reportsPayments,
    icon: ReceiptText,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    title: "Users Report",
    description: "All system users — ID, name, email, role, and status with charts and export.",
    href: ROUTES.reportsUsers,
    icon: Users,
    color: "text-blue-600 bg-blue-50",
  },
  {
    title: "Client Report",
    description: "All clients, types, budgets, and active status overview.",
    href: ROUTES.reportsClients,
    icon: Handshake,
    color: "text-violet-600 bg-violet-50",
  },
  {
    title: "Tasks Report",
    description: "Full task list with assignee, client, status, and due dates.",
    href: ROUTES.reportsTasks,
    icon: BriefcaseBusiness,
    color: "text-amber-600 bg-amber-50",
  },
];

export default function ReportsHubPage() {
  return (
    <ManagementPageShell title="Reports">
      <p className={cn("mb-6", dashboardTextSecondary)}>
        Payment, users, client, and task reports with charts, filters, CSV, PDF, and print.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORT_CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.href}
              href={card.href}
              className={cn(
                dashboardCardClass,
                "group flex flex-col gap-3 p-5 transition hover:border-primary/30 hover:shadow-md",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className={cn("rounded-lg p-2.5", card.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className="h-5 w-5 text-zinc-300 transition group-hover:text-primary" />
              </div>
              <div>
                <h2 className={cn("text-lg font-semibold", dashboardTextPrimary)}>
                  {card.title}
                </h2>
                <p className={cn("mt-1 text-sm", dashboardTextSecondary)}>
                  {card.description}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </ManagementPageShell>
  );
}
