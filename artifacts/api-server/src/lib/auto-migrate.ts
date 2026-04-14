import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function autoMigrate() {
  try {
    logger.info("autoMigrate: checking production schema...");

    await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id SERIAL PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        plan TEXT NOT NULL DEFAULT 'free',
        trial_ends_at TIMESTAMP,
        subscription_ends_at TIMESTAMP,
        contact_name TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL REFERENCES companies(id),
        plan TEXT NOT NULL,
        amount INTEGER NOT NULL,
        period_months INTEGER NOT NULL DEFAULT 1,
        proof_url TEXT,
        drive_file_id TEXT,
        status TEXT NOT NULL DEFAULT 'pending',
        submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
        reviewed_at TIMESTAMP,
        reviewed_by TEXT,
        notes TEXT
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL DEFAULT ''
      )
    `);

    const columnsToAdd: Array<{ table: string; column: string; definition: string }> = [
      { table: "users",              column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "incidents",          column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "categories",         column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "plants",             column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "groups",             column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "actions",            column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "incident_types",     column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "schedules",          column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "templates",          column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "indicators",         column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "preventive_actions", column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "smtp_settings",      column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "gdrive_settings",    column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
    ];

    for (const { table, column, definition } of columnsToAdd) {
      const { rows } = await pool.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_name = $1 AND column_name = $2
      `, [table, column]);

      if (rows.length === 0) {
        await pool.query(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "${column}" ${definition}`);
        logger.info(`autoMigrate: added ${column} to ${table}`);
      }
    }

    const { rows: companies } = await pool.query(`SELECT id FROM companies LIMIT 1`);

    if (companies.length === 0) {
      logger.info("autoMigrate: seeding initial KCI company data...");

      await pool.query(`
        INSERT INTO companies (id, slug, name, contact_name, contact_email, status, plan, subscription_ends_at, created_at, updated_at)
        VALUES (1, 'kci', 'KCI', 'KCI Admin', 'admin@kci.co.id', 'active', 'yearly', NOW() + INTERVAL '1 year', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `);

      await pool.query(`SELECT setval('companies_id_seq', GREATEST((SELECT COALESCE(MAX(id),1) FROM companies), 1))`);

      const tenantTables = [
        "users", "incidents", "categories", "plants", "groups",
        "actions", "incident_types", "schedules", "templates",
        "indicators", "preventive_actions", "smtp_settings", "gdrive_settings"
      ];

      for (const t of tenantTables) {
        try {
          const result = await pool.query(`UPDATE "${t}" SET company_id = 1 WHERE company_id IS NULL`);
          if (result.rowCount && result.rowCount > 0) {
            logger.info(`autoMigrate: updated ${result.rowCount} rows in ${t} with company_id=1`);
          }
        } catch {
        }
      }

      const { rows: existingSysadmin } = await pool.query(`SELECT id FROM users WHERE nik = 'SYSADMIN' LIMIT 1`);
      if (existingSysadmin.length === 0) {
        await pool.query(`
          INSERT INTO users (nik, name, email, password_hash, role, is_head, company_id)
          VALUES (
            'SYSADMIN',
            'System Administrator',
            'sysadmin@hse.local',
            crypt('sysadmin2024', gen_salt('bf', 10)),
            'sysadmin',
            false,
            NULL
          )
          ON CONFLICT DO NOTHING
        `);
        logger.info("autoMigrate: sysadmin user created");
      }

      await pool.query(`
        INSERT INTO system_settings (key, value) VALUES
          ('qris_url', ''),
          ('price_monthly', '250000'),
          ('price_yearly', '2250000'),
          ('trial_days', '30')
        ON CONFLICT (key) DO NOTHING
      `);

      logger.info("autoMigrate: initial production seed completed");
    } else {
      logger.info("autoMigrate: schema already migrated, skipping data seed");
    }
  } catch (err) {
    logger.warn({ err }, "autoMigrate: error during migration (non-fatal)");
  }
}
