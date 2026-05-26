import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { workPermitsTable } from "./work-permits";
import { usersTable } from "./users";

export const workPermitApprovalsTable = pgTable("work_permit_approvals", {
  id: serial("id").primaryKey(),
  workPermitId: integer("work_permit_id").notNull().references(() => workPermitsTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
  approvedAt: timestamp("approved_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkPermitApproval = typeof workPermitApprovalsTable.$inferSelect;
