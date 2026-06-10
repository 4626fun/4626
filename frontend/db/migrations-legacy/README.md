# Legacy Bootstrap Migrations (Archived)

**Status**: Historical only. Do not add new files here.

This directory contains the pre-2026 "three-copy" bootstrap mirrors that used to live alongside:

- `supabase/migrations/` (the single source of truth)
- Raw `CREATE TABLE IF NOT EXISTS` strings inside `ensure*Schema()` functions

After the full schema condensation effort (see `docs/operations/supabase-schema-condensation.md`), all authoritative DDL lives in `supabase/migrations/`.

Runtime cold-start needs are handled exclusively through:

```ts
import { ensureMigrationApplied } from '../db/schemaBootstrap.js'
// or the named helpers
await ensureAlfaclubSchema(db)
await ensureFinalAdditiveColumns(db)
```

## Why this folder still exists

- Git history preservation for the old bootstrap snapshots.
- Reference for anyone bisecting very old issues.
- Some extremely old dev/preview environments may still have partial reliance on these files (rare).

## Rules going forward (enforced)

- **Never** create new `NNN_*.sql` files in this directory.
- **Never** duplicate table definitions as raw SQL strings in `frontend/server/`.
- New tables/columns → `supabase/migrations/`
- Cold-start bootstrap → extend `schemaBootstrap.ts` + call `ensureMigrationApplied(...)`

The automated guard `pnpm -C frontend guard:schema` will fail if raw DDL patterns reappear in production server code.

## Original count at archival time

~60 files (001–052 range + various AMOE/Alfaclub/creator metrics snapshots).

All critical tables from this set have been promoted to proper `supabase/migrations/` entries with corresponding delegation in the canonical helper.

Last updated: 2026 schema condensation final pass.
