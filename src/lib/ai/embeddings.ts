import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const EMBEDDING_DIMENSIONS = 1536;
const BATCH_SIZE = 20;

const shouldMockEmbeddings = (): boolean => {
  return process.env.MOCK_EMBEDDINGS === "true" || !process.env.OPENAI_API_KEY;
};

const generateMockEmbedding = (): number[] => {
  // Deterministic-ish mock embedding based on random values, normalized
  const vec = Array.from({ length: EMBEDDING_DIMENSIONS }, () =>
    Math.random() * 2 - 1
  );
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return vec.map((v) => v / norm);
};

export const generateEmbedding = async (text: string): Promise<number[]> => {
  if (shouldMockEmbeddings()) {
    return generateMockEmbedding();
  }

  const { embedding } = await embed({
    model: openai.embedding("text-embedding-3-small"),
    value: text,
  });
  return embedding;
};

export const generateEmbeddings = async (
  texts: string[]
): Promise<number[][]> => {
  if (shouldMockEmbeddings()) {
    return texts.map(() => generateMockEmbedding());
  }

  const results: number[][] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const { embeddings } = await embedMany({
      model: openai.embedding("text-embedding-3-small"),
      values: batch,
    });
    results.push(...embeddings);

    // Small delay between batches to be gentle on rate limits
    if (i + BATCH_SIZE < texts.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
};

export { EMBEDDING_DIMENSIONS };
