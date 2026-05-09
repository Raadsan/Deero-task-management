"use client";

import { ROUTES } from "@/lib/constants";
import { TableType } from "@/lib/types";
import { cn, computeFontSize, formatTaskDeadline } from "@/lib/utils";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  VisibilityState,
  useReactTable,
} from "@tanstack/react-table";
import { ReactNode, useState } from "react";
import PaginatedButton from "../Shared/PaginatedButtons";
import ShowActions from "../Shared/ShowActions";
import TableSearchInput from "../Shared/TableSearchInput";
import TaskViewModal from "../tasks/TaskViewModal";
import { Task } from "@/lib/types";

// Custom filter function for exact matching
const exactMatchFilter = (row: any, columnId: string, filterValue: any) => {
  if (!filterValue || typeof filterValue !== "object") {
    // If no filter or not our custom filter object, show all
    return true;
  }

  const { value, matchMode } = filterValue;

  if (!value || matchMode !== "exact") {
    return true;
  }

  const cellValue = row.getValue(columnId);

  // Convert both to strings for comparison
  const cellStr = String(cellValue).toLowerCase();
  const searchStr = String(value).toLowerCase();

  // For exact match if columnId is Id
  if (columnId === "id") return cellStr === searchStr;

  // otherwise then check if search terms is in cellString value.
  return cellStr.includes(searchStr);
};
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  tableType: TableType;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  tableType,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({
    id: false,
  });

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onColumnFiltersChange: setColumnFilters,
    getFilteredRowModel: getFilteredRowModel(),
    enableColumnFilters: true,
    enableGlobalFilter: false,
    filterFns: {
      exactMatch: exactMatchFilter,
    },

    defaultColumn: {
      filterFn: exactMatchFilter,
    },
    state: {
      sorting,
      columnFilters,
      columnVisibility,
    },
    onColumnVisibilityChange: setColumnVisibility,
  });

  const pageCounts = table?.getPageCount();
  const lastThreePages =
    pageCounts >= 4
      ? table?.getPageOptions().slice(-3)
      : table?.getPageOptions();
  const currentPage = table?.getState().pagination.pageIndex;
  const colCount = columns.length;

  const gridTemplate = columns
    .map((col) => {
      const id = (col as any).accessorKey || col.id;
      if (id === "actions") return "180px";
      return "minmax(120px, 1fr)";
    })
    .join(" ");

  return (
    <section className="flex h-full w-full flex-col gap-3">
      <TableSearchInput table={table} tableType={tableType} />

      <div className="w-full overflow-x-auto rounded-md border border-black/10">
        <div className="max-w-[1000px] min-w-full">
          {table.getHeaderGroups().map((headerGroup) => (
            <div
              key={headerGroup.id}
              className="bg-secondary-100 grid px-3 py-2"
              style={{
                gridTemplateColumns: gridTemplate,
                minWidth: `${colCount * 300}px`,
                gap: "8px",
              }}
            >
              {headerGroup.headers.map((header) => (
                <div
                  key={header.id}
                  className="font-semibold text-white"
                  style={{ whiteSpace: "normal" }}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                </div>
              ))}
            </div>
          ))}

          {/* Rows */}
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row, index) => (
              <div
                key={row.id}
                className={cn(
                  "grid w-fit px-3 py-2",
                  index % 2 === 0 ? "bg-gray-100" : "bg-gray-200",
                )}
                style={{
                  gridTemplateColumns: gridTemplate,
                  minWidth: `${colCount * 300}px`,
                  gap: "8px",
                }}
              >
                {row.getVisibleCells().map((cell) => {
                  const columnId = cell.column.id;
                  const rowId = String((cell.row.original as any).id);

                  // actions
                  if (columnId === "actions") {
                    if (tableType === "users") {
                      return (
                        <ShowActions
                          key={cell.id}
                          tableType={tableType}
                          deleteActionKeyId={rowId}
                          buttonInfo={[
                            {
                              btnText: "Edit",
                              href: ROUTES.editUser(rowId),
                            },
                            {
                              btnText: "Upload",
                              href: ROUTES.uploadUserFile(rowId),
                            },
                            {
                              btnText: "Pay",
                              href: ROUTES.paySalary(rowId),
                            },
                          ]}
                        />
                      );
                    } else if (tableType === "clients") {
                      return (
                        <ShowActions
                          key={cell.id}
                          tableType={tableType}
                          deleteActionKeyId={rowId}
                          buttonInfo={[
                            {
                              btnText: "Add Service",
                              href: ROUTES.addSeriveForClient(rowId),
                            },
                            {
                              btnText: "Manage",
                              href: ROUTES.viewClient(rowId),
                            },
                          ]}
                        />
                      );
                    } else if (
                      tableType === "tasks" ||
                      tableType === "my-tasks"
                    ) {
                      const canManageMyTask =
                        tableType !== "my-tasks" ||
                        Boolean(
                          (
                            cell.row.original as {
                              isAssignedToCurrentUser?: boolean;
                            }
                          ).isAssignedToCurrentUser,
                        );

                      if (!canManageMyTask) {
                        return <RenderItem key={cell.id}>-</RenderItem>;
                      }

                      return (
                        <div key={cell.id} className="flex items-start gap-2.5">
                          <button
                            onClick={() => setViewingTask(cell.row.original as Task)}
                            className="to-secondary-200 cursor-pointer rounded-[3px] bg-linear-to-br from-orange-200 px-3 py-[4px] font-normal text-white"
                          >
                            View
                          </button>
                          <ShowActions
                            tableType={tableType}
                            deleteActionKeyId={rowId}
                            buttonInfo={[
                              {
                                btnText: "Edit",
                                href:
                                  tableType === "tasks"
                                    ? ROUTES.editTask(rowId)
                                    : ROUTES["my-tasks-edit"](rowId),
                              },
                            ]}
                          />
                        </div>
                      );
                    } else if (
                      tableType === "incomes" ||
                      tableType === "expenses"
                    ) {
                      const type =
                        tableType === "expenses" ? "expense" : "income";
                      return (
                        <ShowActions
                          key={cell.id}
                          tableType={tableType}
                          deleteActionKeyId={rowId}
                          buttonInfo={[
                            {
                              btnText: "Details",
                              href: ROUTES.transactionDetails(rowId, type),
                            },
                          ]}
                        />
                      );
                    }
                  }

                  // service info under clients
                  if (columnId === "service") {
                    const { service: services, subServices } =
                      cell.getValue() as {
                        service: {
                          serviceName: string;
                          id: string;
                        }[];
                        subServices: Array<{
                          id: string;
                          name: string;
                          count: number;
                          categoryId: string;
                        }>;
                      };
                    return (
                      <RenderItem key={cell.id}>
                        <div className="flex flex-col gap-3">
                          {services.map(
                            ({ id, serviceName }, categoryIndex) => {
                              const computeSubServices = subServices.filter(
                                (eachOne) => eachOne.categoryId === id,
                              );
                              if (!computeSubServices.length) return;
                              return (
                                <div
                                  key={categoryIndex}
                                  className="flex flex-col"
                                >
                                  <span className="font-semibold text-gray-800">
                                    {serviceName}
                                  </span>
                                  <ul className="ml-4 list-disc text-gray-600">
                                    {computeSubServices.map(
                                      ({ name, count }, subIndex) => (
                                        <li key={subIndex} className="pl-1">
                                          {name}
                                          <span className="ms-1.5 font-semibold text-black/90">
                                            {"#"}
                                            {count}
                                          </span>
                                        </li>
                                      ),
                                    )}
                                  </ul>
                                </div>
                              );
                            },
                          )}
                        </div>
                      </RenderItem>
                    );
                  }

                  // service info under income
                  if (columnId === "serviceInfo" && tableType === "incomes") {
                    const { serviceName, subServiceName } = cell.getValue() as {
                      serviceName: string;
                      subServiceName: string;
                    };

                    return (
                      <RenderItem key={cell.id}>
                        <span>{serviceName}</span>
                        <ul className="ml-4 list-disc text-gray-600">
                          <li className="pl-1">{subServiceName}</li>
                        </ul>
                      </RenderItem>
                    );
                  }

                  // amount info under incomes and expenses

                  // service info under tasks and my-tasks
                  if (
                    columnId === "institutions" &&
                    (tableType === "tasks" || tableType == "my-tasks")
                  ) {
                    const result = cell.getValue() as Array<{
                      institution: string;
                      id: string;
                      services?: string[];
                    }>;

                    return (
                      <RenderItem key={cell.id}>
                        {result.map(({ services }, index) => {
                          const serviceList = services?.length
                            ? services.join(", ")
                            : "—";
                          return <span key={index}>{serviceList}</span>;
                        })}
                      </RenderItem>
                    );
                  }

                  // assigned info under tasks and my-tasks
                  if (
                    columnId === "assignedTo" &&
                    (tableType === "tasks" || tableType == "my-tasks")
                  ) {
                    const { name } = cell.getValue() as {
                      id: string;
                      name: string;
                    };
                    return <RenderItem key={cell.id}>{name}</RenderItem>;
                  }

                  if (
                    columnId === "supervisor" &&
                    (tableType === "tasks" || tableType == "my-tasks")
                  ) {
                    const value = cell.getValue() as string;
                    return <RenderItem key={cell.id}>{value || "—"}</RenderItem>;
                  }

                  if (
                    columnId === "deadline" &&
                    (tableType === "tasks" || tableType === "my-tasks")
                  ) {
                    return (
                      <RenderItem key={cell.id}>
                        {formatTaskDeadline(cell.getValue() as string | Date)}
                      </RenderItem>
                    );
                  }

                  return (
                    <RenderItem key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </RenderItem>
                  );
                })}
              </div>
            ))
          ) : (
            <div className="flex h-[200px] items-center justify-center">
              <span className="h-24 text-center text-2xl text-gray-400">
                No results.
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="flex w-full items-center justify-center gap-[30px]">
        {pageCounts >= 2 && (
          <p className="text-dark-gray font-medium">
            Page {currentPage + 1} of {pageCounts} |
          </p>
        )}
        {pageCounts >= 2 && (
          <div className="flex items-center justify-center space-x-2">
            <PaginatedButton
              disable={!table.getCanPreviousPage()}
              text="Previous"
              onClick={table.previousPage}
            />
            {pageCounts >= 4 && (
              <div className="text-2xl text-gray-400">.....</div>
            )}
            {lastThreePages.map((each, index) => {
              return (
                <button
                  style={{
                    fontSize: computeFontSize(14),
                    backgroundColor:
                      currentPage === each ? "var(--color-bright-blue)" : "",
                    color: currentPage === each ? "white" : "black",
                    border: currentPage === each ? "none" : "",
                  }}
                  key={index}
                  className="h-[33px] w-[34px] rounded-sm border border-black/25 py-[7px] text-center font-normal text-black"
                >
                  {each + 1}
                </button>
              );
            })}

            <PaginatedButton
              disable={!table.getCanNextPage()}
              text="Next"
              onClick={table.nextPage}
            />
          </div>
        )}
        {pageCounts >= 2 && (
          <div className="flex items-center gap-3">
            <label id="pagenumber" className="text-dark-gray font-medium">
              Page
            </label>
            <input
              placeholder={`${currentPage + 1}`}
              value={currentPage + 1}
              onChange={(e) =>
                table.setPageIndex(() => {
                  return Number(e.target.value) - 1;
                })
              }
              className="w-[100px] rounded-[10px] border border-black/20 px-2 py-1"
            />
          </div>
        )}
      </div>
      {viewingTask && (
        <TaskViewModal task={viewingTask} onClose={() => setViewingTask(null)} />
      )}
    </section>
  );
}

function RenderItem({ children }: { children: ReactNode }) {
  return (
    <span
      className="px-1 not-last:border-r not-last:border-black/10"
      style={{
        whiteSpace: "normal",
        maxWidth: 300,
        overflow: "hidden",
        textOverflow: "ellipsis",
        display: "block",
      }}
    >
      {children}
    </span>
  );
}

function AmountValueRendere({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="mr-1.5 flex items-center justify-between">
      <span className="text-[1rem]">{label}:</span>
      <span className="ml-2 text-[.9rem] text-black/80">${value}</span>
    </div>
  );
}
