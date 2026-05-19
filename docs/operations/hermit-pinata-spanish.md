# Hermit / Pinata Open Claw — Spanish Support Runbook

**Scope.** How to keep the Pinata-hosted Hermit (Open Claw / Clawd) agent
replying in natural Latin American Spanish when AlfaChat/AlfaClub users write
Spanish, while keeping the strict-JSON contract the host expects.

This is a **content-only** change: we ship workspace seed files and a
language directive in the host-side prompt builders. No JWT, Railway, Vercel
cron, or production secret changes.

## Components

| Layer | File | Role |
| --- | --- | --- |
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/SOUL.md`](../../frontend/server/_lib/hermit/seed/SOUL.md) | Identity, voice, hard rules, language rule. |
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/USER.md`](../../frontend/server/_lib/hermit/seed/USER.md) | Per-user/room context placeholder. |
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/MEMORY.md`](../../frontend/server/_lib/hermit/seed/MEMORY.md) | Append-only **global** style learnings (room-wide vocabulary corrections). Per-`(room, sender)` dialect preferences live in the AlfaClub control-plane DB (`alfaclub.user_preference`), not here. |
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/SPANISH.md`](../../frontend/server/_lib/hermit/seed/SPANISH.md) | Spanish style guide. |
| Full workspace mirror (this repo) | [`frontend/server/_lib/hermit/workspace/`](../../frontend/server/_lib/hermit/workspace/) | All Pinata workspace md files + `avatars/pinnie.png`; kept in sync via `import-pinata` / `pull-pinata`. |
| Host prompt builder | [`frontend/server/_lib/hermit/skillRouter.ts`](../../frontend/server/_lib/hermit/skillRouter.ts) | `buildPinataPromptForHermit / Image / Gmeow` now embed a language directive. |

## What the language directive does

Every Hermit prompt sent to Pinata now ends with a `Language:` paragraph that
tells the agent to:

1. Detect the user's language.
2. If Spanish (or `en español` is requested), set string values in natural
   Latin American Spanish and consult workspace `SPANISH.md` / `MEMORY.md`.
3. Otherwise reply in English.
4. Keep JSON keys exactly as specified — keys never get translated.
5. Keep crypto-native loanwords (vault, mint, drop, alpha, gm, gas) untranslated.
6. Hashtags stay as-is.
7. Never wrap JSON in markdown fences.
8. Apply the active Spanish dialect when the host prompt provides one
   (the host pulls it from the AlfaClub control-plane DB — Hermit does
   not persist it itself; see "Dialect preference persistence" below).

The directive is shared across all three strict-JSON prompt shapes so
behaviour stays consistent for `/hermit copy|announce|quest|tone`, `/meme`,
and `/gmeow`.

## Deploying the seed files to the Pinata host

The Pinata-side agent reads files from `/home/node/clawd/workspace/`. This
repo has no automated deploy hook to that workspace — seed sync is manual.
Use the helper script:

```sh
# Print where each file maps on the Pinata side
bash frontend/scripts/hermit-seed-sync.sh list

# Verify all four files are present + non-empty (suitable for CI)
bash frontend/scripts/hermit-seed-sync.sh verify-local

# Show byte size + sha256 of each — paste into the PR description so a
# reviewer can confirm exactly what is about to be shipped to Pinata.
bash frontend/scripts/hermit-seed-sync.sh diff-local

# Stage seeds into a directory or tarball for upload to the Pinata UI
bash frontend/scripts/hermit-seed-sync.sh bundle /tmp/hermit-seed/
bash frontend/scripts/hermit-seed-sync.sh tar    /tmp/hermit-seed.tar.gz

# Full workspace (AGENTS.md, BOOTSTRAP.md, avatars/, …) — versioned under server/_lib/hermit/workspace/
bash frontend/scripts/hermit-seed-sync.sh verify-workspace
bash frontend/scripts/hermit-seed-sync.sh bundle-workspace /tmp/hermit-workspace/
bash frontend/scripts/hermit-seed-sync.sh tar-workspace /tmp/hermit-workspace.tar.gz

# Pull latest from Pinata agent git (clone once at repo root: agent-hermit-x7lmjaxx/)
bash frontend/scripts/hermit-seed-sync.sh pull-pinata
bash frontend/scripts/hermit-seed-sync.sh import-pinata   # after manual edits in the clone only
```

When the agent is bootstrapped or re-deployed:

1. Run `bundle` or `tar` on a clean checkout of `main`.
2. Copy each file into `/home/node/clawd/workspace/` on the Pinata host
   (filenames stay as `SOUL.md`, `USER.md`, `MEMORY.md`, `SPANISH.md`).
3. Confirm `MEMORY.md` exists. The current Pinata transcript shows
   `MEMORY.md` ENOENT errors — seeding the file once silences them
   permanently. Subsequent corrections should be appended, not rewritten.
4. **Restart Hermit** on Pinata after the workspace is updated so the agent
   re-reads `SOUL.md` and friends. Without a restart, only newly-spawned
   sessions will see the new files.

No env-var or secret rotation is required. Architecture / which host owns
what is described in
[`docs/operations/alfaclub-creative-architecture.md`](alfaclub-creative-architecture.md).

## Verifying after deploy

Send these test prompts in an AlfaChat dev room:

| Prompt | Expected |
| --- | --- |
| `/hermit announce vault update` | English JSON, English values. |
| `/hermit announce drop nuevo en 30 minutos` | JSON with English keys, Spanish (neutral LatAm) string values, no markdown fences. |
| `/meme akita noir en español` | `imagePrompt`, `caption`, `hashtags` keys; Spanish values. |
| `/gmeow gato risueño` | `line` key in English; Spanish line. |

### Dialect smoke tests

Use these to confirm flag/text-hint dialect routing. Each should return
strict JSON with English keys and Spanish values that lean **subtly** into
the requested dialect (≈80% clear Spanish, 20% regional flavor — never
caricature):

| Prompt | Expected dialect | Flavor cue |
| --- | --- | --- |
| `/hermit announce 🇲🇽 drop nuevo en 30 minutos` | `mexico` | Sparing `ya`, `órale`, `neta`. |
| `/hermit announce 🇦🇷 drop nuevo en 30 minutos` | `argentina` | Voseo (`vos / tenés / sos`); sparing `che`, `dale`. |
| `/hermit announce 🇨🇴 drop nuevo` | `colombia` | Warm, clear; sparing `parce`, `bacano`. |
| `/hermit announce 🇨🇱 drop nuevo` | `chile` | Sparing `bacán`, `altiro`, `po`. |
| `/hermit announce 🇵🇪 drop nuevo` | `peru` | Even register; `chévere`, `pe` if natural. |
| `/hermit announce 🇻🇪 drop nuevo` | `venezuela` | `chévere`, `pana` if natural. |
| `/hermit announce 🇵🇷 drop nuevo` | `caribbean` | Rhythmic; `brutal`, `wepa` if natural. |
| `/hermit announce 🇪🇸 drop nuevo` | `spain` | Peninsular `vale`, `guay`; `coger` is fine. |
| `/hermit announce 🌎 drop nuevo` | `neutral_latam` | Neutral LatAm baseline. |
| `/hermit copy en argentino: gm vault` | `argentina` | Text hint route. |
| `/hermit copy en castellano: gm vault` | `spain` | Text hint route. |

Failure modes specific to dialects:

- Stereotype/caricature output ("¡órale wey, qué padrísimo!", "che boludo
  total") — flag, append a correction to `MEMORY.md`, restart.
- Dialect bleed: a Castilian flag returning Argentine voseo, etc. — check
  the `Spanish dialect:` line in the prompt; if missing, the host detector
  did not match. Add the flag/text hint to `SPANISH_DIALECT_FLAG_MAP` /
  `SPANISH_DIALECT_TEXT_HINTS` in `skillRouter.ts`.

Failure modes to watch for:

- Markdown fences (` ```json `) around the JSON — directive should prevent
  this; if it returns, re-check the workspace seed and restart.
- Translated JSON keys (`"linea"`, `"línea"`, `"hashtag"`) — schema break,
  the host JSON parser rejects this; treat as a bug.
- Over-translated crypto terms (`"bóveda"` for vault, `"acuñar"` for mint) —
  append a corrections entry to `MEMORY.md` under
  `## User-taught corrections` and restart.

## Teaching new vocabulary

When a user corrects Hermit's Spanish, append a one-line entry to the
**User-taught corrections** section of `MEMORY.md` on the Pinata host:

```
- 2026-04-29 — user prefers "alpha" over "ventaja"; keep "alpha" untranslated.
```

Keep the section append-only — the agent re-reads the whole file each turn,
so older entries stay in effect.

## Dialect preference persistence (per-(room, sender))

> **Changed.** Per-user dialect preferences now live in the AlfaClub
> control-plane database, **not** in the workspace `MEMORY.md` file.
> See `docs/operations/alfaclub-hermit-personalization.md` for the
> full architecture and recovery playbook. This section summarises
> the user-visible contract.

When a user sends a Spanish dialect signal (flag emoji or text hint),
the AlfaClub bridge upserts a row into `alfaclub.user_preference`
keyed by `(room_id, sender_address, 'hermit.spanish_dialect')`. On
subsequent turns from the **same sender in the same room** the bridge
loads that row and passes it into Hermit's prompt builder; turns from
**other senders** are unaffected.

### Persistence semantics

- **Explicit signal this turn (flag/hint)**: prompt contains
  `Memory persistence (explicit signal):` with the active dialect
  named. The control plane (Vercel, not Hermit) writes the row.
  Hermit is told **NOT** to modify the shared workspace `MEMORY.md`
  — the shared MEMORY.md would leak this user's choice to every
  other sender in the room.
- **Saved preference (no explicit signal)**: prompt contains
  `Memory persistence (saved preference):` and the dialect from the
  saved row. Hermit applies that dialect for the turn.
- **No signal and no saved preference**: prompt contains
  `Memory persistence: no per-user dialect signal this turn.`
  Hermit defaults to `neutral_latam`.
- **Strict JSON contract is preserved**: the control-plane upsert
  happens server-side after the prompt is built; Hermit's output is
  still exactly the strict JSON the host requested.

### Priority order

1. Explicit flag/text hint in the current user message → persists for
   that sender, drives this turn's reply.
2. Persisted user preference (`alfaclub.user_preference`) for
   `(room_id, sender_address)`.
3. Default → `neutral_latam`.

Room-wide defaults are not currently configured. If you need one,
plumb it through `userPreferences` in the bridge before invoking the
deterministic executor — Hermit already honors that pathway.

### Storage and operator queries

Schema lives in two paired migrations (kept in lockstep):

- `frontend/db/migrations/036_alfaclub_user_preferences.sql`
- `supabase/migrations/20260501000000_alfaclub_user_preferences.sql`

Inspect a single sender's prefs:

```sql
SELECT room_id, sender_address, preference_key, preference_value, updated_by, updated_at
FROM alfaclub.user_preference
WHERE sender_address = lower($1)
ORDER BY room_id, preference_key;
```

Purge a sender (privacy / debug):

```sql
DELETE FROM alfaclub.user_preference WHERE sender_address = lower($1);
```

Purge a single (room, sender) tuple:

```sql
DELETE FROM alfaclub.user_preference
WHERE room_id = $1 AND sender_address = lower($2);
```

Force-rotate a sender's dialect manually (operator override):

```sql
INSERT INTO alfaclub.user_preference (room_id, sender_address, preference_key, preference_value, updated_by)
VALUES ($1, lower($2), 'hermit.spanish_dialect', $3, 'admin.api')
ON CONFLICT (room_id, sender_address, preference_key) DO UPDATE
SET preference_value = EXCLUDED.preference_value,
    updated_by = EXCLUDED.updated_by,
    updated_at = NOW();
```

Reverting persistence entirely (kill switch):

```bash
# On the Vercel project — disables both reads and writes from the bridge.
ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED=1
```

The bridge gracefully falls back to per-turn dialect detection when
the table is empty, the DB is unreachable, or the kill switch is set.

### Smoke tests

Run these in order against an AlfaChat dev room with two distinct
sender wallets:

| Step | Sender | Prompt | Expected behavior |
| --- | --- | --- | --- |
| 1 | A | `/hermit announce 🇲🇽 drop nuevo en 30 minutos` | Strict JSON, Mexican-flavor Spanish. New row `(room, A, mexico)`. |
| 2 | A | `/hermit announce drop nuevo en 30 minutos` | No flag. Reply still Mexican-flavor (saved preference applied). |
| 3 | B | `/hermit announce drop nuevo en 30 minutos` | Sender B has no row; reply defaults to `neutral_latam`. **B is unaffected by A's flag.** |
| 4 | A | `/hermit announce 🇪🇸 drop nuevo en 30 minutos` | Strict JSON, peninsular Spanish. Row `(room, A)` updated to `spain` (replaced, not duplicated). |
| 5 | A | `/hermit announce vault update` | English input. Reply in English; row unchanged. |

Verification checklist:

- Final reply is strict JSON only — no prose, no markdown fences, no
  mention of MEMORY.md edits.
- `alfaclub.user_preference` shows exactly one row per `(room, sender, hermit.spanish_dialect)`. Step 4 should mutate row A's `preference_value` and `updated_at`, not insert a duplicate.
- The shared workspace `MEMORY.md` is **unchanged** across all five
  steps. Per-user preferences must never land there.

## Out of scope

- AlfaClub JWT, session, or auth wiring. (Owned by Vercel cron — see
  [`alfaclub-creative-architecture.md`](alfaclub-creative-architecture.md).)
- Railway / Vercel deployment configs.
- Production secret rotation.
- `/gmeow` meme catalogue itself (still served from `memeStore.ts`).
