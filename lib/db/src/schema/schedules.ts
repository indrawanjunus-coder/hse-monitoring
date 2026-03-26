import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { templatesTable } from "./templates";
import { plantsTable } from "./plants";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisor_id").notNull().references(() => usersTable.id),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  weekStart: text("week_start").notNull(),
  weekEnd: text("week_end").notNull(),
  status: text("status", { enum: ["pending", "completed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
