---
name: Multi-tenancy architecture
description: Full SaaS multi-tenant system — what's done and key patterns
---

## Status: Complete (all 5 tasks done)

### Database
- All 24 main tables have `company_id` FK referencing `companies.id`
- Company KCI (id=1): slug="kci", status="active", plan="yearly"
- Tables: users, incidents, categories, plants, actions, groups, schedules, templates, indicators, preventive_actions, incident_types, smtp_settings, gdrive_settings, work_permit_types, work_permits, departments, maps, lagging_indicators, non_lti_settings, testimonials, payments, audit_logs, safe_hours_reset_history

### Auth & Middleware (artifacts/api-server/src/lib/auth.ts)
- `authMiddleware` — verifies cookie `hse_token`, attaches `req.user` with `companyId`
- `sysadminMiddleware` — same but requires role=sysadmin
- `companySubscriptionMiddleware` — paywall gate: blocks suspended/expired/pending companies (HTTP 402), cached 60s per companyId
- `invalidateSubCache(companyId)` — call after sysadmin activates/approves payment

### Route Structure (artifacts/api-server/src/routes/index.ts)
- Public (no paywall): /auth, /sysadmin, /payments, /plans, /testimonials
- Paywall gate applied before: all other tenant routes

### Frontend Routing (artifacts/hse-web/src/App.tsx)
- `/c/{slug}/` → company portal (wouter base = `/c/{slug}`)
- `/sysadmin` → SysadminApp (no AuthProvider)
- `/register` → RegisterPage (no AuthProvider)
- `/c/{slug}/payment` or `/c/{slug}/scan` → special pages
- Login page detects /c/{slug}/ URL and loads company branding

### Sysadmin Panel (artifacts/hse-web/src/pages/sysadmin/)
- 8 tabs: companies, payments, plans, settings, reports, audit, testimonials
- Company activation: POST /sysadmin/companies/:id/activate → provisions admin user, sends email

**Why:** SaaS model where each company has isolated data but shares infrastructure.
**How to apply:** Always filter queries by `req.user.companyId`; sysadmin role bypasses all company filters.
