import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const laggingIndicatorsTable = pgTable("lagging_indicators", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  year: integer("year").notNull(),
  fatality: integer("fatality").notNull().default(0),
  lti: integer("lti").notNull().default(0),
  mti: integer("mti").notNull().default(0),
  firstAid: integer("first_aid").notNull().default(0),
  nearMisses: integer("near_misses").notNull().default(0),
  hazardId: integer("hazard_id").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const nonLtiSettingsTable = pgTable("non_lti_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  resetDate: text("reset_date").notNull(),
  baseValue: integer("base_value").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type LaggingIndicator = typeof laggingIndicatorsTable.$inferSelect;
export type NonLtiSettings = typeof nonLtiSettingsTable.$inferSelect;
