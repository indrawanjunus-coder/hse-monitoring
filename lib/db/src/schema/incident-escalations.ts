import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { incidentsTable } from "./incidents";
import { groupsTable } from "./groups";
import { usersTable } from "./users";

export const incidentEscalationsTable = pgTable("incident_escalations", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => incidentsTable.id),
  fromGroupId: integer("from_group_id").references(() => groupsTable.id),
  toGroupId: integer("to_group_id").notNull().references(() => groupsTable.id),
  reason: text("reason").notNull(),
  escalatedByUserId: integer("escalated_by_user_id").notNull().references(() => usersTable.id),
  escalatedByUserName: text("escalated_by_user_name").notNull(),
  escalatedAt: timestamp("escalated_at").notNull().defaultNow(),
});

export type IncidentEscalation = typeof incidentEscalationsTable.$inferSelect;
