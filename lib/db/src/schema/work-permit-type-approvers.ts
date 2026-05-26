import { integer, pgTable, serial, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";
import { workPermitTypesTable } from "./work-permit-types";
import { usersTable } from "./users";

export const workPermitTypeApproversTable = pgTable("work_permit_type_approvers", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  workPermitTypeId: integer("work_permit_type_id").notNull().references(() => workPermitTypesTable.id),
  userId: integer("user_id").notNull().references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkPermitTypeApprover = typeof workPermitTypeApproversTable.$inferSelect;
