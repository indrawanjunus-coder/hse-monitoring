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
      { table: "incidents",          column: "company_id",       definition: "INTEGER REFERENCES companies(id)" },
      { table: "incidents",          column: "assigned_user_id", definition: "INTEGER REFERENCES users(id)" },
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
      { table: "departments",        column: "company_id", definition: "INTEGER REFERENCES companies(id)" },
      { table: "incidents",          column: "map_id",      definition: "INTEGER" },
      { table: "incidents",          column: "map_markers",  definition: "TEXT" },
      { table: "inspections",        column: "map_id",      definition: "INTEGER" },
      { table: "inspections",        column: "map_markers",  definition: "TEXT" },
      { table: "maps",               column: "drive_file_id", definition: "TEXT" },
      { table: "maps",               column: "view_url",      definition: "TEXT" },
      { table: "non_lti_settings",   column: "walk_talk_template_id",   definition: "INTEGER" },
      { table: "non_lti_settings",   column: "hazard_template_id",      definition: "INTEGER" },
      { table: "non_lti_settings",   column: "work_hours_manual",        definition: "INTEGER DEFAULT 0" },
      { table: "non_lti_settings",   column: "num_shifts",               definition: "INTEGER DEFAULT 1" },
      { table: "non_lti_settings",   column: "num_employees",            definition: "INTEGER DEFAULT 0" },
      { table: "non_lti_settings",   column: "num_outsource",            definition: "INTEGER DEFAULT 0" },
      { table: "non_lti_settings",   column: "contractor_hours",         definition: "INTEGER DEFAULT 0" },
      { table: "non_lti_settings",   column: "monthly_hazard_allowance", definition: "INTEGER DEFAULT 0" },
      { table: "work_permits",       column: "user_id",               definition: "INTEGER REFERENCES users(id)" },
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
        "indicators", "preventive_actions", "smtp_settings", "gdrive_settings",
        "departments"
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
        // [SECURITY H3] Use env var for default sysadmin password — never hardcode in source
        const bcrypt = await import("bcryptjs");
        const defaultPw = process.env["SYSADMIN_DEFAULT_PASSWORD"] ?? "ChangeMe_" + Math.random().toString(36).slice(2, 10);
        const sysadminPwHash = await bcrypt.hash(defaultPw, 12);
        await pool.query(`
          INSERT INTO users (nik, name, email, password_hash, role, is_head, company_id)
          VALUES (
            'SYSADMIN',
            'System Administrator',
            'sysadmin@hse.local',
            $1,
            'sysadmin',
            false,
            NULL
          )
          ON CONFLICT DO NOTHING
        `, [sysadminPwHash]);
        logger.info("autoMigrate: sysadmin user created with bcrypt hash");
      } else {
        // [SECURITY H2] If existing sysadmin still has legacy SHA-256 hash (64-char hex), migrate to bcrypt
        const { rows: [sysadminUser] } = await pool.query(`SELECT password_hash FROM users WHERE nik = 'SYSADMIN' LIMIT 1`);
        const isLegacyHash = sysadminUser?.password_hash && /^[0-9a-f]{64}$/.test(sysadminUser.password_hash);
        if (isLegacyHash) {
          // Keep hash as-is — it will be migrated to bcrypt automatically on next successful login via verifyPassword()
          logger.info("autoMigrate: sysadmin has legacy SHA-256 hash — will auto-migrate to bcrypt on next login");
        }
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

    // Always seed default plans if not exists
    await pool.query(`
      INSERT INTO plans (name, slug, description, features, price_monthly, price_yearly, max_users, duration_months, max_templates, is_active, sort_order)
      VALUES
        ('Gratis', 'free', 'Paket trial untuk mencoba semua fitur HSE Monitor', '1 bulan trial\nSemua fitur dasar\nMaks. 5 pengguna\nPenyimpanan Google Drive\nSupport email', 0, 0, 5, 1, NULL, true, 1),
        ('Bulanan', 'monthly', 'Paket berlangganan bulanan tanpa batas pengguna', 'Semua fitur lengkap\nPengguna tidak terbatas\nPenyimpanan Google Drive\nLaporan & dashboard\nSupport prioritas\nNotifikasi email otomatis', 250000, 250000, NULL, 1, NULL, true, 2),
        ('Tahunan', 'yearly', 'Paket berlangganan tahunan, lebih hemat 25%', 'Semua fitur Bulanan\nBayar sekali setahun\nHemat Rp 750.000/tahun\nOnboarding gratis\nDedicated support', 2250000, 2250000, NULL, 12, NULL, true, 3)
      ON CONFLICT (slug) DO NOTHING
    `).catch(() => {});

    // Always seed default testimonials if none exist
    const { rows: testimRows } = await pool.query(`SELECT COUNT(*) as c FROM testimonials`);
    if (Number(testimRows[0]?.c) === 0) {
      await pool.query(`
        INSERT INTO testimonials (user_id, company_id, author_name, author_role, author_company, content, rating, is_active)
        VALUES
          (NULL, NULL, 'Andi Prasetyo', 'HSE Manager', 'PT. Karya Cipta Industri', 'HSE Monitor membantu kami mengelola lebih dari 200 jadwal inspeksi per bulan dengan mudah. Laporan otomatis sangat menghemat waktu.', 5, true),
          (NULL, NULL, 'Dewi Rahayu', 'Safety Officer', 'PT. Maju Bersama', 'Pelaporan insiden kini jauh lebih cepat. Tim lapangan bisa langsung upload foto dari HP, dan notifikasi langsung ke PIC.', 5, true)
      `).catch(() => {});
      logger.info("autoMigrate: default testimonials seeded");
    }

    // Ensure payment_method system setting exists
    await pool.query(`INSERT INTO system_settings (key, value) VALUES ('payment_method', 'qris') ON CONFLICT (key) DO NOTHING`).catch(() => {});

    // Work permit tables
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_permit_types (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_permits (
        id SERIAL PRIMARY KEY,
        permit_code TEXT NOT NULL UNIQUE,
        company_id INTEGER REFERENCES companies(id),
        type_id INTEGER REFERENCES work_permit_types(id),
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT NOT NULL,
        emergency_name TEXT NOT NULL,
        emergency_phone TEXT NOT NULL,
        work_start TEXT NOT NULL,
        work_end TEXT NOT NULL,
        supervisor_name TEXT NOT NULL,
        supervisor_phone TEXT NOT NULL,
        ktp_url TEXT,
        photo_url TEXT,
        notes TEXT,
        status TEXT NOT NULL DEFAULT 'active',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_permit_scans (
        id SERIAL PRIMARY KEY,
        work_permit_id INTEGER NOT NULL REFERENCES work_permits(id),
        scanned_at TIMESTAMP NOT NULL DEFAULT NOW(),
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Seed default work permit types for company 1 if none exist
    const { rows: wptRows } = await pool.query(`SELECT COUNT(*) AS c FROM work_permit_types WHERE company_id = 1`);
    if (Number(wptRows[0]?.c) === 0) {
      await pool.query(`
        INSERT INTO work_permit_types (company_id, type, description) VALUES
          (1, 'height place', 'work from heights'),
          (1, 'hot place', 'work at hot places')
        ON CONFLICT DO NOTHING
      `).catch(() => {});
      logger.info("autoMigrate: seeded default work permit types");
    }

    // Maps table (uses Google Drive storage)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS maps (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        name TEXT NOT NULL,
        drive_file_id TEXT,
        view_url TEXT,
        file_type TEXT NOT NULL DEFAULT 'jpeg',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    // Make object_path nullable for tables created before migration to GDrive
    await pool.query(`
      ALTER TABLE maps ALTER COLUMN object_path DROP NOT NULL
    `).catch(() => {});

    // Work permit type approvers
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_permit_type_approvers (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id),
        work_permit_type_id INTEGER NOT NULL REFERENCES work_permit_types(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Work permit approvals
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_permit_approvals (
        id SERIAL PRIMARY KEY,
        work_permit_id INTEGER NOT NULL REFERENCES work_permits(id) ON DELETE CASCADE,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'pending',
        approved_at TIMESTAMP,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Sync sequences
    const tables = ['users', 'incidents', 'companies', 'payments', 'system_settings', 'plans', 'testimonials',
      'work_permit_types', 'work_permits', 'work_permit_scans', 'work_permit_type_approvers', 'work_permit_approvals', 'maps'];
    for (const t of tables) {
      await pool.query(`SELECT setval(pg_get_serial_sequence('"${t}"', 'id'), COALESCE(MAX(id), 1)) FROM "${t}"`).catch(() => {});
    }

  } catch (err) {
    logger.warn({ err }, "autoMigrate: error during migration (non-fatal)");
  }
}
