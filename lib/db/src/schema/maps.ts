import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const mapsTable = pgTable("maps", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  name: text("name").notNull(),
  driveFileId: text("drive_file_id"),
  viewUrl: text("view_url"),
  fileType: text("file_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type MapRecord = typeof mapsTable.$inferSelect;
