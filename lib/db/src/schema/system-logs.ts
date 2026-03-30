import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const systemLogsTable = pgTable("system_logs", {
  id: serial("id").primaryKey(),
  level: text("level").notNull().default("info"),
  method: text("method"),
  url: text("url"),
  statusCode: integer("status_code"),
  userId: integer("user_id"),
  userNik: text("user_nik"),
  userName: text("user_name"),
  errorMessage: text("error_message"),
  summary: text("summary"),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SystemLog = typeof systemLogsTable.$inferSelect;
