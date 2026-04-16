import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import Papa from "papaparse";

export type ParseResult = {
  text: string;
  pageCount?: number;
  metadata?: Record<string, unknown>;
};

export const parsePdf = async (buffer: Buffer): Promise<ParseResult> => {
  const parser = new PDFParse({ data: buffer });
  const result = await parser.getText();
  // Join pages with page break markers
  const textWithPageBreaks = result.pages
    .map((p) => p.text)
    .join("\n---PAGE_BREAK---\n");
  await parser.destroy();
  return {
    text: textWithPageBreaks,
    pageCount: result.total,
  };
};

export const parseDocx = async (buffer: Buffer): Promise<ParseResult> => {
  const result = await mammoth.extractRawText({ buffer });
  return {
    text: result.value,
    metadata: {
      messages: result.messages,
    },
  };
};

export const parseTxt = (buffer: Buffer): ParseResult => {
  const text = buffer.toString("utf-8");
  return { text };
};

export const parseCsv = (buffer: Buffer): ParseResult => {
  const csvText = buffer.toString("utf-8");
  const result = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (result.errors.length > 0) {
    // If we have no data at all, fail outright
    if (result.data.length === 0) {
      throw new Error(`CSV parsing failed: ${result.errors[0].message}`);
    }
    // If we have partial data, continue but log warnings
    console.warn(`CSV parsed with ${result.errors.length} errors, proceeding with ${result.data.length} valid rows`);
  }

  // Convert rows to readable text
  const rows = result.data as Record<string, string>[];
  const headers = result.meta.fields ?? [];
  const lines = rows.map((row, i) => {
    const fields = headers.map((h) => `${h}: ${row[h] ?? ""}`).join(", ");
    return `Row ${i + 1}: ${fields}`;
  });

  return {
    text: `CSV Data (${rows.length} rows, columns: ${headers.join(", ")})\n\n${lines.join("\n")}`,
    metadata: {
      rowCount: rows.length,
      columns: headers,
    },
  };
};

export const parseDocument = async (
  buffer: Buffer,
  type: string
): Promise<ParseResult> => {
  switch (type) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "txt":
      return parseTxt(buffer);
    case "csv":
      return parseCsv(buffer);
    case "image":
      // OCR would go here — for now extract nothing and note it
      return {
        text: "[Image content — OCR not yet configured]",
        metadata: { requiresOcr: true },
      };
    default:
      throw new Error(`Unsupported document type: ${type}`);
  }
};

const MIME_TO_TYPE: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
  "text/csv": "csv",
  "image/png": "image",
  "image/jpeg": "image",
  "image/jpg": "image",
  "image/webp": "image",
};

const EXT_TO_TYPE: Record<string, string> = {
  ".pdf": "pdf",
  ".docx": "docx",
  ".txt": "txt",
  ".csv": "csv",
  ".png": "image",
  ".jpg": "image",
  ".jpeg": "image",
  ".webp": "image",
};

export const SUPPORTED_TYPES = Object.keys(MIME_TO_TYPE);
export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export const getSourceType = (
  mimeType: string,
  filename: string
): string | null => {
  // Try MIME type first
  const fromMime = MIME_TO_TYPE[mimeType];
  if (fromMime) return fromMime;

  // Fall back to extension
  const ext = filename.slice(filename.lastIndexOf(".")).toLowerCase();
  return EXT_TO_TYPE[ext] ?? null;
};

export const validateFile = (
  file: { size: number; type: string; name: string }
): { valid: boolean; error?: string; sourceType?: string } => {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  const sourceType = getSourceType(file.type, file.name);
  if (!sourceType) {
    return {
      valid: false,
      error: `Unsupported file type: ${file.type || file.name.split(".").pop()}`,
    };
  }

  return { valid: true, sourceType };
};
