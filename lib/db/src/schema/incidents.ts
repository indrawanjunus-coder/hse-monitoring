import { boolean, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { plantsTable } from "./plants";
import { categoriesTable } from "./categories";
import { actionsTable } from "./actions";
import { groupsTable } from "./groups";
import { preventiveActionsTable } from "./preventive-actions";
import { companiesTable } from "./companies";

export const incidentsTable = pgTable("incidents", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  reporterId: integer("reporter_id").notNull().references(() => usersTable.id),
  plantId: integer("plant_id").notNull().references(() => plantsTable.id),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id),
  incidentDate: text("incident_date").notNull(),
  reportedDate: text("reported_date").notNull(),
  detail: text("detail").notNull(),
  incidentType: text("incident_type", { enum: ["near_miss", "accident", "unsafe_act", "unsafe_condition"] }),
  actionId: integer("action_id").references(() => actionsTable.id),
  preventiveActionId: integer("preventive_action_id").references(() => preventiveActionsTable.id),
  targetDate: text("target_date"),
  rootCause: text("root_cause"),
  needsFurtherAction: boolean("needs_further_action").notNull().default(false),
  status: text("status", { enum: ["open", "in_progress", "closed"] }).notNull().default("open"),
  assignedGroupId: integer("assigned_group_id").references(() => groupsTable.id),
  assignedUserId: integer("assigned_user_id").references(() => usersTable.id),
  followupNote: text("followup_note"),
  closedAt: text("closed_at"),
  escalationLevel: integer("escalation_level").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertIncidentSchema = createInsertSchema(incidentsTable).omit({ id: true, createdAt: true });
export type InsertIncident = z.infer<typeof insertIncidentSchema>;
export type Incident = typeof incidentsTable.$inferSelect;
