---
name: Report routes companyId filtering
description: How reports.ts handles multi-tenant isolation and the calcExpectedInRange helper
---

## Module-level helpers in reports.ts
`calcExpectedInRange(freq, rangeFrom, rangeTo, scheduleCreatedAt, dayOfWeek, dayOfMonth, customDays)`
- Clamps effective start to max(rangeFrom, scheduleCreatedAt)
- Used by /reports/template-detail for per-dept expected inspection count
- Note: schedule-compliance route has its own local calcExpected (closure over toDate only)

## Report routes and their companyId scope
- `/followup` → filters incidentsTable by companyId
- `/monthly` → filters incidentsTable by companyId  
- `/action-matrix` → filters incidentsTable by companyId
- `/schedule-compliance` → filters schedulesTable, templatesTable, plantsTable by companyId
- `/department-summary` → filters usersTable by companyId (gets dept from users)
- `/templates` → filters templatesTable by companyId
- `/template-detail` → new endpoint; filters schedulesTable, inspectionsTable by companyId

**Why:** All report data must be isolated per company to prevent cross-tenant data leaks.
