import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../lib/auth";

const router = Router();
router.use(authMiddleware);

// Only admins can run backup
router.use((req, res, next) => {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Admin only" });
    return;
  }
  next();
});

const BACKUP_TABLES = [
  "companies", "users", "groups", "group_members",
  "plants", "categories", "category_groups", "category_users",
  "actions", "preventive_actions", "incident_types", "templates", "questions",
  "schedules", "schedule_groups", "schedule_users", "inspections", "inspection_answers",
  "incidents", "incident_comments", "incident_attachments", "incident_escalations",
  "indicators", "indicator_values",
  "smtp_settings", "gdrive_settings",
  "plans", "payments", "system_settings", "system_logs",
];

async function getTableData(table: string, companyId?: number | null) {
  try {
    const hasCompanyId = await pool.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='company_id'`,
      [table]
    );
    let query = `SELECT * FROM "${table}"`;
    const params: (number | undefined)[] = [];
    if (companyId && hasCompanyId.rows.length > 0) {
      query += ` WHERE company_id=$1`;
      params.push(companyId);
    }
    query += ` ORDER BY id NULLS LAST`;
    const result = await pool.query(query, params.length ? params : undefined);
    return result.rows;
  } catch {
    return [];
  }
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function escapeSQL(value: unknown, dialect: "mysql" | "postgresql"): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") return String(value);
  const str = String(value);
  if (dialect === "mysql") {
    return `'${str.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/\n/g, "\\n").replace(/\r/g, "\\r")}'`;
  }
  // postgresql
  return `'${str.replace(/'/g, "''")}'`;
}

router.get("/", async (req, res) => {
  const format = (req.query.format as string) ?? "postgresql";
  const companyId = req.user!.companyId ?? null;

  if (!["csv", "mysql", "postgresql"].includes(format)) {
    res.status(400).json({ error: "Format harus csv, mysql, atau postgresql" });
    return;
  }

  const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  try {
    if (format === "csv") {
      // Multi-table CSV: each table separated by section headers
      let output = `# H&A Monitoring System - Data Backup (CSV)\n# Generated: ${new Date().toISOString()}\n\n`;

      for (const table of BACKUP_TABLES) {
        const rows = await getTableData(table, companyId);
        if (rows.length === 0) continue;
        output += `### TABLE: ${table} ###\n`;
        const cols = Object.keys(rows[0]!);
        output += cols.join(",") + "\n";
        for (const row of rows) {
          output += cols.map(c => escapeCSV(row[c])).join(",") + "\n";
        }
        output += "\n";
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="hse-backup-${now}.csv"`);
      res.send(output);
      return;
    }

    // SQL formats
    const isMysql = format === "mysql";
    let sql = "";

    if (isMysql) {
      sql += `-- H&A Monitoring System - MySQL Backup\n`;
      sql += `-- Generated: ${new Date().toISOString()}\n`;
      sql += `SET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`;
    } else {
      sql += `-- H&A Monitoring System - PostgreSQL Backup\n`;
      sql += `-- Generated: ${new Date().toISOString()}\n`;
      sql += `SET session_replication_role = 'replica';\n\n`;
    }

    for (const table of BACKUP_TABLES) {
      const rows = await getTableData(table, companyId);
      if (rows.length === 0) continue;

      sql += `-- =====================\n-- Table: ${table}\n-- =====================\n`;

      if (isMysql) {
        sql += `TRUNCATE TABLE \`${table}\`;\n`;
      } else {
        sql += `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;\n`;
      }

      const cols = Object.keys(rows[0]!);
      const colList = isMysql
        ? cols.map(c => `\`${c}\``).join(", ")
        : cols.map(c => `"${c}"`).join(", ");

      const chunkSize = 100;
      for (let i = 0; i < rows.length; i += chunkSize) {
        const chunk = rows.slice(i, i + chunkSize);
        const values = chunk.map(row =>
          `(${cols.map(c => escapeSQL(row[c], isMysql ? "mysql" : "postgresql")).join(", ")})`
        ).join(",\n  ");

        if (isMysql) {
          sql += `INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};\n`;
        } else {
          sql += `INSERT INTO "${table}" (${colList}) VALUES\n  ${values}\n  ON CONFLICT DO NOTHING;\n`;
        }
      }
      sql += "\n";
    }

    if (isMysql) {
      sql += "SET FOREIGN_KEY_CHECKS=1;\n";
    } else {
      sql += "SET session_replication_role = 'origin';\n";
    }

    const ext = isMysql ? "sql" : "sql";
    const dialect = isMysql ? "mysql" : "postgresql";
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="hse-backup-${dialect}-${now}.${ext}"`);
    res.send(sql);
  } catch (err: unknown) {
    res.status(500).json({ error: "Backup gagal", detail: String(err) });
  }
});

export default router;
