"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import PageBreadcrumb from "@/components/Shared/PageBreadcrumb";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllClients } from "@/lib/apis/clientApi";
import { clientTypeLabel } from "@/lib/client-types";
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
import {
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { useRef } from "react";
import useSWR from "swr";
import { useReactToPrint } from "react-to-print";
import { Button } from "@/components/ui/button";

export default function ClientsReportPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "Client Summary Report",
  });

  const { data: clients = [], isLoading } = useSWR(
    SWR_CACH_KEYS.clients.key,
    async () => {
      const result = await getAllClients();
      if (!result.success) throw new Error(result.errors?.message ?? "Failed to load clients");
      return result.data ?? [];
    },
  );

  return (
    <ManagementPageShell title="Client Summary Report">
      <PageBreadcrumb links={[{ title: "Reports", link: ROUTES.reports }]} />

      <div className="mb-4 flex justify-end print:hidden">
        <Button onClick={() => handlePrint()} className="bg-dark-red text-white">
          Print report
        </Button>
      </div>

      <div ref={printRef} className="rounded-lg border border-zinc-200 bg-white p-4">
        <header className="mb-4 border-b border-zinc-100 pb-4 text-center print:mb-6">
          <h2 className="text-xl font-bold text-zinc-900">Client Summary Report</h2>
          <p className="text-sm text-zinc-500">
            {clients.length} clients · Generated {formatDate(new Date().toISOString())}
          </p>
        </header>

        <div className={dashboardTableWrapClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Client</TableHead>
                <TableHead className={dashboardTableHeadClass}>Type</TableHead>
                <TableHead className={dashboardTableHeadClass}>Phone</TableHead>
                <TableHead className={dashboardTableHeadClass}>Services</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : clients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-zinc-500">
                    No clients found.
                  </TableCell>
                </TableRow>
              ) : (
                clients.map((client) => (
                  <TableRow key={client.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={cn(dashboardTableCellClass, dashboardTextPrimary)}>
                      {client.institution}
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      {clientTypeLabel(client.clientType)}
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>{client.phone}</TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      {client.serviceAgreements?.length ?? 0}
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      {client.isActive === false ? "Inactive" : "Active"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ManagementPageShell>
  );
}
