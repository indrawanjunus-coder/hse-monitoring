import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const gdriveSettingsTable = pgTable("gdrive_settings", {
  id: serial("id").primaryKey(),
  clientEmail: text("client_email").notNull().default(""),
  privateKey: text("private_key").notNull().default(""),
  rootFolderId: text("root_folder_id").notNull().default("0AIi51ZRCyt6JUk9PVA"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
