"use client";

import { AllClients, TableExpense, TableIncome, Task, User } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import { ArrowUpDown } from "lucide-react";

export const taskColumns: ColumnDef<Task>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "institutions",
    header: "Client Name",
  },
  {
    accessorKey: "assignedTo",
    header: "Assigned To",
  },
  {
    accessorKey: "supervisor",
    header: "Supervisor",
  },
  {
    accessorKey: "department",
    header: "Department",
  },
  {
    accessorKey: "priority",
    header: "Priority",
  },
  {
    accessorKey: "status",
    header: ({ column }) => {
      return (
        <ColumnSortButtonBuilder
          headerText="Status"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      );
    },
  },
  {
    accessorKey: "deadline",
    header: ({ column }) => {
      return (
        <ColumnSortButtonBuilder
          headerText="Deadline"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      );
    },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    enableGlobalFilter: false,
  },
];

export const usersColumns: ColumnDef<User>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },

  {
    accessorKey: "name",
    header: "Name",
  },
  {
    accessorKey: "email",
    header: "Email",
  },

  {
    accessorKey: "role",
    header: "Role",
  },
  {
    accessorKey: "gender",
    header: "Gender",
  },
  {
    accessorKey: "department",
    header: "Department",
  },
  {
    accessorKey: "banned",
    header: "Banned",
  },
  {
    accessorKey: "salary",
    header: "Salary",
  },

  {
    accessorKey: "createdAt",
    header: "Joined At",
  },
  {
    accessorKey: "actions",
    header: "Actions",
    enableGlobalFilter: false,
  },
];

export const incomeColumns: ColumnDef<TableIncome>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "clientName",
    header: "Client Name",
  },
  {
    accessorKey: "source",
    header: "Source",
  },

  {
    accessorKey: "recievedBy",
    header: "Registered By",
  },

  {
    accessorKey: "actions",
    header: "Actions",
    enableColumnFilter: false,
  },
];

export const expenseColumns: ColumnDef<TableExpense>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },

  {
    accessorKey: "base",
    header: "Base Amount",
  },
  {
    accessorKey: "expenseType",
    header: "Expense Type",
  },
  {
    accessorKey: "registeredBy",
    header: "Registered By",
  },

  {
    accessorKey: "description",
    header: "Description",
  },
  {
    accessorKey: "createdAt",
    header: "Created At",
  },
  {
    accessorKey: "actions",
    header: "Actions",
    enableColumnFilter: false,
  },
];
export const clientsColumns: ColumnDef<AllClients>[] = [
  {
    accessorKey: "id",
    header: "ID",
  },
  {
    accessorKey: "institution",
    header: "Client Name",
  },
  {
    accessorKey: "service",
    header: "Service Information",
  },

  {
    accessorKey: "email",
    header: "Email",
  },

  {
    accessorKey: "phone",
    header: "Phone",
  },
  {
    accessorKey: "createdAt",
    header: ({ column }) => {
      return (
        <ColumnSortButtonBuilder
          headerText="CreatedAt"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        />
      );
    },
  },
  {
    accessorKey: "actions",
    header: "Actions",
    enableGlobalFilter: false,
  },
];

interface Props {
  onClick: () => void;
  headerText: string;
}

function ColumnSortButtonBuilder({ onClick, headerText }: Props) {
  return (
    <button
      title={`Sort by ${headerText}`}
      className="group flex cursor-pointer items-center gap-1.5"
      onClick={onClick}
    >
      {headerText}
      <ArrowUpDown className="group-hover:text-success h-4 w-4 transition-colors duration-300 ease-out" />
    </button>
  );
}
