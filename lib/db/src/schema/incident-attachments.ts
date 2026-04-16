import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { incidentsTable } from "./incidents";
import { usersTable } from "./users";

export const incidentAttachmentsTable = pgTable("incident_attachments", {
  id: serial("id").primaryKey(),
  incidentId: integer("incident_id").notNull().references(() => incidentsTable.id, { onDelete: "cascade" }),
  driveFileId: text("drive_file_id").notNull(),
  fileName: text("file_name").notNull(),
  storedName: text("stored_name").notNull(),
  viewUrl: text("view_url").notNull(),
  mimeType: text("mime_type").notNull().default("application/octet-stream"),
  fileSize: integer("file_size").notNull().default(0),
  sequence: integer("sequence").notNull().default(1),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
});
