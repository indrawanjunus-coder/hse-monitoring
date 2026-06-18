import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const incidentTypesTable = pgTable("incident_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  code: text("code").notNull(),
  label: text("label").notNull(),
  description: text("description"),
  categoryId: integer("category_id"),
  probability: text("probability", { enum: ["rare", "unlikely", "possible", "likely", "almost_certain"] }),
  isActive: boolean("is_active").notNull().default(true),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIncidentTypeSchema = createInsertSchema(incidentTypesTable).omit({ id: true, createdAt: true });
export type InsertIncidentType = z.infer<typeof insertIncidentTypeSchema>;
export type IncidentType = typeof incidentTypesTable.$inferSelect;
