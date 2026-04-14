# Overview

This project is a pnpm workspace monorepo using TypeScript, designed for a multi-tenant SaaS platform called HSE Monitor. It aims to provide comprehensive Health, Safety, and Environment monitoring solutions through web and mobile applications.

The platform offers features for incident reporting, inspection management, schedule tracking, and master data management, with a strong focus on compliance and user-friendly interfaces. It supports different user roles (Employee, Supervisor, Admin, Sysadmin) and provides a company-branded portal for each tenant.

Key capabilities include:
- API server built with Express.js.
- Web dashboard with rich analytics and reporting.
- Mobile application for on-the-go HSE monitoring.
- Multi-tenancy with isolated data for each company.
- Subscription management and payment processing.
- Dynamic plan and testimonial management by sysadmin.

The business vision is to provide a robust, scalable, and secure HSE monitoring solution that can be easily adopted by various companies to improve their safety compliance and operational efficiency.

# User Preferences

- I prefer clear and concise explanations.
- I prefer an iterative development approach where I can review changes frequently.
- Please ask for confirmation before implementing significant architectural changes or adding new external dependencies.
- Ensure that all generated code is type-safe and follows best practices.

# System Architecture

The project utilizes a pnpm workspace monorepo structure.

**Technology Stack:**
- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Zod
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

**Monorepo Structure:**
- `artifacts/`: Deployable applications (e.g., `api-server`, `hse-mobile`, `hse-web`).
- `lib/`: Shared libraries (e.g., `api-spec`, `api-client-react`, `api-zod`, `db`).
- `scripts/`: Utility scripts.

**TypeScript & Composite Projects:**
- All packages extend a base `tsconfig.base.json` with `composite: true`.
- Root `tsconfig.json` lists all packages as project references for correct cross-package typechecking and build order.
- `emitDeclarationOnly` is used for typechecking, with actual JS bundling handled by esbuild/tsx/vite.

**API Server (`artifacts/api-server`):**
- Express 5 server with routes in `src/routes/`.
- Uses `@workspace/api-zod` for validation and `@workspace/db` for persistence.
- Bundled using esbuild for production.

**Database Layer (`lib/db`):**
- Drizzle ORM with PostgreSQL.
- Exports a Drizzle client and schema models.
- Migrations handled by Drizzle Kit and Replit publishing.

**API Specification & Codegen (`lib/api-spec`):**
- Manages `openapi.yaml` and `orval.config.ts`.
- Generates React Query hooks (`lib/api-client-react`) and Zod schemas (`lib/api-zod`).

**Mobile Application (`artifacts/hse-mobile`):**
- Expo React Native app using Expo Router for file-based routing.
- **Features**: JWT auth, Dashboard (charts, risk matrix), Schedules, Incidents (reporting, detail), Inspection forms, Master Data (admin only).
- **UI/UX**: Uses `constants/colors.ts` for design tokens, `AuthContext` for JWT state, `useApi` for typed API client.

**Web Application (`artifacts/hse-web`):**
- React + Vite web dashboard using `shadcn/ui`, Recharts, wouter, TanStack React Query.
- **Features**: Login, Dashboard (incident charts, reports), Schedules (CRUD), Incidents (reporting, attachments), My Inspections, Inspection History, Follow-up Reports, Schedule Compliance Reports, Master Data (extensive CRUD for Users, Categories, Groups, Templates, Plants, Actions), Profile.
- **UI/UX**: Uses `shadcn/ui` components, `src/components/layout.tsx` for sidebar navigation, `src/components/badges.tsx` for visual status indicators.
- **Template/Question System**: Questions can have `expectedAnswer` which triggers incident creation if not met.
- **Google Drive Attachment System**: For incident attachments, configurable via admin panel.

**Multi-Tenancy Architecture:**
- SaaS platform with isolated data per company via `company_id` foreign keys in all main tables.
- **Company Portal**: `url: /c/{slug}/`, company-branded login, redirects to payment if subscription issues.
- **Sysadmin Panel**: `/sysadmin` URL, dark-themed admin panel for managing companies, payments, plans, testimonials, and global settings.
- **Auth Token**: `hse_` + base64(JSON) payload including `companyId`. Sysadmin tokens have `companyId: null`.

**Multi-Tenancy Features:**
- **Companies & Plans**: Tables for `companies`, `payments`, `system_settings`. Supports `free`, `monthly`, `yearly` plans with `pending`, `active`, `suspended` statuses.
- **Testimonials**: `testimonials` table, user submission, sysadmin review, public display.
- **Layanan (Plans Master)**: `plans` table with `max_users` and `max_templates` nullable int columns. Sysadmin CRUD, dynamically drives pricing section.
- **Registration**: Public `/register` form to create new companies (pending status).
- **Payment Flow**: Users submit payment proof, sysadmin approves to activate subscription. Payment info displayed on a dedicated page.
- **Plan Limits Enforcement**: `users` and `templates` tables have `is_active` boolean column (default true). `plan-limits.ts` utility enforces per-plan limits:
  - `checkUserLimit(companyId)` — checks active user count vs `plans.max_users`
  - `checkTemplateLimit(companyId)` — checks active template count vs `plans.max_templates`
  - `enforcePlanLimits(companyId)` — auto-deactivates excess users/templates when plan changes (non-admins deactivated first, at least 1 admin kept active)
  - Triggered on sysadmin activate, payment approve, plan change
  - Login blocked (403) for deactivated users with clear error message
  - POST /users and POST /templates return 403 `USER_LIMIT_REACHED`/`TEMPLATE_LIMIT_REACHED` if over limit
  - Frontend Users/Templates pages show Aktif/Nonaktif badges, toggle-active button, and amber warning alerts

**Authentication:**
- JWT-based authentication with NIK and password (SHA-256 + salt "hse_salt_2024").
- Sysadmin login uses a specific NIK/password and `companyId: null`.
- **KCI credentials**: NIK `admin` / password `admin123` (via /c/kci/); NIK `risang` / `admin123`; NIK `okta` / `admin123`
- **Sysadmin credentials**: NIK `SYSADMIN` / password `sysadmin2024` (via /sysadmin)

# External Dependencies

- **PostgreSQL**: Primary database for all application data.
- **Google Drive API**: Used for storing incident attachments (photos, PDFs) and payment proofs. Configured via service account.
- **Recharts**: For data visualization and charting in the web dashboard.
- **TanStack React Query**: For data fetching, caching, and state management in web and mobile applications.
- **shadcn/ui**: UI component library used in the web application.
- **wouter**: A tiny router for React used in the web application.
- **Expo / Expo Router**: Framework and routing library for the mobile React Native application.