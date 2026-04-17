import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  pgEnum,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { outputs } from "./outputs";
import { users } from "./users";

export const flashcardStatusEnum = pgEnum("flashcard_status", [
  "new",
  "learning",
  "review",
  "mastered",
]);

export const quizProgress = pgTable(
  "quiz_progress",
  {
    id: text("id").primaryKey(),
    outputId: text("output_id")
      .notNull()
      .references(() => outputs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    totalQuestions: integer("total_questions").notNull(),
    answers: jsonb("answers").$type<
      Array<{
        questionIndex: number;
        selectedAnswer: string;
        correct: boolean;
      }>
    >(),
    completedAt: timestamp("completed_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("quiz_progress_output_id_idx").on(table.outputId),
    index("quiz_progress_user_id_idx").on(table.userId),
  ]
);

export const flashcardProgress = pgTable(
  "flashcard_progress",
  {
    id: text("id").primaryKey(),
    outputId: text("output_id")
      .notNull()
      .references(() => outputs.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    cardIndex: integer("card_index").notNull(),
    status: flashcardStatusEnum("status").notNull().default("new"),
    easeFactor: real("ease_factor").notNull().default(2.5),
    interval: integer("interval").notNull().default(0),
    nextReview: timestamp("next_review", { mode: "date" }),
    repetitions: integer("repetitions").notNull().default(0),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("flashcard_progress_output_id_idx").on(table.outputId),
    index("flashcard_progress_user_id_idx").on(table.userId),
  ]
);

export const quizProgressRelations = relations(quizProgress, ({ one }) => ({
  output: one(outputs, {
    fields: [quizProgress.outputId],
    references: [outputs.id],
  }),
  user: one(users, {
    fields: [quizProgress.userId],
    references: [users.id],
  }),
}));

export const flashcardProgressRelations = relations(
  flashcardProgress,
  ({ one }) => ({
    output: one(outputs, {
      fields: [flashcardProgress.outputId],
      references: [outputs.id],
    }),
    user: one(users, {
      fields: [flashcardProgress.userId],
      references: [users.id],
    }),
  })
);

export type QuizProgress = typeof quizProgress.$inferSelect;
export type NewQuizProgress = typeof quizProgress.$inferInsert;
export type FlashcardProgress = typeof flashcardProgress.$inferSelect;
export type NewFlashcardProgress = typeof flashcardProgress.$inferInsert;
