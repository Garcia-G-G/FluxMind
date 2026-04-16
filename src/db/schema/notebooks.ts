import {
  pgTable,
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  primaryKey,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { users } from "./users";

export const collaboratorRoleEnum = pgEnum("collaborator_role", [
  "viewer",
  "editor",
  "owner",
]);

export const notebooks = pgTable(
  "notebooks",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    icon: text("icon"),
    coverImage: text("cover_image"),
    isPublic: boolean("is_public").notNull().default(false),
    settings: jsonb("settings").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [index("notebooks_user_id_idx").on(table.userId)]
);

export const notebookCollaborators = pgTable(
  "notebook_collaborators",
  {
    notebookId: text("notebook_id")
      .notNull()
      .references(() => notebooks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: collaboratorRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.notebookId, table.userId] }),
  ]
);

export const notebooksRelations = relations(notebooks, ({ one, many }) => ({
  user: one(users, {
    fields: [notebooks.userId],
    references: [users.id],
  }),
  collaborators: many(notebookCollaborators),
}));

export const notebookCollaboratorsRelations = relations(
  notebookCollaborators,
  ({ one }) => ({
    notebook: one(notebooks, {
      fields: [notebookCollaborators.notebookId],
      references: [notebooks.id],
    }),
    user: one(users, {
      fields: [notebookCollaborators.userId],
      references: [users.id],
    }),
  })
);

export type Notebook = typeof notebooks.$inferSelect;
export type NewNotebook = typeof notebooks.$inferInsert;
