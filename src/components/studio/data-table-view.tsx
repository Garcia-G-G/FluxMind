"use client";

import { useState, useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  Download,
  ChevronLeft,
  ChevronRight,
  Search,
  Table as TableIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { DataTableContent } from "@/app/api/studio/datatable/route";

type TableData = DataTableContent["tables"][number];

const DataTableInner = ({
  table: tableData,
}: {
  table: TableData;
}): React.ReactNode => {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo<ColumnDef<Record<string, unknown>>[]>(
    () =>
      tableData.columns.map((col) => ({
        accessorKey: col.key,
        header: ({ column }) => (
          <button
            className="flex items-center gap-1 font-medium hover:text-foreground transition-colors"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            {col.label}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (col.type === "number") {
            return (
              <span className="tabular-nums text-right block">
                {String(value ?? "")}
              </span>
            );
          }
          if (col.type === "date") {
            try {
              return new Date(String(value)).toLocaleDateString();
            } catch {
              return String(value ?? "");
            }
          }
          return String(value ?? "");
        },
      })),
    [tableData.columns]
  );

  const table = useReactTable({
    data: tableData.rows as Record<string, unknown>[],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 20 } },
  });

  const handleExportCsv = (): void => {
    const header = tableData.columns.map((c) => c.label).join(",");
    const rows = tableData.rows.map((row) =>
      tableData.columns
        .map((c) => {
          const val = String(row[c.key] ?? "");
          return val.includes(",") ? `"${val}"` : val;
        })
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tableData.title}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-medium text-sm">{tableData.title}</h3>
          <p className="text-xs text-muted-foreground">
            {tableData.description} — {tableData.rows.length} rows
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleExportCsv}>
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Filter rows..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div className="rounded-md border border-border overflow-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/50">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left text-xs font-medium text-muted-foreground"
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-muted-foreground text-xs"
                >
                  No matching rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2 text-xs">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span className="text-xs text-muted-foreground">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export const DataTableView = ({
  data,
}: {
  data: DataTableContent;
}): React.ReactNode => {
  const [activeTable, setActiveTable] = useState(0);

  if (data.tables.length === 0) {
    return (
      <div className="text-center py-12">
        <TableIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">No tabular data found</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your sources don&apos;t contain data that can be organized as tables.
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.tables.length > 1 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {data.tables.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveTable(i)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-all shrink-0 ${
                activeTable === i
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-primary/50"
              }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      )}
      <DataTableInner table={data.tables[activeTable]} />
    </div>
  );
};
