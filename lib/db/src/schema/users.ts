import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { departmentsTable } from "./departments";
import { companiesTable } from "./companies";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  nik: text("nik").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: ["admin", "supervisor", "employee", "sysadmin"] }).notNull().default("employee"),
  departmentId: integer("department_id").references(() => departmentsTable.id),
  isHead: boolean("is_head").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
