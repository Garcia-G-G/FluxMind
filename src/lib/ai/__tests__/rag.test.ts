import { describe, it, expect } from "vitest";
import {
  buildContextString,
  buildSystemPrompt,
  parseCitations,
  type RetrievedChunk,
} from "@/lib/ai/rag";

const mockChunks: RetrievedChunk[] = [
  {
    chunkId: "c1",
    content: "Machine learning is a subset of artificial intelligence.",
    chunkIndex: 0,
    pageNumber: 1,
    sourceId: "s1",
    sourceTitle: "AI Fundamentals",
    sourceType: "pdf",
    similarity: 0.92,
  },
  {
    chunkId: "c2",
    content: "Neural networks are inspired by biological neurons.",
    chunkIndex: 3,
    pageNumber: 5,
    sourceId: "s2",
    sourceTitle: "Deep Learning Guide",
    sourceType: "pdf",
    similarity: 0.85,
  },
];

describe("buildContextString", () => {
  it("formats chunks with source numbers and titles", () => {
    const context = buildContextString(mockChunks);
    expect(context).toContain('[Source 1: "AI Fundamentals" (Page 1)]');
    expect(context).toContain('[Source 2: "Deep Learning Guide" (Page 5)]');
    expect(context).toContain("Machine learning");
    expect(context).toContain("Neural networks");
  });

  it("returns fallback for empty chunks", () => {
    expect(buildContextString([])).toBe("No relevant sources found.");
  });
});

describe("buildSystemPrompt", () => {
  it("includes system instructions and source context", () => {
    const prompt = buildSystemPrompt(mockChunks);
    expect(prompt).toContain("FluxMind");
    expect(prompt).toContain("CRITICAL RULES");
    expect(prompt).toContain('[Source: "Title"');
    expect(prompt).toContain("AI Fundamentals");
  });

  it("handles empty chunks gracefully", () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain("No relevant sources found");
  });
});

describe("parseCitations", () => {
  it("extracts citations from text", () => {
    const text =
      'Machine learning is important [Source: "AI Fundamentals" p.1]. Neural networks power deep learning [Source: "Deep Learning Guide" p.5].';
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(2);
    expect(citations[0].sourceTitle).toBe("AI Fundamentals");
    expect(citations[0].pageNumber).toBe(1);
    expect(citations[0].sourceId).toBe("s1");
    expect(citations[1].sourceTitle).toBe("Deep Learning Guide");
    expect(citations[1].pageNumber).toBe(5);
  });

  it("handles citations without page numbers", () => {
    const text = 'This is from [Source: "Some Doc"].';
    const citations = parseCitations(text, []);
    expect(citations).toHaveLength(1);
    expect(citations[0].sourceTitle).toBe("Some Doc");
    expect(citations[0].pageNumber).toBeNull();
    expect(citations[0].sourceId).toBeNull();
  });

  it("deduplicates identical citations", () => {
    const text =
      'First [Source: "AI Fundamentals" p.1]. Second [Source: "AI Fundamentals" p.1].';
    const citations = parseCitations(text, mockChunks);
    expect(citations).toHaveLength(1);
  });

  it("returns empty array for text with no citations", () => {
    const citations = parseCitations("No citations here.", mockChunks);
    expect(citations).toHaveLength(0);
  });
});
