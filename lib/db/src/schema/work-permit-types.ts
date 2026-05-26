import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const workPermitTypesTable = pgTable("work_permit_types", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  type: text("type").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkPermitType = typeof workPermitTypesTable.$inferSelect;
