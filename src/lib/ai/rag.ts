import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { generateEmbedding } from "@/lib/ai/embeddings";

export type RetrievedChunk = {
  chunkId: string;
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  sourceId: string;
  sourceTitle: string;
  sourceType: string;
  similarity: number;
};

export const retrieveContext = async (
  notebookId: string,
  query: string,
  topK = 20
): Promise<RetrievedChunk[]> => {
  const queryEmbedding = await generateEmbedding(query);
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const results = await db.execute<{
    chunk_id: string;
    content: string;
    chunk_index: number;
    page_number: number | null;
    source_id: string;
    source_title: string;
    source_type: string;
    similarity: number;
  }>(sql`
    SELECT
      sc.id as chunk_id,
      sc.content,
      sc.chunk_index,
      sc.page_number,
      s.id as source_id,
      s.title as source_title,
      s.type as source_type,
      1 - (sc.embedding <=> ${embeddingStr}::vector) as similarity
    FROM source_chunks sc
    JOIN sources s ON s.id = sc.source_id
    WHERE s.notebook_id = ${notebookId} AND s.status = 'ready'
    ORDER BY sc.embedding <=> ${embeddingStr}::vector
    LIMIT ${topK}
  `);

  // Filter by minimum similarity threshold
  const filtered = results.filter((r) => r.similarity > 0.3);

  // Deduplicate adjacent chunks from same source
  const deduplicated: RetrievedChunk[] = [];
  for (const row of filtered) {
    const existing = deduplicated.find(
      (d) =>
        d.sourceId === row.source_id &&
        Math.abs(d.chunkIndex - row.chunk_index) <= 1
    );
    if (existing) {
      // Merge adjacent chunks — keep the one with higher similarity
      if (row.similarity > existing.similarity) {
        existing.content = row.content;
        existing.chunkId = row.chunk_id;
        existing.chunkIndex = row.chunk_index;
        existing.pageNumber = row.page_number;
        existing.similarity = row.similarity;
      }
    } else {
      deduplicated.push({
        chunkId: row.chunk_id,
        content: row.content,
        chunkIndex: row.chunk_index,
        pageNumber: row.page_number,
        sourceId: row.source_id,
        sourceTitle: row.source_title,
        sourceType: row.source_type,
        similarity: row.similarity,
      });
    }
  }

  return deduplicated;
};

export const buildContextString = (chunks: RetrievedChunk[]): string => {
  if (chunks.length === 0) return "No relevant sources found.";

  return chunks
    .map((chunk, i) => {
      const pageInfo = chunk.pageNumber ? ` (Page ${chunk.pageNumber})` : "";
      return `[Source ${i + 1}: "${chunk.sourceTitle}"${pageInfo}]\n${chunk.content}`;
    })
    .join("\n\n---\n\n");
};

export const buildSystemPrompt = (chunks: RetrievedChunk[]): string => {
  const context = buildContextString(chunks);

  return `You are FluxMind, an AI research assistant. You help users understand and analyze their uploaded sources.

CRITICAL RULES:
1. Answer ONLY using information from the provided sources below. Never use external knowledge.
2. After every claim or piece of information, cite the source using this exact format: [Source: "Title" p.X] where X is the page number, or [Source: "Title"] if no page number is available.
3. If the question cannot be answered from the sources, respond: "I couldn't find information about this in your sources. Try uploading more relevant documents or use Deep Research to search the web."
4. Be thorough but concise. Use the same language as the user's question.
5. When synthesizing across multiple sources, mention each source that contributed.
6. Structure long answers with clear sections. Use bullet points only when listing specific items.

## Available Sources:
${context}`;
};

export type CitationRef = {
  sourceTitle: string;
  pageNumber: number | null;
  sourceId: string | null;
};

const CITATION_REGEX = /\[Source:\s*"([^"]+)"(?:\s*p\.(\d+))?\]/g;

export const parseCitations = (
  text: string,
  chunks: RetrievedChunk[]
): CitationRef[] => {
  const citations: CitationRef[] = [];
  const seen = new Set<string>();
  let match;

  while ((match = CITATION_REGEX.exec(text)) !== null) {
    const title = match[1];
    const page = match[2] ? parseInt(match[2], 10) : null;
    const key = `${title}:${page}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const chunk = chunks.find(
      (c) => c.sourceTitle === title
    );

    citations.push({
      sourceTitle: title,
      pageNumber: page,
      sourceId: chunk?.sourceId ?? null,
    });
  }

  return citations;
};
