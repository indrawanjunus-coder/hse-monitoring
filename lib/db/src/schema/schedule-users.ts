import { integer, pgTable, serial } from "drizzle-orm/pg-core";
import { schedulesTable } from "./schedules";
import { usersTable } from "./users";

export const scheduleUsersTable = pgTable("schedule_users", {
  id: serial("id").primaryKey(),
  scheduleId: integer("schedule_id").notNull().references(() => schedulesTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});
