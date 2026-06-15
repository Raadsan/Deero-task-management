"use client";

import ManagementPageShell from "@/components/Shared/ManagementPageShell";
import { TableType } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";
import { ReactNode } from "react";

import { DataTable } from "../ui/data-table";

interface Props<T> {
  columns: ColumnDef<T>[];
  data: T[];
  tableType: TableType;
  title?: string;
  toolbar?: ReactNode;
  useShell?: boolean;
}

export default function TableRenderer<T>({
  columns,
  data,
  tableType,
  title,
  toolbar,
  useShell = true,
}: Props<T>) {
  const table = (
    <DataTable
      columns={columns}
      tableType={tableType}
      data={data}
      toolbar={toolbar}
    />
  );

  if (title && useShell) {
    return <ManagementPageShell title={title}>{table}</ManagementPageShell>;
  }

  return <div className="w-full">{table}</div>;
}
