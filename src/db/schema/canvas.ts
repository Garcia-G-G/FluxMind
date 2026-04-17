import {
  pgTable,
  text,
  timestamp,
  jsonb,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { notebooks } from "./notebooks";

export const canvasNodeTypeEnum = pgEnum("canvas_node_type", [
  "snapshot",
  "source",
  "output",
  "note",
  "image",
  "link",
  "group",
]);

export const canvasNodes = pgTable(
  "canvas_nodes",
  {
    id: text("id").primaryKey(),
    notebookId: text("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    type: canvasNodeTypeEnum("type").notNull(),
    referenceId: text("reference_id"),
    position: jsonb("position")
      .notNull()
      .$type<{ x: number; y: number }>(),
    size: jsonb("size")
      .notNull()
      .$type<{ width: number; height: number }>(),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("canvas_nodes_notebook_id_idx").on(table.notebookId)]
);

export const canvasNodesRelations = relations(canvasNodes, ({ one }) => ({
  notebook: one(notebooks, {
    fields: [canvasNodes.notebookId],
    references: [notebooks.id],
  }),
}));

export type CanvasNode = typeof canvasNodes.$inferSelect;
export type NewCanvasNode = typeof canvasNodes.$inferInsert;
