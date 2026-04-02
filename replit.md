# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   └── api-server/         # Express API server
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts, run via `pnpm --filter @workspace/scripts run <script>`
├── pnpm-workspace.yaml     # pnpm workspace (artifacts/*, lib/*, lib/integrations/*, scripts)
├── tsconfig.base.json      # Shared TS options (composite, bundler resolution, es2022)
├── tsconfig.json           # Root TS project references
└── package.json            # Root package with hoisted devDeps
```

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references. This means:

- **Always typecheck from the root** — run `pnpm run typecheck` (which runs `tsc --build --emitDeclarationOnly`). This builds the full dependency graph so that cross-package imports resolve correctly. Running `tsc` inside a single package will fail if its dependencies haven't been built yet.
- **`emitDeclarationOnly`** — we only emit `.d.ts` files during typecheck; actual JS bundling is handled by esbuild/tsx/vite...etc, not `tsc`.
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array. `tsc --build` uses this to determine build order and skip up-to-date packages.

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages that define it
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly` using project references

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, routes at `/api`
- Routes: `src/routes/index.ts` mounts sub-routers; `src/routes/health.ts` exposes `GET /health` (full path: `/api/health`)
- Depends on: `@workspace/db`, `@workspace/api-zod`
- `pnpm --filter @workspace/api-server run dev` — run the dev server
- `pnpm --filter @workspace/api-server run build` — production esbuild bundle (`dist/index.cjs`)
- Build bundles an allowlist of deps (express, cors, pg, drizzle-orm, zod, etc.) and externalizes the rest

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL. Exports a Drizzle client instance and schema models.

- `src/index.ts` — creates a `Pool` + Drizzle instance, exports schema
- `src/schema/index.ts` — barrel re-export of all models
- `src/schema/<modelname>.ts` — table definitions with `drizzle-zod` insert schemas (no models definitions exist right now)
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`, automatically provided by Replit)
- Exports: `.` (pool, db, schema), `./schema` (schema only)

Production migrations are handled by Replit when publishing. In development, we just use `pnpm --filter @workspace/db run push`, and we fallback to `pnpm --filter @workspace/db run push-force`.

### `lib/api-spec` (`@workspace/api-spec`)

Owns the OpenAPI 3.1 spec (`openapi.yaml`) and the Orval config (`orval.config.ts`). Running codegen produces output into two sibling packages:

1. `lib/api-client-react/src/generated/` — React Query hooks + fetch client
2. `lib/api-zod/src/generated/` — Zod schemas

Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec (e.g. `HealthCheckResponse`). Used by `api-server` for response validation.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec (e.g. `useHealthCheck`, `healthCheck`).

### `scripts` (`@workspace/scripts`)

Utility scripts package. Each script is a `.ts` file in `src/` with a corresponding npm script in `package.json`. Run scripts via `pnpm --filter @workspace/scripts run <script>`. Scripts can import any workspace package (e.g., `@workspace/db`) by adding it as a dependency in `scripts/package.json`.

### `artifacts/hse-mobile` (`@workspace/hse-mobile`)

Expo React Native mobile app for HSE monitoring. Uses Expo Router with file-based routing.

**Features:**
- JWT auth (hse_ prefix + base64 JSON), login with NIK + password (SHA-256 + salt "hse_salt_2024")
- Dashboard: monthly incident bar chart, open/closed status chart, risk matrix, category trend
- Schedules: weekly inspection list with status filter (pending/completed), filterable by supervisor
- Incidents: list with status filter (open/in_progress/closed), new incident form, detail view with status update
- Inspection: template-driven form with Yes/No and text questions, mandatory validation, progress bar
- Master Data (admin only): Users, Categories, Groups, Templates, Plants, Actions with CRUD modals

**Screens:**
- `app/login.tsx` — login screen
- `app/(tabs)/index.tsx` — dashboard
- `app/(tabs)/schedules.tsx` — inspection schedules
- `app/(tabs)/incidents.tsx` — incident list
- `app/(tabs)/profile.tsx` — user profile + navigation
- `app/inspection/[id].tsx` — fill out inspection template
- `app/incident/new.tsx` — report new incident
- `app/incident/[id].tsx` — incident detail + status update
- `app/master/index.tsx` — master data menu
- `app/master/{users,categories,groups,plants,actions,templates}.tsx` — CRUD screens

**Key files:**
- `context/AuthContext.tsx` — JWT auth state, login/logout
- `hooks/useApi.ts` — typed API client (get/post/put/del)
- `constants/colors.ts` — design token colors
- `components/{RiskBadge,StatusBadge,ErrorBoundary}.tsx` — shared components

**Auth credentials:**
- Admin: NIK ADM001 / password admin123
- Supervisor: NIK SUP001 / password user123
- Employee: NIK EMP001 / password user123

### `artifacts/hse-web` (`@workspace/hse-web`)

React + Vite web dashboard for HSE monitoring. Uses shadcn/ui, Recharts, wouter, TanStack React Query.

**Features:**
- Login page (NIK + password, same auth as mobile)
- Dashboard: monthly incident charts (daily bar, open/closed stacked bar, risk matrix table, category trend bar)
- Schedules: CRUD for inspection schedules with frequency (daily/weekly/biweekly/monthly/custom), assign to Group or User
- Incidents: list with status filter, new incident form (with file upload: photo/PDF), detail view with status update + attachment viewer
- Attachments: upload foto (JPG/PNG/WEBP) atau PDF saat lapor H&I — disimpan ke Google Drive dengan struktur folder Tahun/Bulan, nama file format `{incidentId}-YYYY-MM-DD-{increment}`
- Inspeksi Saya (/my-inspections): personal inspection task list for the logged-in user; shows pending/completed schedules and allows filling inspection template inline
- Riwayat Inspeksi (/history): table of all submitted inspections; click row to view answer detail including expected vs actual answer comparison
- Laporan Followup H&I (/reports/followup): incidents bucketed by time since creation (< 24h, 24–48h, 48–72h, > 72h) with recharts bar chart and per-bucket detail table
- Master Data (admin only): Users (CRUD + password reset), Categories (CRUD + PIC Group assignment), Groups (CRUD + member/PIC management), Templates with Question Builder (full CRUD with type/mandatory/photo/category/expectedAnswer/order), Plants (CRUD), Actions (CRUD)
- Profile: view info + self-service change password

**Template/Question System:**
- Questions have `expectedAnswer` field (yes/no type only): "yes", "no", or null
- On inspection submission, if answer != expectedAnswer → auto-creates an open H&I incident with `needsFurtherAction=true`
- Only Supervisors and Admins can create/edit templates and questions (lock shown for Employee role)

**API Routes:**
- `GET/POST /api/questions` — question CRUD with `expectedAnswer` field
- `GET /api/inspections` — all inspections with supervisor/template/plant names
- `POST /api/inspections` — submit inspection, auto-creates incidents for wrong answers
- `GET /api/reports/followup` — time-bucketed incident report
- `GET/PUT /api/settings/gdrive` — Google Drive service account settings (admin only)
- `GET /api/attachments?incidentId=X` — list attachments for an incident
- `POST /api/attachments/upload` — upload file (multipart/form-data) to Google Drive, saves record in DB
- `DELETE /api/attachments/:id` — delete attachment from Drive + DB

**Google Drive Attachment System:**
- Service account: configured via /settings/gdrive (admin only)
- Folder structure: `{rootFolderId}/{year}/{MM - MonthName}/`
- File naming: `{incidentId}-YYYY-MM-DD-{00001}.ext`
- Increment counter is per-month (resets to 1 each month), max file size 20MB
- Accepted types: JPG, PNG, WEBP, PDF
- New DB tables: `gdrive_settings`, `incident_attachments`

**Key files:**
- `src/App.tsx` — router setup with auth guard
- `src/lib/api.ts` — fetch wrapper with Bearer token
- `src/lib/auth-context.tsx` — auth state (login/logout/user)
- `src/components/layout.tsx` — sidebar nav + Layout wrapper
- `src/components/badges.tsx` — RiskBadge, StatusBadge, FrequencyBadge (statuses: open, in_progress, in-progress, closed, pending, completed, active, resolved)
- `src/pages/dashboard.tsx` — dashboard with recharts
- `src/pages/schedules.tsx` — schedule CRUD
- `src/pages/incidents.tsx` — incident CRUD
- `src/pages/my-inspections.tsx` — personal inspection task page
- `src/pages/history.tsx` — inspection history with detail dialog
- `src/pages/reports/followup-report.tsx` — H&I followup time-bucket report
- `src/pages/profile.tsx` — user profile + change password
- `src/pages/master/` — templates (w/ expectedAnswer), users, categories (w/ PIC Group), groups, plants, actions

**Important notes:**
- Radix Select does not allow empty string (`""`) as SelectItem value — use `"none"` for "no selection" and convert in save handler
- TemplateBuilder uses `staleTime: 0` + `queryClient.setQueryData` pattern to avoid stale cache on re-open

**Served at:** `/hse-web/` (port 5174 in dev)
