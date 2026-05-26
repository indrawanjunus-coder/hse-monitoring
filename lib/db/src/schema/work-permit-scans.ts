import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { workPermitsTable } from "./work-permits";

export const workPermitScansTable = pgTable("work_permit_scans", {
  id: serial("id").primaryKey(),
  workPermitId: integer("work_permit_id").notNull().references(() => workPermitsTable.id),
  scannedAt: timestamp("scanned_at").notNull().defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkPermitScan = typeof workPermitScansTable.$inferSelect;
