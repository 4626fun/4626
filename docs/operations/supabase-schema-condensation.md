# Supabase Schema Condensation (2026)

**Goal**: Exactly **one Supabase project** (`qajpnuvqlcfseghnldkl`) is the single source of truth for all production data and schema.

We previously had a painful "three copies" problem for many tables:

1. Authoritative migration in `supabase/migrations/2026....sql`
2. Bootstrap copy in `frontend/db/migrations/NNN_....sql`
3. Near-duplicate raw SQL strings inside `ensure*Schema()` functions in TypeScript

This made every schema change on AMOE, Alfaclub, control plane, creator metrics, etc. a multi-file maintenance burden with high risk of drift.

## Current State (Post-Cleanup)

- **One hosted database**: Supabase project `qajpnuvqlcfseghnldkl` only.
  - The historical "Vercel Postgres as a second production DB for hot cron paths" requirement has been retired (see `amoe-pr5b-publisher-runbook.md`).
- `supabase/migrations/` is the **single source of truth** for all DDL.
- `frontend/db/migrations/` is now **bootstrap-only** for the small set of tables that need cold-start creation in dev / preview / certain agent runtimes. It is no longer a parallel production apply target.
- New helper: `frontend/server/_lib/db/schemaBootstrap.ts` lets `ensure*Schema()` functions delegate to the authoritative migration files instead of duplicating SQL.

## Condensation Rules Going Forward

1. **New tables / columns** → Add them in a new `supabase/migrations/<timestamp>_<name>.sql` file (use `supabase migration new` when possible).
2. **If the table needs runtime bootstrap** (AMOE replay, Alfaclub vigilante stores, certain control-plane / agent tables, etc.) → also call `ensureMigrationApplied(db, 'the-file.sql')` from the relevant `ensure*Schema()` function.
3. **Do not** create a new file in `frontend/db/migrations/` unless it is genuinely required for a cold-start path that cannot wait for normal migration application. Prefer extending the new bootstrap helper.
4. Inside the single DB, use dedicated schemas for strong isolation when appropriate (`alfaclub` is the current good example).
5. RLS + `deny_all` restrictive policies remain the default for almost everything.

## Files to Touch When Changing Schema

| Change type                        | Primary file                              | Secondary (only when needed)          | Avoid duplicating here             |
|------------------------------------|-------------------------------------------|---------------------------------------|------------------------------------|
| New table or column                | `supabase/migrations/...`                 | `ensureXxxSchema()` via helper        | `frontend/db/migrations/`          |
| AMOE / Alfaclub / control plane    | `supabase/migrations/...`                 | `schemaBootstrap.ts` + caller         | Raw SQL in TS + frontend/db/       |
| Pure index / RLS tweak             | `supabase/migrations/...`                 | —                                     | —                                  |
| Waitlist core (very large surface) | `supabase/migrations/...` + waitlistSchema| Sub-modules (points, referrals, etc.) | —                                  |

## How to Retire More Duplication

- Pilot completed: AMOE core tables + Alfaclub user prefs now delegate through `schemaBootstrap.ts`.
- Next good candidates: `creatorMetricsSync.ts`, `control_plane_*` tables, remaining AMOE ensure blocks.
- Long-term: many `frontend/db/migrations/` files can be archived once all active cold-start paths go through the helper + authoritative migrations.

## References

- `frontend/server/_lib/db/schemaBootstrap.ts` (new condensation layer)
- `apps/docs-site/docs/security/amoe-pr5b-publisher-runbook.md` (updated to single-DB language)
- `AGENTS.md` (Supabase pooler + single project policy)
- `supabase/config.toml` (local dev against the same project)

If you're adding a new table that will be written by server-side automation or agents, default to putting it under a dedicated schema (e.g. `automation`, `control_plane`) rather than polluting `public`.

This is the direction: one project, one authoritative migration history, thin runtime bootstrap where truly required.

## Progress in Latest Session

- `schemaBootstrap.ts` enhanced with `ensureAlfaclubSchema()` convenience helper.
- AMOE replay store now delegates its core table.
- Alfaclub schema.ts cleaned up to use the named helper.
- Detailed duplication report created at `docs/operations/supabase-schema-duplication-report.md`.
- Creator metrics partial delegation started.

Continue converting the remaining raw DDL in hot paths (Alfaclub vigilante tables, more AMOE statements, creator metrics column work) in follow-up passes.

**Latest pass progress**: 
- **All major hotspots completed**:
  - Alfaclub: 0 raw CREATEs
  - AMOE: 0 raw CREATEs
  - Creator Metrics: 0 raw CREATEs
- Telegram trading schema: Fully condensed.
- Workspace schema: Condensation in progress (delegation + migration in place).
- Major duplication surfaces have been dramatically reduced. The established pattern continues to be applied to remaining files.