import { TableType } from "@/lib/types";
import { computeFontSize } from "@/lib/utils";
import { Table } from "@tanstack/react-table";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const userFiltes = ["id", "name", "email", "gender", "createdAt", "role"];
const taskFilters = [
  "id",
  "institutions",
  "assignedTo",
  "supervisor",
  "department",
  "priority",
  "status",
  "deadline",
];
const clientFilters = ["id", "institution", "email", "phone", "createdAt"];
const incomeFilters = ["id", "source", "recievedBy"];
const expenseFilters = ["id", "expenseType", "PaidBy", "status"];
interface Props<TData> {
  table: Table<TData>;
  tableType: TableType;
}
function getFilters(tableType: TableType) {
  switch (tableType) {
    case "tasks":
      return taskFilters;
    case "my-tasks":
      return taskFilters;
    case "clients":
      return clientFilters;
    case "users":
      return userFiltes;
    case "incomes":
      return incomeFilters;
    case "expenses":
      return expenseFilters;
  }
}
export default function TableSearchInput<TData>({
  table,
  tableType,
}: Props<TData>) {
  const [selectedFilter, setSelecteFilter] = useState<string | undefined>();
  const [searchValue, setSearchValue] = useState<string>("");
  const filters = getFilters(tableType);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);

    if (selectedFilter && value) {
      table.resetColumnFilters();

      // For exact matching, we need to use a custom filter
      const column = table.getColumn(selectedFilter);
      if (column) {
        // Set the filter value with exact match
        column.setFilterValue({
          value: value.trim(),
          matchMode: "exact",
        });
      }
    } else if (!value) {
      table.resetColumnFilters();
    }
  };

  const handleColumnChange = (value: string) => {
    table.resetColumnFilters();
    setSelecteFilter(value);
    if (searchValue) {
      const column = table.getColumn(value);
      if (column) {
        column.setFilterValue({
          value: searchValue.trim(),
          matchMode: "exact",
        });
      }
    }
  };

  return (
    <div className="ml-auto flex h-[50px] w-[min(600px,100%)] items-center gap-[10px] overflow-hidden rounded-full border border-black/10 bg-white shadow-sm">
      <input
        value={searchValue}
        placeholder={
          selectedFilter
            ? `Search by ${selectedFilter[0].toUpperCase() + selectedFilter.substring(1)}...`
            : tableType === "clients"
              ? "Select a column to search"
              : tableType === "tasks"
                ? "Select a column to search"
                : "Select a column to search"
        }
        className="h-full w-full rounded-[inherit] pl-[20px] focus:outline-0"
        onChange={handleInputChange}
        disabled={!selectedFilter}
      />

      <Select onValueChange={handleColumnChange} value={selectedFilter}>
        <SelectTrigger className="min-h-full w-fit min-w-[150px] rounded-none border-0 border-l border-black/20 focus-visible:ring-0">
          <SelectValue placeholder={"Search By..."} />
        </SelectTrigger>
        <SelectContent className="shadow-md-1x min-h-full min-w-full border border-gray-50 bg-white">
          {filters?.map((state, index) => {
            return (
              <SelectItem
                style={{
                  fontSize: computeFontSize(14),
                }}
                className="focus:bg-dark-red font-light text-black focus:text-white"
                key={index}
                value={state}
              >
                {state[0].toUpperCase() + state.substring(1).toLowerCase()}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
