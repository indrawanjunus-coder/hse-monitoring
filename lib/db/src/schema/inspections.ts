import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { schedulesTable } from "./schedules";
import { usersTable } from "./users";
import { templatesTable } from "./templates";
import { plantsTable } from "./plants";
import { questionsTable } from "./questions";

export const inspectionsTable = pgTable("inspections", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id),
  supervisorId: integer("supervisor_id").notNull().references(() => usersTable.id),
  plantId: integer("plant_id").references(() => plantsTable.id),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  inspectedAt: text("inspected_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const inspectionAnswersTable = pgTable("inspection_answers", {
  id: serial("id").primaryKey(),
  inspectionId: integer("inspection_id").notNull().references(() => inspectionsTable.id, { onDelete: "cascade" }),
  questionId: integer("question_id").notNull().references(() => questionsTable.id),
  answerYesNo: boolean("answer_yes_no"),
  answerText: text("answer_text"),
  answerRefId: integer("answer_ref_id"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertInspectionSchema = createInsertSchema(inspectionsTable).omit({ id: true, createdAt: true });
export const insertInspectionAnswerSchema = createInsertSchema(inspectionAnswersTable).omit({ id: true, createdAt: true });
export type InsertInspection = z.infer<typeof insertInspectionSchema>;
export type InsertInspectionAnswer = z.infer<typeof insertInspectionAnswerSchema>;
export type Inspection = typeof inspectionsTable.$inferSelect;
export type InspectionAnswer = typeof inspectionAnswersTable.$inferSelect;
