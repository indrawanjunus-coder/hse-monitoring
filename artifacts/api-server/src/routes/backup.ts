import { Router } from "express";
import { pool } from "@workspace/db";
import { authMiddleware } from "../lib/auth";
import archiver from "archiver";

const router = Router();
router.use(authMiddleware);

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

// Tables safe to push to GitHub — excludes tables with secrets/credentials
const GITHUB_SAFE_TABLES = [
  "companies", "users", "groups", "group_members",
  "plants", "categories", "category_groups", "category_users",
  "actions", "preventive_actions", "incident_types", "templates", "questions",
  "schedules", "schedule_groups", "schedule_users", "inspections", "inspection_answers",
  "incidents", "incident_comments", "incident_attachments", "incident_escalations",
  "indicators", "indicator_values",
  "plans", "payments", "system_logs",
  // NOTE: smtp_settings, gdrive_settings, system_settings intentionally EXCLUDED
  // to prevent leaking credentials/tokens via GitHub secret scanning
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
  return `'${str.replace(/'/g, "''")}'`;
}

async function buildSqlBackup(companyId: number | null, dialect: "postgresql" | "mysql"): Promise<string> {
  const isMysql = dialect === "mysql";
  let sql = "";
  if (isMysql) {
    sql += `-- H&A Monitoring System - MySQL Backup\n-- Generated: ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`;
  } else {
    sql += `-- H&A Monitoring System - PostgreSQL Backup\n-- Generated: ${new Date().toISOString()}\nSET session_replication_role = 'replica';\n\n`;
  }
  for (const table of BACKUP_TABLES) {
    const rows = await getTableData(table, companyId);
    if (rows.length === 0) continue;
    sql += `-- =====================\n-- Table: ${table}\n-- =====================\n`;
    if (isMysql) sql += `TRUNCATE TABLE \`${table}\`;\n`;
    else sql += `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;\n`;
    const cols = Object.keys(rows[0]!);
    const colList = isMysql ? cols.map(c => `\`${c}\``).join(", ") : cols.map(c => `"${c}"`).join(", ");
    const chunkSize = 100;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      const values = chunk.map(row =>
        `(${cols.map(c => escapeSQL(row[c], isMysql ? "mysql" : "postgresql")).join(", ")})`
      ).join(",\n  ");
      if (isMysql) sql += `INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};\n`;
      else sql += `INSERT INTO "${table}" (${colList}) VALUES\n  ${values}\n  ON CONFLICT DO NOTHING;\n`;
    }
    sql += "\n";
  }
  if (isMysql) sql += "SET FOREIGN_KEY_CHECKS=1;\n";
  else sql += "SET session_replication_role = 'origin';\n";
  return sql;
}

async function buildCsvBackup(companyId: number | null): Promise<string> {
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
  return output;
}

// Sensitive column names to redact when pushing to GitHub
const REDACTED_COLUMNS = new Set([
  "password", "password_hash", "token", "secret", "access_token",
  "refresh_token", "client_secret", "api_key", "private_key",
]);

function redactRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = REDACTED_COLUMNS.has(k.toLowerCase()) && v ? "[REDACTED]" : v;
  }
  return out;
}

async function buildSqlBackupForGitHub(companyId: number | null, dialect: "postgresql" | "mysql"): Promise<string> {
  const isMysql = dialect === "mysql";
  let sql = "";
  if (isMysql) {
    sql += `-- H&A Monitoring System - MySQL Backup (GitHub safe — credentials excluded)\n-- Generated: ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n\n`;
  } else {
    sql += `-- H&A Monitoring System - PostgreSQL Backup (GitHub safe — credentials excluded)\n-- Generated: ${new Date().toISOString()}\nSET session_replication_role = 'replica';\n\n`;
  }
  for (const table of GITHUB_SAFE_TABLES) {
    const rows = await getTableData(table, companyId);
    if (rows.length === 0) continue;
    sql += `-- =====================\n-- Table: ${table}\n-- =====================\n`;
    if (isMysql) sql += `TRUNCATE TABLE \`${table}\`;\n`;
    else sql += `TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;\n`;
    const safeRows = rows.map(redactRow);
    const cols = Object.keys(safeRows[0]!);
    const colList = isMysql ? cols.map(c => `\`${c}\``).join(", ") : cols.map(c => `"${c}"`).join(", ");
    const chunkSize = 100;
    for (let i = 0; i < safeRows.length; i += chunkSize) {
      const chunk = safeRows.slice(i, i + chunkSize);
      const values = chunk.map(row =>
        `(${cols.map(c => escapeSQL(row[c], isMysql ? "mysql" : "postgresql")).join(", ")})`
      ).join(",\n  ");
      if (isMysql) sql += `INSERT INTO \`${table}\` (${colList}) VALUES\n  ${values};\n`;
      else sql += `INSERT INTO "${table}" (${colList}) VALUES\n  ${values}\n  ON CONFLICT DO NOTHING;\n`;
    }
    sql += "\n";
  }
  if (isMysql) sql += "SET FOREIGN_KEY_CHECKS=1;\n";
  else sql += "SET session_replication_role = 'origin';\n";
  return sql;
}

async function buildCsvBackupForGitHub(companyId: number | null): Promise<string> {
  let output = `# H&A Monitoring System - Data Backup (CSV, GitHub safe — credentials excluded)\n# Generated: ${new Date().toISOString()}\n\n`;
  for (const table of GITHUB_SAFE_TABLES) {
    const rows = await getTableData(table, companyId);
    if (rows.length === 0) continue;
    output += `### TABLE: ${table} ###\n`;
    const safeRows = rows.map(redactRow);
    const cols = Object.keys(safeRows[0]!);
    output += cols.join(",") + "\n";
    for (const row of safeRows) {
      output += cols.map(c => escapeCSV(row[c])).join(",") + "\n";
    }
    output += "\n";
  }
  return output;
}

// GET /api/backup?format=postgresql|mysql|csv
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
      const output = await buildCsvBackup(companyId);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="hse-backup-${now}.csv"`);
      res.send(output);
      return;
    }
    const dialect = format as "postgresql" | "mysql";
    const sql = await buildSqlBackup(companyId, dialect);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="hse-backup-${dialect}-${now}.sql"`);
    res.send(sql);
  } catch (err) {
    res.status(500).json({ error: "Backup gagal", detail: String(err) });
  }
});

// GET /api/backup/zip — download all formats as a single ZIP
router.get("/zip", async (req, res) => {
  const companyId = req.user!.companyId ?? null;
  const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

  try {
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="hse-backup-${now}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.on("error", (err) => { throw err; });
    archive.pipe(res);

    const [pgSql, mysqlSql, csvData] = await Promise.all([
      buildSqlBackup(companyId, "postgresql"),
      buildSqlBackup(companyId, "mysql"),
      buildCsvBackup(companyId),
    ]);

    archive.append(pgSql, { name: `hse-backup-postgresql-${now}.sql` });
    archive.append(mysqlSql, { name: `hse-backup-mysql-${now}.sql` });
    archive.append(csvData, { name: `hse-backup-data-${now}.csv` });

    const readme = [
      "H&A Monitoring System — Backup Package",
      `Generated: ${new Date().toISOString()}`,
      "",
      "Files:",
      `  hse-backup-postgresql-${now}.sql  — restore ke PostgreSQL`,
      `  hse-backup-mysql-${now}.sql       — restore ke MySQL/MariaDB`,
      `  hse-backup-data-${now}.csv        — data dalam format CSV (Excel/Sheets)`,
    ].join("\n");
    archive.append(readme, { name: "README.txt" });

    await archive.finalize();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Gagal membuat ZIP", detail: String(err) });
    }
  }
});

function ghKey(companyId: number | null | undefined, field: string) {
  return `github_backup_${field}_c${companyId ?? 0}`;
}

async function getGhConfig(companyId: number | null | undefined): Promise<Record<string, string>> {
  const keys = ["repo", "branch", "token", "path"].map(f => ghKey(companyId, f));
  const result = await pool.query(
    `SELECT key, value FROM system_settings WHERE key = ANY($1)`,
    [keys]
  );
  const cfg: Record<string, string> = {};
  for (const row of result.rows) cfg[row.key] = row.value ?? "";
  return cfg;
}

// GET /api/backup/github-config
router.get("/github-config", async (req, res) => {
  const companyId = req.user!.companyId;
  try {
    const cfg = await getGhConfig(companyId);
    const hasEnvToken = !!(process.env["GITHUB_PERSONAL_ACCESS_TOKEN"]);
    res.json({
      repo: cfg[ghKey(companyId, "repo")] ?? "",
      branch: cfg[ghKey(companyId, "branch")] || "main",
      hasToken: !!(cfg[ghKey(companyId, "token")]) || hasEnvToken,
      hasEnvToken,
      path: cfg[ghKey(companyId, "path")] || "backups/",
    });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// PUT /api/backup/github-config
router.put("/github-config", async (req, res) => {
  const companyId = req.user!.companyId;
  const { repo, branch, token, path: backupPath } = req.body as {
    repo?: string; branch?: string; token?: string; path?: string;
  };

  try {
    const upsert = async (field: string, value: string) => {
      const key = ghKey(companyId, field);
      await pool.query(
        `INSERT INTO system_settings (key, value)
         VALUES ($1, $2)
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
        [key, value]
      );
    };

    if (repo !== undefined) await upsert("repo", repo);
    if (branch !== undefined) await upsert("branch", branch || "main");
    if (token !== undefined && token !== "***" && token !== "") await upsert("token", token);
    if (backupPath !== undefined) await upsert("path", backupPath || "backups/");

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

// POST /api/backup/github-push
router.post("/github-push", async (req, res) => {
  const companyId = req.user!.companyId;

  try {
    const cfg = await getGhConfig(companyId);

    const repo = cfg[ghKey(companyId, "repo")];
    const branch = cfg[ghKey(companyId, "branch")] || "main";
    // Use manually-configured token first, fall back to env var
    const token = cfg[ghKey(companyId, "token")] || process.env["GITHUB_PERSONAL_ACCESS_TOKEN"] || "";
    // Strip leading/trailing slashes, then ensure trailing slash
    const rawPath = cfg[ghKey(companyId, "path")] || "backups";
    const backupPath = rawPath.replace(/^\/+|\/+$/g, "").replace(/^$/, "backups") + "/";

    if (!repo) {
      res.status(400).json({ error: "Nama repository belum diisi. Masukkan format: owner/nama-repo (contoh: indrawanjunus-coder/HSE)" });
      return;
    }
    if (!token) {
      res.status(400).json({ error: "Token GitHub belum tersedia. Isi Personal Access Token di form atau set environment variable GITHUB_PERSONAL_ACCESS_TOKEN." });
      return;
    }

    const now = new Date().toISOString().slice(0, 19).replace(/:/g, "-");

    const pgSql = await buildSqlBackupForGitHub(companyId, "postgresql");
    const csvData = await buildCsvBackupForGitHub(companyId);

    const ghHeaders: Record<string, string> = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      "User-Agent": "HSE-Monitoring-System",
    };

    // Validate token & repo first
    const repoCheck = await fetch(`https://api.github.com/repos/${repo}`, { headers: ghHeaders });
    if (!repoCheck.ok) {
      const repoErr = await repoCheck.json().catch(() => ({})) as { message?: string };
      const hint = repoCheck.status === 401
        ? "Token tidak valid atau sudah kadaluarsa. Buat PAT baru di GitHub Settings → Developer settings → Personal access tokens."
        : repoCheck.status === 404
          ? `Repository "${repo}" tidak ditemukan. Pastikan nama repo benar (format: owner/repo) dan token punya akses ke repo ini.`
          : `GitHub error ${repoCheck.status}: ${repoErr.message ?? repoCheck.statusText}`;
      console.error("[backup/github-push] repo check failed:", repoCheck.status, repoErr);
      res.status(400).json({ error: hint });
      return;
    }

    async function pushFile(filename: string, content: string, commitMsg: string) {
      const filePath = `${backupPath}${filename}`;
      const apiUrl = `https://api.github.com/repos/${repo}/contents/${filePath}`;

      // Get existing SHA (to update) — ignore if file doesn't exist yet
      let sha: string | undefined;
      const existing = await fetch(`${apiUrl}?ref=${branch}`, { headers: ghHeaders });
      if (existing.ok) {
        const data = await existing.json() as { sha?: string };
        sha = data.sha;
      }

      const body: Record<string, unknown> = {
        message: commitMsg,
        content: Buffer.from(content, "utf-8").toString("base64"),
        branch,
      };
      if (sha) body["sha"] = sha;

      const put = await fetch(apiUrl, {
        method: "PUT",
        headers: ghHeaders,
        body: JSON.stringify(body),
      });

      if (!put.ok) {
        const ghErr = await put.json().catch(() => ({})) as { message?: string; errors?: { message?: string }[] };
        const detail = ghErr.errors?.[0]?.message ?? ghErr.message ?? put.statusText;
        const hint = put.status === 422 && detail?.includes("sha")
          ? `Konflik SHA pada file ${filePath}. Coba lagi.`
          : put.status === 422
            ? `Branch "${branch}" tidak ditemukan di repo. Pastikan branch sudah ada di repository.`
            : `GitHub: ${detail} (file: ${filePath})`;
        console.error("[backup/github-push] pushFile failed:", put.status, ghErr);
        throw new Error(hint);
      }
      return filePath;
    }

    // Push files sequentially (not parallel) to avoid race condition on branch/tree
    const pgPath = await pushFile(
      `hse-backup-postgresql-${now}.sql`,
      pgSql,
      `chore: backup data HSE (postgresql) — ${now}`
    );
    const csvPath = await pushFile(
      `hse-backup-data-${now}.csv`,
      csvData,
      `chore: backup data HSE (csv) — ${now}`
    );

    console.info(`[backup/github-push] success: ${repo}/${branch} — ${pgPath}, ${csvPath}`);
    res.json({
      ok: true,
      pushed: [pgPath, csvPath],
      repo,
      branch,
      message: `Backup berhasil di-push ke ${repo} (branch: ${branch})`,
    });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error("[backup/github-push] error:", detail);
    res.status(500).json({ error: detail });
  }
});

export default router;
