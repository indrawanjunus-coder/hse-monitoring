import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const preventiveActionsTable = pgTable("preventive_actions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPreventiveActionSchema = createInsertSchema(preventiveActionsTable).omit({ id: true, createdAt: true });
export type InsertPreventiveAction = z.infer<typeof insertPreventiveActionSchema>;
export type PreventiveAction = typeof preventiveActionsTable.$inferSelect;
