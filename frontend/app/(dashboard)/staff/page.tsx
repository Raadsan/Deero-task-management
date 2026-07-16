"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
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
import { getAllUsers } from "@/lib/actions/user.action";
import { SWR_CACH_KEYS } from "@/lib/constants";
import {
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
import { cn } from "@/lib/utils";
import { Edit, Eye, FileUp, Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

type UserRow = User & { id: string };

export default function EmployeesPage() {
  const { data: usersRes, isLoading } = useSWR(
    SWR_CACH_KEYS.users.key,
    getAllUsers,
  );

  const users = (usersRes?.data as UserRow[]) ?? [];

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

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase();
    return users.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      const userId = String(user.id ?? "").toLowerCase();
      return (
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        userId.includes(query)
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
    <ManagementPageShell title="Staff">
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

          <Button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="h-9 gap-2"
          >
            <Plus className="size-4" />
            Add Staff
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={dashboardTableHeadClass}>
                    Staff ID
                  </TableHead>
                  <TableHead className={dashboardTableHeadClass}>
                    Name
                  </TableHead>
                  <TableHead className={dashboardTableHeadClass}>
                    Email
                  </TableHead>
                  <TableHead className={dashboardTableHeadClass}>
                    Role
                  </TableHead>
                  <TableHead className={dashboardTableHeadClass}>
                    Status
                  </TableHead>
                  <TableHead
                    className={cn(dashboardTableHeadClass, "text-right")}
                  >
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(6)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="text-muted-foreground px-6 py-10 text-center"
                    >
                      No staff found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => (
                    <TableRow
                      key={user.id}
                      className={dashboardTableBodyRowClass}
                    >
                      <TableCell className={dashboardTableCellClass}>
                        <span className={dashboardTableIdClass}>{user.id}</span>
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
                        {user.role || "N/A"}
                      </TableCell>
                      <TableCell className={dashboardTableCellClass}>
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
    </ManagementPageShell>
  );
}
