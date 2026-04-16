import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  vector,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { notebooks } from "./notebooks";

export const sourceTypeEnum = pgEnum("source_type", [
  "pdf",
  "docx",
  "txt",
  "csv",
  "image",
  "url",
  "youtube",
]);

export const sourceStatusEnum = pgEnum("source_status", [
  "pending",
  "processing",
  "ready",
  "error",
]);

export const sources = pgTable(
  "sources",
  {
    id: text("id").primaryKey(),
    notebookId: text("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    type: sourceTypeEnum("type").notNull(),
    title: text("title").notNull(),
    fileUrl: text("file_url"),
    originalUrl: text("original_url"),
    rawText: text("raw_text"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    tokenCount: integer("token_count"),
    status: sourceStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("sources_notebook_id_idx").on(table.notebookId)]
);

export const sourceChunks = pgTable(
  "source_chunks",
  {
    id: text("id").primaryKey(),
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    chunkIndex: integer("chunk_index").notNull(),
    pageNumber: integer("page_number"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("source_chunks_source_id_idx").on(table.sourceId),
    index("source_chunks_embedding_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const sourcesRelations = relations(sources, ({ one, many }) => ({
  notebook: one(notebooks, {
    fields: [sources.notebookId],
    references: [notebooks.id],
  }),
  chunks: many(sourceChunks),
}));

export const sourceChunksRelations = relations(sourceChunks, ({ one }) => ({
  source: one(sources, {
    fields: [sourceChunks.sourceId],
    references: [sources.id],
  }),
}));

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type SourceChunk = typeof sourceChunks.$inferSelect;
export type NewSourceChunk = typeof sourceChunks.$inferInsert;
