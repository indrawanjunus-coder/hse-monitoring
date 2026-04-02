import { pgTable, serial, integer, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { incidentsTable } from "./incidents";
import { usersTable } from "./users";

export const incidentCommentsTable = pgTable("incident_comments", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => incidentsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "set null" }),
  userName: varchar("user_name", { length: 255 }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
