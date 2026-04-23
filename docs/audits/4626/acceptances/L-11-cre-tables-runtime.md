# Acceptance — L-11: CRE Tables Created at Runtime

- **Finding ID:** L-11 (AUDIT_REPORT.md §Low)
- **Linear issue:** 4626-359
- **Severity:** Low
- **Status:** Accepted as a duplicate tracker; remediation handled under M-31 (Sprint 7).

## Summary of finding

L-11 observes that CRE-specific tables (`cre_action_queue`,
`cre_execution_log`, and related) are created by Node runtime bootstrap code
rather than by Supabase migrations. The CRE auditor filed this item in the
Low bucket to ensure the schema-drift risk is visible from the CRE phase even
though the actual code lives in the backend under
`frontend/server/_lib/cre/`. The audit report text explicitly notes:
*"(see M-31 — separate from schema drift, noting here for completeness)"*.

## Why this is accepted (not independently fixed)

1. L-11 and M-31 point at the same root cause: runtime `CREATE TABLE IF NOT
   EXISTS` calls for CRE tables must move into
   `supabase/migrations/`.
2. The source files live under `frontend/server/_lib/cre/`, which is in the
   Sprint 7 backend scope. Fixing L-11 separately would duplicate the
   migration work and produce a confusing two-PR footprint for a single
   schema change.
3. The Sprint 7 branch (`audit/sprint-7-backend-supabase`) will author one
   migration covering all CRE runtime-created tables, including
   `cre_action_queue` and `cre_execution_log`, and remove the runtime
   bootstrap calls in the same PR.

## Closure criteria

L-11 will be closed when M-31 (Linear 4626-333) is resolved. Specifically:

- All CRE-specific tables are defined in `supabase/migrations/` with
  deterministic names and RLS policies.
- `frontend/server/_lib/cre/` no longer issues runtime DDL for tables
  covered by L-11 / M-31.
- The Sprint 7 PR body references this acceptance doc and the linked M-31
  remediation.

## Scope boundary

This acceptance doc only closes the L-11 tracker as a duplicate of M-31.
It does not accept schema-drift risk — that risk is tracked and will be
remediated under M-31 in Sprint 7.
