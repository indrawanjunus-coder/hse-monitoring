import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { workPermitTypesTable } from "./work-permit-types";

export const workPermitsTable = pgTable("work_permits", {
  id: serial("id").primaryKey(),
  permitCode: text("permit_code").notNull().unique(),
  companyId: integer("company_id").references(() => companiesTable.id),
  typeId: integer("type_id").references(() => workPermitTypesTable.id),
  name: text("name").notNull(),
  phone: text("phone").notNull(),
  email: text("email").notNull(),
  emergencyName: text("emergency_name").notNull(),
  emergencyPhone: text("emergency_phone").notNull(),
  workStart: text("work_start").notNull(),
  workEnd: text("work_end").notNull(),
  supervisorName: text("supervisor_name").notNull(),
  supervisorPhone: text("supervisor_phone").notNull(),
  ktpUrl: text("ktp_url"),
  photoUrl: text("photo_url"),
  notes: text("notes"),
  status: text("status", { enum: ["active", "expired", "revoked"] }).notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkPermit = typeof workPermitsTable.$inferSelect;
