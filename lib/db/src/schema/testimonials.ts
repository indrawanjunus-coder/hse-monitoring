import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { usersTable } from "./users";

export const testimonialsTable = pgTable("testimonials", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  userId: integer("user_id").references(() => usersTable.id),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull().default(""),
  authorCompany: text("author_company").notNull().default(""),
  content: text("content").notNull(),
  rating: integer("rating").notNull().default(5),
  isActive: boolean("is_active").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Testimonial = typeof testimonialsTable.$inferSelect;
