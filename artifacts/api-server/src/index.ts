import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";
import { startReminderCron } from "./lib/reminders";
import { autoMigrate } from "./lib/auto-migrate";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function fixSequences() {
  const sequences: Array<{ seq: string; table: string }> = [
    { seq: "users_id_seq", table: "users" },
    { seq: "incident_types_id_seq", table: "incident_types" },
    { seq: "categories_id_seq", table: "categories" },
    { seq: "departments_id_seq", table: "departments" },
    { seq: "groups_id_seq", table: "groups" },
    { seq: "actions_id_seq", table: "actions" },
    { seq: "incidents_id_seq", table: "incidents" },
    { seq: "inspections_id_seq", table: "inspections" },
    { seq: "templates_id_seq", table: "templates" },
    { seq: "plants_id_seq", table: "plants" },
    { seq: "schedules_id_seq", table: "schedules" },
    { seq: "system_logs_id_seq", table: "system_logs" },
    { seq: "preventive_actions_id_seq", table: "preventive_actions" },
    { seq: "group_members_id_seq", table: "group_members" },
    { seq: "questions_id_seq", table: "questions" },
    { seq: "indicators_id_seq", table: "indicators" },
  ];

  for (const { seq, table } of sequences) {
    try {
      await pool.query(`SELECT setval('${seq}', GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${table}"), 1))`);
    } catch {
    }
  }
  logger.info("DB sequences synced");
}

autoMigrate().then(() => fixSequences()).then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startReminderCron();
  });
}).catch((err) => {
  logger.error({ err }, "Failed to fix sequences, starting anyway");
  app.listen(port, (err2) => {
    if (err2) {
      logger.error({ err: err2 }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
    startReminderCron();
  });
});
