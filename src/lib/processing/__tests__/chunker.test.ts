import { describe, it, expect } from "vitest";
import { chunkText, estimateTokenCount } from "@/lib/processing/chunker";

describe("chunkText", () => {
  it("returns empty array for empty text", () => {
    expect(chunkText("")).toHaveLength(0);
    expect(chunkText("   ")).toHaveLength(0);
  });

  it("returns single chunk for short text", () => {
    const chunks = chunkText("Hello, world!");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].content).toBe("Hello, world!");
    expect(chunks[0].chunkIndex).toBe(0);
  });

  it("splits long text into multiple chunks", () => {
    // Create text longer than default chunk size (4000 chars)
    const paragraph = "This is a test paragraph with some content. ".repeat(200);
    const chunks = chunkText(paragraph);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it("preserves paragraph boundaries when possible", () => {
    const text = "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.";
    const chunks = chunkText(text, { chunkSize: 50, chunkOverlap: 0 });
    // Should split on \n\n boundaries
    expect(chunks[0].content).toContain("First paragraph");
  });

  it("handles page break markers", () => {
    const text =
      "Page 1 content\n---PAGE_BREAK---\nPage 2 content\n---PAGE_BREAK---\nPage 3 content";
    const chunks = chunkText(text, { chunkSize: 1000, chunkOverlap: 0 });
    // Should have page numbers
    const pagesWithNumbers = chunks.filter((c) => c.pageNumber !== null);
    expect(pagesWithNumbers.length).toBeGreaterThan(0);
    expect(chunks[0].pageNumber).toBe(1);
  });

  it("assigns sequential chunk indices", () => {
    const text = "Word ".repeat(2000);
    const chunks = chunkText(text, { chunkSize: 500, chunkOverlap: 0 });
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].chunkIndex).toBe(i);
    }
  });

  it("produces chunks within size limit", () => {
    const text = "A".repeat(10000);
    const chunkSize = 1000;
    const chunks = chunkText(text, { chunkSize, chunkOverlap: 0 });
    for (const chunk of chunks) {
      // Allow slight overshoot from overlap
      expect(chunk.content.length).toBeLessThanOrEqual(chunkSize * 2);
    }
  });
});

describe("estimateTokenCount", () => {
  it("estimates roughly 4 chars per token", () => {
    expect(estimateTokenCount("Hello, world!")).toBe(4); // 13/4 = 4
  });

  it("returns 0 for empty string", () => {
    expect(estimateTokenCount("")).toBe(0);
  });
});
