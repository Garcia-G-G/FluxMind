export type TextChunk = {
  content: string;
  chunkIndex: number;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
};

const SEPARATORS = ["\n\n", "\n", ". ", " ", ""];

const splitBySeparator = (text: string, separator: string): string[] => {
  if (separator === "") return [...text];
  return text.split(separator);
};

const recursiveSplit = (
  text: string,
  chunkSize: number,
  separators: string[]
): string[] => {
  const results: string[] = [];
  const separator = separators[0];
  const remainingSeparators = separators.slice(1);
  const parts = splitBySeparator(text, separator);

  let current = "";
  for (const part of parts) {
    const candidate = current
      ? current + separator + part
      : part;

    if (candidate.length <= chunkSize) {
      current = candidate;
    } else {
      if (current) results.push(current);
      if (part.length > chunkSize && remainingSeparators.length > 0) {
        const subChunks = recursiveSplit(part, chunkSize, remainingSeparators);
        results.push(...subChunks);
        current = "";
      } else {
        current = part;
      }
    }
  }
  if (current) results.push(current);
  return results;
};

export const chunkText = (
  text: string,
  options: {
    chunkSize?: number;
    chunkOverlap?: number;
    pageBreakMarker?: string;
  } = {}
): TextChunk[] => {
  const {
    chunkSize = 4000,
    chunkOverlap = 800,
    pageBreakMarker = "\n---PAGE_BREAK---\n",
  } = options;

  if (!text.trim()) return [];

  // Split by pages first if markers exist
  const pages = text.includes(pageBreakMarker)
    ? text.split(pageBreakMarker)
    : [text];

  const chunks: TextChunk[] = [];
  let globalIndex = 0;

  for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
    const pageText = pages[pageIdx].trim();
    if (!pageText) continue;

    const pageNumber = pages.length > 1 ? pageIdx + 1 : null;
    const rawChunks = recursiveSplit(pageText, chunkSize, SEPARATORS);

    for (let i = 0; i < rawChunks.length; i++) {
      let content = rawChunks[i].trim();
      if (!content) continue;

      // Add overlap from previous chunk
      if (i > 0 && chunkOverlap > 0) {
        const prevChunk = rawChunks[i - 1];
        const overlapText = prevChunk.slice(-chunkOverlap);
        content = overlapText + content;
      }

      chunks.push({
        content,
        chunkIndex: globalIndex++,
        pageNumber,
        metadata: {},
      });
    }
  }

  return chunks;
};

export const estimateTokenCount = (text: string): number => {
  // Rough estimate: ~4 characters per token for English text
  return Math.ceil(text.length / 4);
};
