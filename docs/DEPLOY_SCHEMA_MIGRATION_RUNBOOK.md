# Deploy Runbook: Schema Bootstrap Centralization (2026)

**One-page reference for deploying the `withEnsureOnce` + schema condensation changes.**

## Pre-Deploy (Local)

```bash
pnpm -C frontend typecheck
pnpm -C frontend guard:schema
pnpm -C frontend lint
pnpm verify:schema-ensures
```

Run the new verification script (it will warn on missing DB but should not crash with duplicate-identifier errors).

## Smoke Test Checklist (Post-Deploy, in order)

**Tier 1 — Critical (first 15 min)**
- `POST /api/waitlist/bootstrap` (anon + with Privy token)
- `GET /api/accounts/me`
- `GET /api/waitlist/stats`
- `GET /api/waitlist/position`

**Tier 2 — High Risk**
- Deploy session creation endpoints
- Paymaster `/api/paymaster` (sponsored flows)
- Keeper job enqueues (`/api/keeper/jobs/...`)

**Tier 3 — Broad Coverage**
- All waitlist/* endpoints
- Zora resolve/refresh/metrics
- Telegram link flows
- Vault active + keeper protected endpoints

Watch Vercel logs for:
- "Identifier 'ensure...Schema' has already been declared"
- "waitlist_schema_ensure_failed"
- Recursion / stack overflow traces

## Monitoring Commands

```bash
# Quick schema health in an environment with DB
pnpm verify:schema-ensures

# Watch for schema-related errors on a specific function
# (Vercel dashboard → Functions → filter by "schema")
```

## Rollback Triggers

- Any 500 on `/api/waitlist/bootstrap` or `/api/accounts/me` with schema-related error
- Cold-start crashes mentioning duplicate identifiers
- Keeper jobs or paymaster failing on schema init

Rollback = previous commit + redeploy (no DB changes required for this migration).

## Success Criteria (first 30–60 min)

- All Tier 1 endpoints return 200 with expected shapes
- No duplicate-identifier errors in logs
- `verify:schema-ensures` passes cleanly in prod-like env
- New schema tables (if any) show "[schemaBootstrap] Applying ..." on first cold start

---

**Related files**
- `docs/POST_MIGRATION_SMOKE_TEST_CHECKLIST.md`
- `frontend/scripts/verify-post-migration-schema-ensures.ts`
- `docs/SCHEMA_MIGRATION_VERIFICATION_REPORT.md`

Generated as part of the 2026 schema centralization effort.
