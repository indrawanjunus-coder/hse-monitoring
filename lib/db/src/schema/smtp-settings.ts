import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const smtpSettingsTable = pgTable("smtp_settings", {
  id: serial("id").primaryKey(),
  host: text("host").notNull().default(""),
  port: integer("port").notNull().default(587),
  protocol: text("protocol", { enum: ["TLS", "STARTTLS"] }).notNull().default("STARTTLS"),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  fromName: text("from_name").notNull().default("HSE System"),
  fromEmail: text("from_email").notNull().default(""),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSmtpSettingsSchema = createInsertSchema(smtpSettingsTable).omit({ id: true, updatedAt: true });
export type InsertSmtpSettings = z.infer<typeof insertSmtpSettingsSchema>;
