# AlfaClub Hermit Personalization — Architecture & Runbook

**Scope.** Per-user style preferences for Hermit replies in AlfaClub
chat rooms. Today: Spanish dialect. Tomorrow: tone, meme density, etc.
Generic key/value store; one schema migration covers all of it.

This document is the source of truth for **what is persisted, where,
and who is allowed to write it**. The architecture is deliberately
narrow: per-(room, sender), best-effort, control-plane only, never
auth.

## Why this exists

Hermit (Pinata creative lane) detects a Spanish dialect signal per
turn — a flag emoji or a text hint like "mexicano" or "argentino".
Before this work, the only persistence was a single shared
`MEMORY.md` file in the Pinata workspace: one user's `🇲🇽` would
rewrite the file for everyone in the room until another flag arrived.
That made the room dialect chaotic and surprising.

Per-(room, sender) persistence fixes that:

- Alice's `🇲🇽` only personalises Alice's subsequent turns.
- Bob keeps his own dialect (or the `neutral_latam` default).
- The shared `MEMORY.md` is no longer touched per-turn.

## Architecture

```
┌──────────────────────┐    ┌────────────────────────┐    ┌────────────────────┐
│ AlfaClub WS / API    │───▶│ Vercel chat-bridge     │───▶│ Hermit (Pinata)    │
│ (room messages)      │    │ /api/v1/alfaclub/      │    │ creative lane      │
└──────────────────────┘    │   chat-bridge-run      │    │ (skillRouter.ts)   │
                            │                        │    └────────────────────┘
                            │ executeDeterministicC. │           ▲
                            │   → executeCommand     │           │ userPreferences
                            │     case 'hermit':     │           │ (resolved per turn)
                            │       resolveHermit-   │           │
                            │       RoomContext()  ──┼───────────┘
                            └──────────┬─────────────┘
                                       │ read / upsert (best-effort)
                                       ▼
                            ┌────────────────────────┐
                            │ Supabase / Postgres    │
                            │ alfaclub.user_         │
                            │   preference           │
                            └────────────────────────┘
```

**Lane ownership**

- `frontend/server/_lib/alfaclub/userPreferenceStore.ts` is the only
  module that touches `alfaclub.user_preference`. Owned by the Vercel
  chat-bridge / control plane.
- `frontend/server/commands/execute.ts` is the cross-lane glue. It
  parses the deterministic-executor `chatId` (`alfaclub:<roomId>`),
  dynamically imports the store, reads the saved dialect, and passes
  both the value and a thin write closure into Hermit.
- `frontend/server/_lib/hermit/skillRouter.ts` (the Hermit creative
  lane) is forbidden from importing `userPreferenceStore` directly.
  See `personalizationBoundary.test.ts` for the static check.

This split is the same boundary PR #463 establishes for auth: Pinata
is creative-only; control-plane state lives on Vercel.

## Schema

```sql
CREATE TABLE alfaclub.user_preference (
  room_id           TEXT NOT NULL,
  sender_address    TEXT NOT NULL,        -- lower-cased EVM address
  preference_key    TEXT NOT NULL,        -- e.g. 'hermit.spanish_dialect'
  preference_value  TEXT,                 -- NULL = explicitly unset
  updated_by        TEXT,                 -- 'hermit.flag' / 'hermit.text-hint' / 'admin.api'
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (room_id, sender_address, preference_key)
);
ALTER TABLE alfaclub.user_preference ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_preference_deny_all
  ON alfaclub.user_preference FOR ALL TO public USING (false) WITH CHECK (false);
CREATE INDEX user_preference_sender_idx
  ON alfaclub.user_preference(sender_address);
```

Two byte-for-byte identical migration files keep `frontend/db` and
`supabase/migrations` in lockstep:

- `frontend/db/migrations/036_alfaclub_user_preferences.sql`
- `supabase/migrations/20260501000000_alfaclub_user_preferences.sql`

The runtime also runs a defensive `CREATE TABLE IF NOT EXISTS` on
first read (in `ensureAlfaClubVigilanteSchema`) so the table comes up
on environments where the migration hasn't been applied yet.

### Why generic key/value

Future preferences (tone, meme style, emoji density, …) ride the same
table without another migration. Keys are namespaced by feature
(`hermit.*`, `keepr.*`) so the table stays self-documenting and reads
can filter by prefix.

## Priority order

When Hermit builds a prompt for an AlfaClub chat turn, the active
dialect is resolved in this order:

1. **Explicit flag/text hint** in the current user message
   (e.g. `🇲🇽`, "mexicano", `🇨🇱`, "rioplatense"). The control plane
   upserts that value as the new saved preference for **this sender**
   only, then the prompt uses it for this turn.
2. **Persisted user preference** for `(room_id, sender_address)` if
   present.
3. **Default** → `neutral_latam`.

Room-level defaults are **not** wired today. The injection point is
in place — the bridge can resolve a room default and pass it through
`HermitUserPreferences.spanishDialect` if priority (2) returns null —
but until product asks for that, every room defaults to
`neutral_latam`.

## Boundary contract

These invariants are enforced by tests; do not break them.

- **Hermit creative lane MUST NOT write auth state.**
  Architecture-boundary tests forbid `chatTokenStore`,
  `privyTokenRefresher`, and `alfaclub_runtime_secret` references in
  `skillRouter.ts`, `policy.ts`, `memeStore.ts`, `repository.ts`,
  `types.ts`. Existing tests in PR #463 cover this.
- **Hermit creative lane MUST NOT import the user-preference store
  directly.** Boundary check is
  `server/_lib/hermit/personalizationBoundary.test.ts`. Personalization
  is delivered by dependency injection (`userPreferences`,
  `persistPreference`) — that is the only allowed coupling.
- **Preferences are best-effort.** A DB outage MUST NOT break a chat
  reply. The store, the resolver in `execute.ts`, and the
  persist-closure in `skillRouter.ts` all swallow errors and continue
  with the existing default behavior.

## Operator runbook

### Inspecting a sender's prefs

```sql
SELECT room_id, preference_key, preference_value, updated_by, updated_at
FROM alfaclub.user_preference
WHERE sender_address = lower($1)
ORDER BY room_id, preference_key;
```

### Inspecting all prefs in a room

```sql
SELECT sender_address, preference_key, preference_value, updated_by, updated_at
FROM alfaclub.user_preference
WHERE room_id = $1
ORDER BY sender_address, preference_key;
```

### Forcing a sender's dialect (operator override)

```sql
INSERT INTO alfaclub.user_preference
  (room_id, sender_address, preference_key, preference_value, updated_by)
VALUES
  ($1, lower($2), 'hermit.spanish_dialect', $3, 'admin.api')
ON CONFLICT (room_id, sender_address, preference_key) DO UPDATE
SET preference_value = EXCLUDED.preference_value,
    updated_by       = EXCLUDED.updated_by,
    updated_at       = NOW();
```

### Privacy purge

```sql
-- Clear all of a sender's prefs across rooms.
DELETE FROM alfaclub.user_preference WHERE sender_address = lower($1);

-- Clear a single (room, sender) tuple.
DELETE FROM alfaclub.user_preference
WHERE room_id = $1 AND sender_address = lower($2);
```

### Kill switch

If something goes wrong (unexpected dialect drift, suspicious row
content, table corruption), set this on the Vercel project to
disable **both reads and writes** at the store level:

```
ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED=1
```

Hermit immediately reverts to per-turn dialect detection (the
pre-personalization behavior). No redeploy required — the env var is
checked on every call.

### `updated_by` audit values

- `hermit.flag` — sender posted a flag emoji that this turn matched.
- `hermit.text-hint` — sender posted a text hint that this turn matched.
- `admin.api` — operator wrote the row via the SQL override above.

If a row's `updated_by` is anything else, it was written by an
unexpected lane and worth investigating.

## Manual production migration / deploy steps

This PR does not run any production migration itself. After merge:

1. **Apply the migration.** Run
   `supabase/migrations/20260501000000_alfaclub_user_preferences.sql`
   against the Supabase project (or whichever pipeline applies SQL
   to prod). The runtime fallback `CREATE TABLE IF NOT EXISTS` will
   also work but the migration is the source of truth.
2. **Verify the table is empty.** Initial state: `SELECT count(*)
   FROM alfaclub.user_preference;` returns `0`. If not, investigate.
3. **Smoke-test in a dev room.** Run the smoke-test table in
   `docs/operations/hermit-pinata-spanish.md` § "Dialect preference
   persistence (per-(room, sender))" with two distinct sender wallets.
4. **Confirm the kill switch is unset** (no
   `ALFACLUB_USER_PREFERENCE_PERSIST_DISABLED` on Vercel) before
   declaring the rollout done.

## Out of scope

- AlfaClub Privy auth, JWT rotation, refresh token storage. (See
  `docs/operations/alfaclub-creative-architecture.md` and PR #463.)
- Pinata workspace seed files (`SOUL.md`, `USER.md`, `MEMORY.md`,
  `SPANISH.md`). Those still ship per `hermit-pinata-spanish.md` —
  the runtime no longer asks Hermit to write to `MEMORY.md` per turn,
  but the file itself is still the room-wide style seed and is
  expected to exist on the Pinata host.
- Slash command access. On the AlfaClub bridge (`chatId = alfaclub:<room>`)
  `/hermit`, `/meme`, and `/gmeow` are open to any room user — the
  deterministic executor skips the `HERMIT_ALLOWED_USERS` allowlist on
  this surface. Non-AlfaClub surfaces (direct HTTP at
  `/api/v1/chat/hermit`, Telegram) still consult the allowlist. Bare
  `gmeow` (no `/`) remains sender-locked to Manito9v9 via
  `BARE_GMEOW_TRUSTED_SENDERS` in `chatBridge.ts` regardless of surface.
