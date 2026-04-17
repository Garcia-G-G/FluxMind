import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  boolean,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { notebooks } from "./notebooks";
import { users } from "./users";

export const outputTypeEnum = pgEnum("output_type", [
  "podcast",
  "video",
  "mindmap",
  "slides",
  "infographic",
  "quiz",
  "flashcards",
  "data_table",
  "thread",
  "newsletter",
  "course",
  "research_report",
]);

export const outputStatusEnum = pgEnum("output_status", [
  "pending",
  "generating",
  "ready",
  "error",
]);

export const outputs = pgTable(
  "outputs",
  {
    id: text("id").primaryKey(),
    notebookId: text("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: outputTypeEnum("type").notNull(),
    title: text("title").notNull(),
    content: jsonb("content").$type<Record<string, unknown>>(),
    fileUrl: text("file_url"),
    thumbnailUrl: text("thumbnail_url"),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    isPublic: boolean("is_public").notNull().default(false),
    likes: integer("likes").notNull().default(0),
    duration: integer("duration"),
    status: outputStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("outputs_notebook_id_idx").on(table.notebookId),
    index("outputs_user_id_idx").on(table.userId),
    index("outputs_type_idx").on(table.type),
  ]
);

export const outputsRelations = relations(outputs, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [outputs.notebookId],
    references: [notebooks.id],
  }),
  user: one(users, {
    fields: [outputs.userId],
    references: [users.id],
  }),
}));

export type Output = typeof outputs.$inferSelect;
export type NewOutput = typeof outputs.$inferInsert;
