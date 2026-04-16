import { describe, it, expect } from "vitest";
import { validateFile, getSourceType, parseTxt, parseCsv } from "@/lib/processing/parsers";

describe("validateFile", () => {
  it("accepts a PDF file", () => {
    const result = validateFile({
      size: 1024,
      type: "application/pdf",
      name: "test.pdf",
    });
    expect(result.valid).toBe(true);
    expect(result.sourceType).toBe("pdf");
  });

  it("accepts a DOCX file", () => {
    const result = validateFile({
      size: 1024,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: "doc.docx",
    });
    expect(result.valid).toBe(true);
    expect(result.sourceType).toBe("docx");
  });

  it("accepts a TXT file", () => {
    const result = validateFile({
      size: 100,
      type: "text/plain",
      name: "notes.txt",
    });
    expect(result.valid).toBe(true);
    expect(result.sourceType).toBe("txt");
  });

  it("accepts a CSV file", () => {
    const result = validateFile({
      size: 5000,
      type: "text/csv",
      name: "data.csv",
    });
    expect(result.valid).toBe(true);
    expect(result.sourceType).toBe("csv");
  });

  it("accepts image files", () => {
    expect(
      validateFile({ size: 1024, type: "image/png", name: "photo.png" }).valid
    ).toBe(true);
    expect(
      validateFile({ size: 1024, type: "image/jpeg", name: "photo.jpg" }).valid
    ).toBe(true);
  });

  it("rejects unsupported file types", () => {
    const result = validateFile({
      size: 1024,
      type: "application/zip",
      name: "archive.zip",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("Unsupported");
  });

  it("rejects files over 50MB", () => {
    const result = validateFile({
      size: 51 * 1024 * 1024,
      type: "application/pdf",
      name: "huge.pdf",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("too large");
  });

  it("falls back to extension when MIME type is unknown", () => {
    const result = validateFile({
      size: 1024,
      type: "application/octet-stream",
      name: "document.pdf",
    });
    expect(result.valid).toBe(true);
    expect(result.sourceType).toBe("pdf");
  });
});

describe("getSourceType", () => {
  it("maps MIME types correctly", () => {
    expect(getSourceType("application/pdf", "f.pdf")).toBe("pdf");
    expect(getSourceType("text/csv", "f.csv")).toBe("csv");
    expect(getSourceType("image/png", "f.png")).toBe("image");
  });

  it("returns null for unknown types", () => {
    expect(getSourceType("application/zip", "f.zip")).toBeNull();
  });
});

describe("parseTxt", () => {
  it("parses text buffer to string", () => {
    const buffer = Buffer.from("Hello, world!");
    const result = parseTxt(buffer);
    expect(result.text).toBe("Hello, world!");
  });
});

describe("parseCsv", () => {
  it("parses CSV to readable text", () => {
    const csv = "name,age\nAlice,30\nBob,25";
    const buffer = Buffer.from(csv);
    const result = parseCsv(buffer);
    expect(result.text).toContain("Alice");
    expect(result.text).toContain("Bob");
    expect(result.text).toContain("2 rows");
    expect(result.metadata?.rowCount).toBe(2);
  });
});
