"use client";

import DeleteAction from "@/components/Shared/DeleteAction";
import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import UserFormModal from "@/components/users/UserFormModal";
import UserViewModal from "@/components/users/UserViewModal";
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
import { ROUTES, SWR_CACH_KEYS } from "@/lib/constants";
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
  getTaskStatusBadgeClass,
} from "@/lib/dashboard-ui";
import { User } from "@/lib/types";
import { cn, formatTexts } from "@/lib/utils";
import { Edit, Eye, Plus, Search, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const compactSelectClass =
  "h-9 cursor-pointer rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-600 outline-none focus:border-primary";

const compactInputClass =
  "h-9 w-full rounded-md border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm text-zinc-600 outline-none focus:border-primary focus:ring-1 focus:ring-primary/10";

type UserRow = User & {
  banned?: boolean | string;
  branch?: { id: string; name: string };
  branchId?: string;
};

export default function UsersManagementPage() {
  const { data: usersRes, isLoading } = useSWR(
    SWR_CACH_KEYS.users.key,
    getAllUsers,
  );

  const users = (usersRes?.data as UserRow[]) ?? [];

  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [editingUserId, setEditingUserId] = useState<string | undefined>();
  const [viewUserId, setViewUserId] = useState<string | undefined>();
  const [viewOpen, setViewOpen] = useState(false);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase();
    return users.filter((user) => {
      const name = user.name?.toLowerCase() ?? "";
      const email = user.email?.toLowerCase() ?? "";
      const role = user.role?.toLowerCase() ?? "";
      const department = user.department?.toLowerCase() ?? "";
      const userId = String(user.id ?? "").toLowerCase();

      return (
        !query ||
        name.includes(query) ||
        email.includes(query) ||
        role.includes(query) ||
        department.includes(query) ||
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

  const deleteDescription = formatTexts({
    type: "users",
    formatType: "description",
  });
  const deleteDialogTitle = formatTexts({
    type: "users",
    formatType: "diaglog",
  });

  function openCreateModal() {
    setFormMode("create");
    setEditingUserId(undefined);
    setFormOpen(true);
  }

  function openEditModal(userId: string) {
    setFormMode("edit");
    setEditingUserId(userId);
    setFormOpen(true);
  }

  function openViewModal(userId: string) {
    setViewUserId(userId);
    setViewOpen(true);
  }

  return (
    <ManagementPageShell title="Users management">
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
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={compactInputClass}
            />
          </div>

          <Button
            type="button"
            onClick={openCreateModal}
            className={cn(btnCreatePage, "h-9 px-4 text-sm")}
          >
            <Plus className="size-4" />
            Create User
          </Button>
        </div>

        <div className={dashboardTableWrapClass}>
          <div className="overflow-x-auto">
            <Table className="w-full">
              <TableHeader className={dashboardTableHeaderClass}>
                <TableRow className={dashboardTableHeadRowClass}>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    ID
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Name
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Email
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Role
                  </TableHead>
                  {/* <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Gender
                  </TableHead> */}
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Department
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Branch
                  </TableHead>
                  <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Status
                  </TableHead>
                  {/* <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Salary
                  </TableHead> */}
                  {/* <TableHead className={cn(dashboardTableHeadClass, "text-left")}>
                    Joined At
                  </TableHead> */}
                  <TableHead className={cn(dashboardTableHeadClass, "text-right")}>
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i} className="h-14 animate-pulse">
                      {[...Array(10)].map((_, j) => (
                        <TableCell key={j} className="px-6 py-4">
                          <div className="h-4 w-full rounded bg-zinc-100" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : paginatedUsers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={11}
                      className="px-6 py-10 text-center text-muted-foreground"
                    >
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedUsers.map((user) => {
                    const isInactive =
                      user.banned === true ||
                      user.banned === "true";

                    return (
                      <TableRow key={user.id} className={dashboardTableBodyRowClass}>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTableIdClass}>
                            {String(user.id).slice(0, 8)}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextPrimary}>{user.name}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{user.email}</span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className="capitalize">{user.role}</span>
                        </TableCell>
                        {/* <TableCell className={dashboardTableCellClass}>
                          <span className="capitalize">{user.gender ?? "—"}</span>
                        </TableCell> */}
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {user.department ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {user.branch?.name ?? "—"}
                          </span>
                        </TableCell>
                        <TableCell className={dashboardTableCellClass}>
                          <span
                            className={cn(
                              dashboardStatusBadgeClass,
                              isInactive
                                ? getTaskStatusBadgeClass("overdue")
                                : getTaskStatusBadgeClass("completed"),
                            )}
                          >
                            {isInactive ? "Inactive" : "Active"}
                          </span>
                        </TableCell>
                        {/* <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>{user.salary}</span>
                        </TableCell> */}
                        {/* <TableCell className={dashboardTableCellClass}>
                          <span className={dashboardTextSecondary}>
                            {String(user.createdAt ?? "—")}
                          </span>
                        </TableCell> */}
                        <TableCell
                          className={cn(dashboardTableCellClass, "text-right")}
                        >
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewModal(String(user.id))}
                              className={actionBtnView}
                              title="View"
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditModal(String(user.id))}
                              className={actionBtnEdit}
                              title="Edit"
                            >
                              <Edit className="size-4" />
                            </Button>
                            <Link
                              href={ROUTES.uploadUserFile(String(user.id))}
                              title="Upload documents"
                              className={cn(
                                actionBtnEdit,
                                "inline-flex items-center justify-center",
                              )}
                            >
                              <Upload className="size-4" />
                            </Link>
                            {user.id && (
                              <DeleteAction
                                typeOfDataToDelete="users"
                                idToDelete={String(user.id)}
                                description={deleteDescription ?? ""}
                                dialogTitle={deleteDialogTitle ?? "Delete User"}
                                triggerClassNames={actionBtnDelete}
                                trigger={<Trash2 className="size-4" />}
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
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
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        userId={editingUserId}
      />
    </ManagementPageShell>
  );
}
