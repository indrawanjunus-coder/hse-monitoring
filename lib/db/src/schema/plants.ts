import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const plantsTable = pgTable("plants", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  name: text("name").notNull(),
  code: text("code").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPlantSchema = createInsertSchema(plantsTable).omit({ id: true, createdAt: true });
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plantsTable.$inferSelect;
