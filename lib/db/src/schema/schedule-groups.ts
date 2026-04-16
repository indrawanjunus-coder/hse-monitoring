import { integer, pgTable, serial } from "drizzle-orm/pg-core";
import { schedulesTable } from "./schedules";
import { groupsTable } from "./groups";

export const scheduleGroupsTable = pgTable("schedule_groups", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => groupsTable.id, { onDelete: "cascade" }),
});
