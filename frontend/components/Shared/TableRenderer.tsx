"use client";

import { TableType } from "@/lib/types";
import { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "../ui/data-table";

interface Props<T> {
  columns: ColumnDef<T>[];
  data: T[];
  tableType: TableType;
}

export default function TableRenderer<T>({
  columns,
  data,
  tableType,
}: Props<T>) {
  return (
    <div className="w-fulll h-fit">
      <DataTable columns={columns} tableType={tableType} data={data} />
    </div>
  );
}
