"use client";

import ProjectDetailsModal from "@/components/projects/ProjectDetailsModal";
import ProjectRegistrationModal from "@/components/projects/ProjectRegistrationModal";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  archiveProject,
  deleteProject,
  getAllProjects,
  getProjectSummary,
  ProjectRecord,
} from "@/lib/apis/projectApi";
import { PROJECT_STATUS_OPTIONS, PROJECT_TYPE_OPTIONS } from "@/lib/project-options";
import { getAllClientsClient } from "@/lib/apis/readApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  btnCreatePage,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
  dashboardStatusBadgeClass,
  dashboardTableBodyRowClass,
  dashboardTableCellClass,
  dashboardTableHeadClass,
  dashboardTableHeaderClass,
  dashboardTableHeadRowClass,
  dashboardTableIdClass,
  dashboardTableWrapClass,
  dashboardTextPrimary,
  dashboardTextSecondary,
} from "@/lib/dashboard-ui";
import { currentProjectCycleId, summarizeProjectTasks, tasksForProjectCycle } from "@/lib/project-schedule";
import { useNow } from "@/lib/use-now";
import { cn, formatDate } from "@/lib/utils";
import { Archive, Eye, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const selectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none";

export default function ProjectsManagementPage() {
  const { mutate: globalMutate } = useSWRConfig();
  const { data: projectsRes, isLoading, mutate } = useSWR(SWR_CACH_KEYS.projects.key, getAllProjects, { refreshInterval: 15000 });
  const now = useNow();
  const { data: summaryRes } = useSWR("project-summary", getProjectSummary);
  const { data: clientsRes } = useSWR("project-clients", getAllClientsClient);
  const projects = (projectsRes?.success ? projectsRes.data ?? [] : []) as ProjectRecord[];
  const summary = summaryRes?.data;
  const clients = (clientsRes?.data ?? []) as Array<{ id: string; institution?: string }>;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>();
  const [viewId, setViewId] = useState<string | undefined>();
  const [archiveId, setArchiveId] = useState<ProjectRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectRecord | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      const status = project.lifecycleStatus || project.status;
      const type = project.billingMode || "ONE_TIME";
      if (statusFilter !== "all" && status !== statusFilter) return false;
      if (typeFilter !== "all" && type !== typeFilter) return false;
      if (clientFilter !== "all" && project.clientId !== clientFilter) return false;
      if (fromDate && project.startDate && project.startDate.slice(0, 10) < fromDate) return false;
      if (!query) return true;
      return (
        project.name.toLowerCase().includes(query) ||
        (project.projectCode || project.id).toLowerCase().includes(query) ||
        (project.client?.institution || "").toLowerCase().includes(query)
      );
    });
  }, [projects, search, statusFilter, typeFilter, clientFilter, fromDate]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
  useEffect(() => setPage(1), [search, statusFilter, typeFilter, clientFilter, fromDate, pageSize]);

  const cards = [
    ["Total", summary?.total ?? projects.length],
    ["Active", summary?.active ?? 0],
    ["Monthly", summary?.monthly ?? 0],
    ["One-Time", summary?.oneTime ?? 0],
    ["Completed", summary?.completed ?? 0],
    ["On Hold", summary?.onHold ?? 0],
  ];

  return (
    <ManagementPageShell title="Projects Management">
      <div className="mb-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-zinc-100 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-zinc-400">{label}</p>
            <p className="text-2xl font-semibold text-zinc-800">{value}</p>
          </div>
        ))}
      </div>
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-2 border-b border-zinc-50 px-6 py-3">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select className={cn("w-16", selectClass)} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
              {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <select className={selectClass} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All types</option>
            {PROJECT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={selectClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All statuses</option>
            {PROJECT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select className={selectClass} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((client) => <option key={client.id} value={client.id}>{client.institution}</option>)}
          </select>
          <input type="date" className={selectClass} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <div className="relative ml-auto w-56">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input className="h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pr-3 pl-9 text-sm" placeholder="Search name, ID, client" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Button type="button" className={cn(btnCreatePage, "h-9")} onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> Create Project
          </Button>
        </div>
        <div className={dashboardTableWrapClass}>
          <Table>
            <TableHeader className={dashboardTableHeaderClass}>
              <TableRow className={dashboardTableHeadRowClass}>
                {["Project ID", "Project Name", "Client", "Contract", "Type", "Start", "End", "Progress", "Status", "Actions"].map((heading) => (
                  <TableHead key={heading} className={dashboardTableHeadClass}>{heading}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="px-6 py-8 text-center">Loading projects…</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="px-6 py-8 text-center text-zinc-500">No projects found</TableCell></TableRow>
              ) : rows.map((project) => {
                const cycleId = project.billingMode === "MONTHLY" ? currentProjectCycleId(project.cycles, now) : "";
                const scopedTasks = cycleId
                  ? tasksForProjectCycle(project.tasks ?? [], cycleId, true)
                  : project.tasks ?? [];
                const progress = summarizeProjectTasks(scopedTasks, now);
                const percent = project._count?.tasks && !project.tasks ? "—" : `${progress.percent}%`;
                return (
                  <TableRow key={project.id} className={dashboardTableBodyRowClass}>
                    <TableCell className={dashboardTableCellClass}><span className={dashboardTableIdClass}>{project.projectCode || project.id.slice(0, 8)}</span></TableCell>
                    <TableCell className={dashboardTableCellClass}><span className={dashboardTextPrimary}>{project.name}</span></TableCell>
                    <TableCell className={dashboardTableCellClass}>{project.client?.institution || "—"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{project.primaryContract?.contractNumber || "—"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{project.billingMode === "MONTHLY" ? "Monthly" : "One-Time"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{project.startDate ? formatDate(project.startDate) : "—"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{project.dueDate ? formatDate(project.dueDate) : "—"}</TableCell>
                    <TableCell className={dashboardTableCellClass}>{percent}</TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardStatusBadgeClass}>{project.lifecycleStatus || project.status}</span>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "text-right")}>
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="sm" className={actionBtnView} onClick={() => setViewId(project.id)}><Eye className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" className={actionBtnEdit} onClick={() => setEditId(project.id)}><Pencil className="size-4" /></Button>
                        <Button type="button" variant="ghost" size="sm" className={actionBtnView} onClick={() => setArchiveId(project)} title="Archive project">
                          <Archive className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={actionBtnDelete}
                          title="Delete project"
                          onClick={() => setDeleteTarget(project)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          <div className={dashboardPaginationClass}>
            <span className={dashboardTextSecondary}>{filtered.length} projects</span>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span>Page {page} of {totalPages}</span>
              <Button type="button" variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        </div>
      </div>
      <ProjectRegistrationModal
        open={createOpen || Boolean(editId)}
        projectId={editId}
        onOpenChange={(open) => {
          if (!open) {
            setCreateOpen(false);
            setEditId(undefined);
          }
        }}
      />
      <ProjectDetailsModal open={Boolean(viewId)} projectId={viewId} onOpenChange={(open) => !open && setViewId(undefined)} />
      <ConfirmDialog
        open={Boolean(archiveId)}
        onOpenChange={(open) => !open && setArchiveId(null)}
        title="Archive project?"
        description={archiveId ? `Archive ${archiveId.name}? Historical tasks stay in the database.` : ""}
        confirmLabel="Archive"
        onConfirm={async () => {
          if (!archiveId) return;
          const result = await archiveProject(archiveId.id);
          if (!result.success) toast.error(result.errors?.message || "Could not archive");
          else {
            toast.success("Project archived");
            setArchiveId(null);
            await mutate();
            await globalMutate("project-summary");
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteLoading) setDeleteTarget(null);
        }}
        title="Delete Project?"
        destructive
        loading={deleteLoading}
        confirmLabel="Delete Project"
        cancelLabel="Cancel"
        onConfirm={async () => {
          if (!deleteTarget || deleteLoading) return;
          setDeleteLoading(true);
          try {
            const result = await deleteProject(deleteTarget.id);
            if (!result.success) {
              toast.error(result.errors?.message || "Could not delete project");
              return;
            }
            toast.success("Project and related tasks deleted");
            setDeleteTarget(null);
            await mutate();
            await globalMutate("project-summary");
            await globalMutate(SWR_CACH_KEYS.tasks.key);
            await globalMutate(SWR_CACH_KEYS.myTasks.key);
            await globalMutate(SWR_CACH_KEYS.myTasksList.key);
            await globalMutate(SWR_CACH_KEYS.myTasksToday.key);
            await globalMutate(SWR_CACH_KEYS.myTasksBoard.key);
            if (typeof window !== "undefined") {
              window.dispatchEvent(new CustomEvent("task-updated"));
              localStorage.setItem("deero-task-updated", String(Date.now()));
            }
          } finally {
            setDeleteLoading(false);
          }
        }}
      >
        {deleteTarget ? (
          <p>
            Are you sure you want to delete <span className="font-semibold text-zinc-800">{deleteTarget.name}</span>?
            This action will permanently delete the project and all tasks associated with it. This cannot be undone.
          </p>
        ) : null}
      </ConfirmDialog>
    </ManagementPageShell>
  );
}
