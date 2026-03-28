import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { questionsTable } from "./questions";

export const indicatorsTable = pgTable("indicators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("ISO"),
  targetPercentage: integer("target_percentage").notNull().default(100),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const indicatorQuestionsTable = pgTable("indicator_questions", {
  id: serial("id").primaryKey(),
  indicatorId: integer("indicator_id").notNull().references(() => indicatorsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questionsTable.id, { onDelete: "cascade" }),
  weight: integer("weight").notNull().default(1),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIndicatorSchema = createInsertSchema(indicatorsTable).omit({ id: true, createdAt: true });
export const insertIndicatorQuestionSchema = createInsertSchema(indicatorQuestionsTable).omit({ id: true, createdAt: true });
export type InsertIndicator = z.infer<typeof insertIndicatorSchema>;
export type Indicator = typeof indicatorsTable.$inferSelect;
export type IndicatorQuestion = typeof indicatorQuestionsTable.$inferSelect;
