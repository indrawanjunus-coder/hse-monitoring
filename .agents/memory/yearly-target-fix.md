---
name: Dashboard Yearly Target Calculation
description: How the template-summary endpoint computes yearly targets — must mirror compliance report logic
---

## Rule
The `template-summary` endpoint's yearly target MUST use `calcYearlyOccurrences()` (schedule-creation-date-aware), NOT fixed multipliers like 52 (weekly), 24 (biweekly), 12 (monthly).

**Why:** A schedule created April 2 with weekly frequency has only 39 occurrences in 2026 (April-Dec), not 52 (full year). Using fixed 52 made the target too high and the compliance % look falsely low (2% instead of ~2.6%). Also caused inconsistency with the `/reports/schedule-compliance` endpoint which already uses creation-date-aware `calcExpected()`.

**How to apply:**
- In `template-summary`, call `calcYearlyOccurrences(sched)` which uses `max(Jan 1 of year, sched.createdAt)` as start and `Dec 31` as end
- Uses `sched.dayOfWeek` for accurate weekly count (e.g., count actual Wednesdays)
- Uses `sched.dayOfMonth` for accurate monthly count
- Monthly target still uses fixed multipliers (4/month weekly, etc.) — only yearly is affected
- Both `targetReports` (yearly mode) and `targetYearly` (monthly mode) use `calcYearlyOccurrences`
