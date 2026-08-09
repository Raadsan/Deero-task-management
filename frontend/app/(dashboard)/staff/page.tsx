"use client";

import { usePermissions } from "@/context/PermissionContext";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import ConfirmDialog from "@/components/Shared/ConfirmDialog";
import UserFormModal from "@/components/users/UserFormModal";
import UserViewModal from "@/components/users/UserViewModal";
import UploadDocumentsModal from "@/components/upload/UploadDocumentsModal";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAllUsers, deleteUserById } from "@/lib/apis/userApi";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
  actionBtnDelete,
  actionBtnEdit,
  actionBtnView,
  dashboardCardClass,
  dashboardLabelClass,
  dashboardPaginationClass,
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
import { User } from "@/lib/types";
import { cn, sortStaffByCode } from "@/lib/utils";
import { Edit, Eye, FileUp, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import useSWR, { useSWRConfig } from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

type UserRow = User & { id: string };

export default function EmployeesPage() {
  const { canView, canAdd, canEdit, canDelete } = usePermissions();
  const mayView = canView("/staff");
  const mayAdd = canAdd("/staff");
  const mayEdit = canEdit("/staff");
  const mayDelete = canDelete("/staff");
  const { data: usersRes, isLoading } = useSWR(
    SWR_CACH_KEYS.users.key,
    getAllUsers,
  );

  const users = useMemo(() => {
    const rawUsers = (usersRes?.data as UserRow[]) ?? [];
    return [...rawUsers].sort(sortStaffByCode);
  }, [usersRes?.data]);

  const { mutate } = useSWRConfig();
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [viewUserId, setViewUserId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | undefined>();
  const [editOpen, setEditOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [documentsUserId, setDocumentsUserId] = useState<string | undefined>();
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete(userId: string) {
    setIsDeleting(true);
    try {
      const result = await deleteUserById({ userId });
      if (result.success) {
        toast.success("Staff member deleted successfully");
        setDeleteTarget(null);
        await mutate(SWR_CACH_KEYS.users.key);
        await mutate((key) => true, undefined, { revalidate: true });
      } else {
        toast.error(result.errors?.message ?? "Failed to delete staff");
      }
    } finally {
      setIsDeleting(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase();
    return users.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      const userId = String(user.id ?? "").toLowerCase();
      const staffCode = String(user.staffCode ?? "").toLowerCase();
      const jobTitle = String(user.jobTitle ?? "").toLowerCase();
      return (
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        userId.includes(query) ||
        staffCode.includes(query) ||
        jobTitle.includes(query)
      );
    });
  }, [users, search]);

  const totalPages = Math.ceil(filteredUsers.length / pageSize) || 1;
  const paginatedUsers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, currentPage, pageSize]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  return (
    <ManagementPageShell title="Staff Management">
      <div className={dashboardCardClass}>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-zinc-50 px-6 py-3">
          <div className={cn("flex items-center gap-2", dashboardLabelClass)}>
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className={cn("w-16", compactSelectClass)}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>

          <div className="min-w-4 flex-1" />

          <div className="group relative w-52">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search staff..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          {mayAdd ? (
            <Button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="h-9 gap-2"
            >
              <Plus className="size-4" />
              Add Staff
            </Button>
          ) : null}
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "w-12 text-center")}>No.</TableHead>
                  {[
                    "Staff ID",
                    "Full Name",
                    "Email",
                    "Job Title",
                    "Type",
                    // "Role",
                  ].map((heading) => (
                    <TableHead key={heading} className={dashboardTableHeadClass}>{heading}</TableHead>
                  ))}
                  <TableHead className={cn(dashboardTableHeadClass, "min-w-[140px]")}>Status</TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(8)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-muted-foreground px-6 py-10 text-center"
                    >
                      No staff found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user, index) => (
                    <TableRow
                      key={user.id}
                      className={dashboardTableBodyRowClass}
                    >
                      <TableCell className={cn(dashboardTableCellClass, "w-12 text-center text-xs font-semibold text-zinc-400")}>
                        {(currentPage - 1) * pageSize + index + 1}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{user.staffCode || "N/A"}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextPrimary}>
                          {user.name}
                        </span>
                      </TableCell>
                                            <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>
                          {user.email}
                        </span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>{user.jobTitle || "N/A"}</span>
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTextSecondary}>{user.employmentType === "PART_TIME" ? "Part-Time" : "Full-Time"}</span>
                      </TableCell>
                      {/* <TableCell className={dashboardTableCellClass}>
                        {user.role || "N/A"}
                      </TableCell> */}
                      <TableCell className={cn(dashboardTableCellClass, "min-w-[140px]")}>
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-medium",
                            (user as UserRow & { banned?: boolean }).banned
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700",
                          )}
                        >
                          {(user as UserRow & { banned?: boolean }).banned
                            ? "Inactive"
                            : "Active"}
                        </span>
                      </TableCell>
                      <TableCell
                        className={cn(dashboardTableCellClass, "text-right")}
                      >
                        <div className="flex justify-end gap-1">
                          {mayView ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setViewUserId(String(user.id));
                                setViewOpen(true);
                              }}
                              className={actionBtnView}
                              title="View"
                            >
                              <Eye className="size-4" />
                            </Button>
                          ) : null}
                          {mayAdd ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDocumentsUserId(String(user.id));
                                setDocumentsOpen(true);
                              }}
                              className={actionBtnView}
                              title="Employee documents"
                            >
                              <FileUp className="size-4" />
                            </Button>
                          ) : null}
                          {mayEdit ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditUserId(String(user.id));
                                setEditOpen(true);
                              }}
                              className={actionBtnEdit}
                              title="Edit"
                            >
                              <Edit className="size-4" />
                            </Button>
                          ) : null}
                          {mayDelete ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setDeleteTarget({
                                  id: String(user.id),
                                  name:
                                    user.name ?? user.email ?? String(user.id),
                                })
                              }
                              className={actionBtnDelete}
                              title="Delete"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className={dashboardPaginationClass}>
          <div>
            {filteredUsers.length === 0
              ? "0 of 0"
              : `${Math.min(filteredUsers.length, (currentPage - 1) * pageSize + 1)}-${Math.min(filteredUsers.length, currentPage * pageSize)} of ${filteredUsers.length}`}
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &lt;
            </button>
            <div className="rounded-md border border-zinc-200 px-3 py-1 text-zinc-400">
              {currentPage} of {totalPages}
            </div>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-md border border-zinc-200 px-2 py-1 transition-all hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              &gt;
            </button>
          </div>
        </div>
      </div>

      <UserViewModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        userId={viewUserId}
      />
      <UserFormModal
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        userId={editUserId}
      />
      <UserFormModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
      />
      <UploadDocumentsModal
        open={documentsOpen}
        onOpenChange={setDocumentsOpen}
        userId={documentsUserId}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete Staff Member"
        description={`Are you sure you want to delete "${deleteTarget?.name}"? This action cannot be undone.`}
        confirmLabel="Delete"
        destructive={true}
        loading={isDeleting}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget.id)}
      />
    </ManagementPageShell>
  );
}
