"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogRecord, getAuditLogs } from "@/lib/actions/config.action";
import { authClient } from "@/lib/auth-client";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnView,
  dashboardCardClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { cn, formatDate } from "@/lib/utils";
import { Eye, Loader2, Search } from "lucide-react";
import { useMemo, useState } from "react";
import useSWR from "swr";
import ConfigInfoField from "@/components/config/ConfigInfoField";
import {
  configCompactInputClass,
  configDialogBodyClass,
  configDialogFooterClass,
  configDialogHeaderClass,
  configDialogShellClass,
  preventConfigDialogClose,
} from "@/components/config/config-dialog-styles";

export default function TrackingConfigRoute() {
  const session = authClient.useSession();
  const scopeKey = `${session.data?.user.role ?? ""}:${session.data?.user.portfolioId ?? "all"}`;
  const { data, isLoading } = useSWR(
    [SWR_CACH_KEYS.tracking.key, scopeKey],
    getAuditLogs,
  );
  const logs = (data?.data as AuditLogRecord[]) ?? [];

  const [search, setSearch] = useState("");
  const [viewOpen, setViewOpen] = useState(false);
  const [viewLog, setViewLog] = useState<AuditLogRecord | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return logs;
    return logs.filter((log) => {
      return (
        log.action.toLowerCase().includes(query) ||
        log.entity.toLowerCase().includes(query) ||
        (log.description ?? "").toLowerCase().includes(query) ||
        (log.user?.name ?? "").toLowerCase().includes(query) ||
        (log.user?.email ?? "").toLowerCase().includes(query)
      );
    });
  }, [logs, search]);

  function openView(log: AuditLogRecord) {
    setViewLog(log);
    setViewOpen(true);
  }

  function closeView() {
    setViewOpen(false);
  }

  return (
    <ManagementPageShell title="Tracking">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-3 border-b border-zinc-50 px-6 py-3">
          <span className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-sm text-zinc-500">
            <span className="font-semibold text-zinc-800">{filtered.length}</span> of{" "}
            {logs.length} logs
          </span>
          <div className="group relative ml-auto w-52 min-w-[12rem]">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(configCompactInputClass, "pl-9")}
            />
          </div>
        </div>

        <div className={dashboardTableWrapClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                <TableHead className={dashboardTableHeadClass}>Date</TableHead>
                <TableHead className={dashboardTableHeadClass}>User</TableHead>
                <TableHead className={dashboardTableHeadClass}>Action</TableHead>
                <TableHead className={dashboardTableHeadClass}>Entity</TableHead>
                <TableHead className={dashboardTableHeadClass}>Description</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-8 text-center">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <Loader2 className="size-4 animate-spin" />
                      Loading...
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="px-6 py-10 text-center text-muted-foreground">
                    No activity logs found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((log) => (
                  <TableRow key={log.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTextSecondary}>
                        {formatDate(log.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTextPrimary}>
                        {log.user?.name || log.user?.email || "System"}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>{log.action}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{log.entity}</TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className="line-clamp-1 text-zinc-600">
                        {log.description || "â€”"}
                      </span>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={actionBtnView}
                        onClick={() => openView(log)}
                        title="View"
                      >
                        <Eye className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog
        open={viewOpen}
        onOpenChange={(open) => {
          if (!open) closeView();
          else setViewOpen(true);
        }}
      >
        <DialogContent
          className={configDialogShellClass}
          onInteractOutside={preventConfigDialogClose}
          onEscapeKeyDown={preventConfigDialogClose}
        >
          <DialogHeader className={configDialogHeaderClass}>
            <DialogTitle>Activity Details</DialogTitle>
            <DialogDescription>Full audit log record</DialogDescription>
          </DialogHeader>
          {viewLog ? (
            <div className={configDialogBodyClass}>
              <ConfigInfoField label="Date" value={formatDate(viewLog.createdAt)} />
              <ConfigInfoField
                label="User"
                value={viewLog.user?.name || viewLog.user?.email || "System"}
              />
              {viewLog.user?.email ? (
                <ConfigInfoField label="Email" value={viewLog.user.email} />
              ) : null}
              <div className="grid gap-3 sm:grid-cols-2">
                <ConfigInfoField label="Action" value={viewLog.action} />
                <ConfigInfoField label="Entity" value={viewLog.entity} />
              </div>
              {viewLog.entityId ? (
                <ConfigInfoField label="Entity ID" value={viewLog.entityId} />
              ) : null}
              <ConfigInfoField
                label="Description"
                value={viewLog.description || "â€”"}
              />
              <ConfigInfoField label="Log ID" value={viewLog.id} />
            </div>
          ) : null}
          <div className={configDialogFooterClass}>
            <Button type="button" onClick={closeView}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </ManagementPageShell>
  );
}
