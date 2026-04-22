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
            className="inline-flex items-center gap-1 font-bold uppercase tracking-wider transition-colors"
            style={{
              fontSize: "11px",
              color: "var(--fm-text-tertiary)",
            }}
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
          >
            {col.label}
            <ArrowUpDown className="h-3 w-3" />
          </button>
        ),
        cell: ({ getValue }) => {
          const value = getValue();
          if (col.type === "number") {
            return (
              <span
                className="block text-right"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
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
          // Heuristic: short single-word text in a column whose label
          // suggests a category/status/tag gets rendered as a colored
          // badge pill. Keeps the "badge column type" UX without
          // requiring backend schema changes.
          const labelHint = col.label.toLowerCase();
          const looksLikeCategory =
            labelHint.includes("status") ||
            labelHint.includes("category") ||
            labelHint.includes("tag") ||
            labelHint.includes("type");
          if (looksLikeCategory) {
            const text = String(value ?? "");
            if (!text) return "";
            return (
              <span
                style={{
                  display: "inline-block",
                  background:
                    "color-mix(in srgb, var(--fm-accent-orange) 12%, transparent)",
                  color: "var(--fm-accent-orange)",
                  borderRadius: "0.375rem",
                  padding: "0.125rem 0.5rem",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                {text}
              </span>
            );
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
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--fm-text)" }}
          >
            {tableData.title}
          </h3>
          <p
            className="text-xs"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
            {tableData.description} — {tableData.rows.length} rows
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleExportCsv}
        >
          <Download className="h-3.5 w-3.5" />
          CSV
        </Button>
      </div>

      <div className="relative mb-3">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
          style={{ color: "var(--fm-text-tertiary)" }}
        />
        <Input
          aria-label="Search table"
          placeholder="Filter rows..."
          value={globalFilter}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-8 h-8 text-xs"
        />
      </div>

      <div
        className="rounded-md overflow-auto"
        style={{ border: "1px solid var(--fm-surface-border)" }}
      >
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                style={{
                  borderBottom: "1px solid var(--fm-surface-border)",
                  background: "var(--fm-surface-elevated)",
                }}
              >
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left"
                    style={{ color: "var(--fm-text-tertiary)" }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
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
                  className="px-4 py-8 text-center text-xs"
                  style={{ color: "var(--fm-text-tertiary)" }}
                >
                  No matching rows
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row, rowIndex) => {
                const isEven = rowIndex % 2 === 0;
                return (
                  <tr
                    key={row.id}
                    className="group"
                    style={{
                      background: isEven
                        ? "rgba(255,255,255,0.02)"
                        : "transparent",
                      transition: "background-color 150ms ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isEven
                        ? "rgba(255,255,255,0.02)"
                        : "transparent";
                    }}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const colDef = tableData.columns.find(
                        (c) => c.key === cell.column.id,
                      );
                      const align =
                        colDef?.type === "number" ? "right" : "left";
                      return (
                        <td
                          key={cell.id}
                          className="px-4 py-3 text-xs"
                          style={{
                            color: "var(--fm-text)",
                            textAlign: align,
                            fontVariantNumeric:
                              colDef?.type === "number"
                                ? "tabular-nums"
                                : undefined,
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext(),
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between mt-3">
          <span
            className="text-xs"
            style={{ color: "var(--fm-text-tertiary)" }}
          >
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
        <TableIcon
          className="h-10 w-10 mx-auto mb-3"
          style={{ color: "var(--fm-text-tertiary)" }}
        />
        <p
          className="font-medium"
          style={{ color: "var(--fm-text)" }}
        >
          No tabular data found
        </p>
        <p
          className="text-sm mt-1"
          style={{ color: "var(--fm-text-tertiary)" }}
        >
          Your sources don&apos;t contain data that can be organized as tables.
        </p>
      </div>
    );
  }

  return (
    <div>
      {data.tables.length > 1 && (
        <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
          {data.tables.map((t, i) => {
            const active = activeTable === i;
            return (
              <button
                key={i}
                onClick={() => setActiveTable(i)}
                className="px-3 py-1.5 rounded-md text-xs font-medium border transition-all shrink-0"
                style={{
                  background: active
                    ? "color-mix(in srgb, var(--fm-accent-orange) 10%, transparent)"
                    : "var(--fm-surface-elevated)",
                  borderColor: active
                    ? "var(--fm-accent-orange)"
                    : "var(--fm-surface-border)",
                  color: active
                    ? "var(--fm-accent-orange)"
                    : "var(--fm-text-secondary)",
                }}
              >
                {t.title}
              </button>
            );
          })}
        </div>
      )}
      <DataTableInner table={data.tables[activeTable]} />
    </div>
  );
};
