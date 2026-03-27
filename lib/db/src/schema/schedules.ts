import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { templatesTable } from "./templates";
import { plantsTable } from "./plants";
import { groupsTable } from "./groups";

export const schedulesTable = pgTable("schedules", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisor_id").references(() => usersTable.id),
  groupId: integer("group_id").references(() => groupsTable.id),
  templateId: integer("template_id").notNull().references(() => templatesTable.id),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  frequency: text("frequency", { enum: ["daily", "weekly", "biweekly", "monthly", "custom"] }).notNull().default("weekly"),
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  customDays: text("custom_days"),
  weekStart: text("week_start"),
  weekEnd: text("week_end"),
  isActive: integer("is_active").notNull().default(1),
  status: text("status", { enum: ["pending", "completed"] }).notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertScheduleSchema = createInsertSchema(schedulesTable).omit({ id: true, createdAt: true });
export type InsertSchedule = z.infer<typeof insertScheduleSchema>;
export type Schedule = typeof schedulesTable.$inferSelect;
