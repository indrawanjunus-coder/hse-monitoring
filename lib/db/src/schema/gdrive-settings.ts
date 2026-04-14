import { integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { companiesTable } from "./companies";

export const gdriveSettingsTable = pgTable("gdrive_settings", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id),
  clientEmail: text("client_email").notNull().default(""),
  privateKey: text("private_key").notNull().default(""),
  rootFolderId: text("root_folder_id").notNull().default("0AIi51ZRCyt6JUk9PVA"),
  maxAttachmentSizeMb: integer("max_attachment_size_mb").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
