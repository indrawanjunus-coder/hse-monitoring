import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { templatesTable } from "./templates";
import { categoriesTable } from "./categories";

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id").notNull().references(() => templatesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  answerType: text("answer_type", { enum: ["yes_no", "text", "master_user", "master_group", "master_action"] }).notNull().default("yes_no"),
  questionType: text("question_type", { enum: ["near_miss", "accident", "unsafe_act", "unsafe_condition"] }),
  isMandatory: boolean("is_mandatory").notNull().default(true),
  requiresPhoto: boolean("requires_photo").notNull().default(false),
  categoryId: integer("category_id").references(() => categoriesTable.id),
  orderIndex: integer("order_index").notNull().default(0),
  expectedAnswer: text("expected_answer"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuestionSchema = createInsertSchema(questionsTable).omit({ id: true, createdAt: true });
export type InsertQuestion = z.infer<typeof insertQuestionSchema>;
export type Question = typeof questionsTable.$inferSelect;
