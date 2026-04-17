import { describe, it, expect } from "vitest";

// Test CSV export logic (extracted from DataTableView)
const generateCsv = (
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, unknown>>
): string => {
  const header = columns.map((c) => c.label).join(",");
  const dataRows = rows.map((row) =>
    columns
      .map((c) => {
        const val = String(row[c.key] ?? "");
        return val.includes(",") ? `"${val}"` : val;
      })
      .join(",")
  );
  return [header, ...dataRows].join("\n");
};

describe("CSV export", () => {
  it("generates valid CSV with headers", () => {
    const csv = generateCsv(
      [
        { key: "name", label: "Name" },
        { key: "age", label: "Age" },
      ],
      [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ]
    );
    expect(csv).toBe("Name,Age\nAlice,30\nBob,25");
  });

  it("quotes values containing commas", () => {
    const csv = generateCsv(
      [{ key: "desc", label: "Description" }],
      [{ desc: "hello, world" }]
    );
    expect(csv).toBe('Description\n"hello, world"');
  });

  it("handles empty rows", () => {
    const csv = generateCsv(
      [{ key: "name", label: "Name" }],
      []
    );
    expect(csv).toBe("Name");
  });

  it("handles missing values", () => {
    const csv = generateCsv(
      [
        { key: "name", label: "Name" },
        { key: "email", label: "Email" },
      ],
      [{ name: "Alice" }]
    );
    expect(csv).toBe("Name,Email\nAlice,");
  });
});
