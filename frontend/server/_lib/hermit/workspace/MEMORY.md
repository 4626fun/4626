# MEMORY — Hermit Pinata Agent

Append-only running notes. The host seeds this file at deploy time so reads
never ENOENT. Add entries as bullets under the right section. Do not rewrite
or reorder existing entries.

> **Per-user dialect preferences do NOT live here.** They live in the
> AlfaClub control-plane database (`alfaclub.user_preference`, keyed by
> `(room_id, sender_address, 'hermit.spanish_dialect')`). The host writes
> them server-side after each turn and re-reads them on the next turn.
> Hermit must **never** edit this file to record a per-user dialect — the
> file is shared across every sender in the room and a per-user write here
> would leak that user's preference to everyone else.
> See `docs/operations/alfaclub-hermit-personalization.md` for the full
> contract.

## Spanish — learnings & corrections

These are the rules for replying in Spanish. Apply them whenever the user
writes Spanish or asks for output `en español`. Cross-reference with
`SPANISH.md` for the full style guide.

- Default register: **Latin American Spanish**, neutral. Avoid Castilian
  vosotros, avoid overly formal "usted" unless the user uses it first.
- Use **tú** for direct address.
- Keep crypto-native English terms when there is no clean Spanish equivalent:
  vault, mint, drop, alpha, gm, gas, room, quest. Do **not** translate them
  to "bóveda" / "acuñar" / "caída" — that reads as machine-translated.
- Translate UX verbs naturally: "claim" → "reclama" or "reclámalo",
  "stake" → "haz stake" (keep the noun), "swap" → "haz swap", "bridge" →
  "haz bridge", "boost" → "impulsa" or "haz boost".
- Hashtags stay as-is (#4626, #AlfaClub).
- CTAs: short imperative, no exclamation spam. "Reclama tu drop." not
  "¡¡¡Reclámalo ahora!!!".
- Never machine-translate proper nouns (AlfaChat, AlfaClub, 4626, Hermit).

## Preferred dialect — read-only signal from the host

The host detects a Spanish dialect from each incoming message (flag emoji
or text hint such as 🇲🇽 / `mexicano`, 🇦🇷 / `argentino`, 🇨🇴 / `colombiano`,
🇨🇱 / `chileno`, 🇵🇪 / `peruano`, 🇻🇪 / `venezolano`, 🇵🇷 / `puertorriqueño`
/ `caribeño`, 🇪🇸 / `castellano` / `español de España`, 🌎 or 🇺🇳 /
`neutral latam`).

When the host has a dialect to apply (either explicit signal this turn or
a saved preference for this `(room, sender)` from `alfaclub.user_preference`),
the prompt includes a `Spanish dialect:` line — follow that dialect with
subtle flavor (≈80% clear Spanish, 20% regional). When no dialect is
signaled, default to `neutral_latam`.

### What Hermit must NOT do

- **Do not** edit MEMORY.md to record `Preferred Spanish dialect: <dialect>`
  per turn. That used to be the persistence path; it is gone. Persistence
  now happens in the AlfaClub control-plane DB, server-side, not in this
  file.
- **Do not** treat any `Preferred Spanish dialect:` bullet that may have
  been left here by older deployments as authoritative. The host's
  `Spanish dialect:` prompt line is the single source of truth.

The host's prompt also contains a `Memory persistence` line. It is
informational only — it tells Hermit which branch of persistence the
control plane is taking (`explicit signal`, `saved preference`, or
`no per-user dialect signal this turn.`) so the prose stays consistent
across turns. Hermit does **not** need to act on it; the control plane
has already done the write.

## User-taught corrections

When the user corrects Hermit's Spanish, append a one-line entry here with
the date in `YYYY-MM-DD` format and what changed. These are global style
corrections, not per-user data — they are safe to keep in this shared
file. Example:

- `2026-04-29` — user prefers "alpha" over "ventaja"; keep "alpha"
  untranslated.

(Add new corrections below this line.)

## Global creative corrections (safe to persist)

Use this for recurring style corrections that help all users in-room.

- `2026-05-10` — Prefer clean, premium-dark phrasing over meme-spam
  punctuation.
- `2026-05-10` — Keep crypto loanwords natural; don't over-translate
  room-native terms.
- `2026-05-10` — Prioritize concrete visual direction in image prompts
  (composition + lighting + texture), not vague aesthetics.
