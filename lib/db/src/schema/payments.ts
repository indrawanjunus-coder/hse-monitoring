import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { companiesTable } from "./companies";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => companiesTable.id),
  plan: text("plan", { enum: ["free", "monthly", "yearly"] }).notNull(),
  amount: integer("amount").notNull().default(0),
  periodMonths: integer("period_months").notNull().default(1),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  proofDriveFileId: text("proof_drive_file_id"),
  proofFileName: text("proof_file_name"),
  proofViewUrl: text("proof_view_url"),
  submittedAt: timestamp("submitted_at").notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
  reviewedByNote: text("reviewed_by_note"),
  periodStart: text("period_start"),
  periodEnd: text("period_end"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({ id: true, createdAt: true });
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;

export const systemSettingsTable = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
