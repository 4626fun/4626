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
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/MEMORY.md`](../../frontend/server/_lib/hermit/seed/MEMORY.md) | Append-only learnings; Spanish corrections live here. |
| Pinata workspace seeds (this repo) | [`frontend/server/_lib/hermit/seed/SPANISH.md`](../../frontend/server/_lib/hermit/seed/SPANISH.md) | Spanish style guide. |
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
8. Persist or apply a long-term Spanish dialect preference via
   `MEMORY.md` (see "Dialect preference persistence" below).

The directive is shared across all three strict-JSON prompt shapes so
behaviour stays consistent for `/hermit copy|announce|quest|tone`, `/meme`,
and `/gmeow`.

## Deploying the seed files to the Pinata host

The Pinata-side agent reads files from `/home/node/clawd/workspace/`. When
the agent is bootstrapped or re-deployed:

1. Copy these four files from this repo into the agent workspace:

   ```
   frontend/server/_lib/hermit/seed/SOUL.md     ->  /home/node/clawd/workspace/SOUL.md
   frontend/server/_lib/hermit/seed/USER.md     ->  /home/node/clawd/workspace/USER.md
   frontend/server/_lib/hermit/seed/MEMORY.md   ->  /home/node/clawd/workspace/MEMORY.md
   frontend/server/_lib/hermit/seed/SPANISH.md  ->  /home/node/clawd/workspace/SPANISH.md
   ```

2. Confirm `MEMORY.md` exists. The current Pinata transcript shows
   `MEMORY.md` ENOENT errors — seeding the file once silences them
   permanently. Subsequent corrections should be appended, not rewritten.

3. **Restart Hermit** on Pinata after the workspace is updated so the agent
   re-reads `SOUL.md` and friends. Without a restart, only newly-spawned
   sessions will see the new files.

No env-var or secret rotation is required.

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

## Dialect preference persistence

When a user sends a Spanish dialect signal (flag emoji or text hint), the
host's `Spanish dialect:` line is now accompanied by a memory-persistence
clause that instructs the agent to write the preference into workspace
`MEMORY.md` before emitting the final strict JSON. On subsequent turns
without an explicit signal, the agent reads `MEMORY.md` and applies the
recorded dialect.

### Persistence semantics

- **Explicit signal this turn (flag/hint)**: prompt contains
  `Memory persistence (explicit signal):`. The agent uses its file edit
  tool to update `MEMORY.md` so the bullet
  `- Preferred Spanish dialect: <dialect> (set by flag/text hint)` exists
  exactly once under
  `## Preferred dialect` → `### Long-term preferences (operator-curated):`.
  An existing `Preferred Spanish dialect:` bullet is **replaced**, never
  duplicated. The most recent signal wins.
- **No explicit signal**: prompt contains
  `Memory persistence (no explicit signal):`. The agent reads `MEMORY.md`
  first; if a `Preferred Spanish dialect:` bullet exists, it applies that
  dialect for the turn. Otherwise it falls back to `neutral_latam`.
- **Strict JSON contract is preserved**: the MEMORY.md update is a tool
  action only. The final assistant message remains exactly the strict
  JSON object the host requested — no prose, no narration of the file
  edit, no markdown fences.

### Limitation

The host (this repo) does not write to the agent workspace directly — the
persistence is **instruction-level** (prompt directive + seed `SOUL.md` /
`MEMORY.md` rule). It depends on the Pinata Hermit agent exposing a file
edit tool over its workspace and following the directive. If the agent
does not have a write tool, this gracefully degrades to the existing
per-turn behavior: the dialect is applied for the current turn but the
preference does not stick. Operators can still curate the bullet manually
on the host (then restart Hermit) when needed.

### Smoke tests

Run these in order against an AlfaChat dev room:

| Step | Prompt | Expected behavior |
| --- | --- | --- |
| 1 | `/hermit announce 🇲🇽 drop nuevo en 30 minutos` | Strict JSON, Mexican-flavor Spanish values. `MEMORY.md` "Preferred Spanish dialect:" bullet is `mexico`. |
| 2 | `/hermit announce drop nuevo en 30 minutos` | No flag/hint. Reply uses Mexican-flavor Spanish (memory applied). |
| 3 | `/hermit announce 🇪🇸 drop nuevo en 30 minutos` | Strict JSON, peninsular Spanish. `MEMORY.md` bullet now reads `spain` (replaced, not duplicated). |
| 4 | `/hermit announce drop nuevo en 30 minutos` | No flag/hint. Reply uses peninsular Spanish (memory applied). |
| 5 | `/hermit announce vault update` | English input. Reply in English; `MEMORY.md` not modified. |

Verification checklist after each Spanish step:

- Final reply is strict JSON only — no prose, no markdown fences, no
  mention of the MEMORY.md edit.
- Inspect the agent workspace `MEMORY.md`: only one
  `- Preferred Spanish dialect: <dialect>` bullet under
  "Long-term preferences (operator-curated):"; older sections of the file
  remain untouched.
- For the no-flag steps (2, 4), confirm the dialect flavor matches the
  memory-recorded value, not `neutral_latam`.

## Out of scope

- AlfaClub JWT, session, or auth wiring.
- Railway / Vercel deployment configs.
- Production secret rotation.
- `/gmeow` meme catalogue itself (still served from `memeStore.ts`).
