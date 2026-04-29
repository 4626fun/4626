# MEMORY — Hermit Pinata Agent

Append-only running notes. The host seeds this file at deploy time so reads
never ENOENT. Add entries as bullets under the right section. Do not rewrite
or reorder existing entries.

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

## Preferred dialect

The host detects a Spanish dialect from each incoming message (flag emoji or
text hint such as 🇲🇽 / `mexicano`, 🇦🇷 / `argentino`, 🇨🇴 / `colombiano`,
🇨🇱 / `chileno`, 🇵🇪 / `peruano`, 🇻🇪 / `venezolano`, 🇵🇷 / `puertorriqueño` /
`caribeño`, 🇪🇸 / `castellano` / `español de España`, 🌎 or 🇺🇳 /
`neutral latam`). When detected, the prompt includes a `Spanish dialect:`
line — follow that dialect with subtle flavor (≈80% clear Spanish, 20%
regional). When no dialect is signaled, default to `neutral_latam` **unless
this file records a long-term preference (see below)**.

### Persistence rule (turn-by-turn)

When the host prompt includes an **explicit** dialect signal (flag emoji or
text hint), the prompt also instructs you to update this file before
producing the final JSON. Use your file edit tool to ensure the
"Long-term preferences (operator-curated)" list contains exactly one
bullet of the form:

```
- Preferred Spanish dialect: <dialect> (set by flag/text hint)
```

Where `<dialect>` is one of:
`neutral_latam`, `mexico`, `argentina`, `colombia`, `chile`, `peru`,
`venezuela`, `caribbean`, `spain`.

If a `Preferred Spanish dialect:` bullet already exists, **replace** its
value (do not append a duplicate). The most recently signaled dialect wins.

When the host prompt does **not** include an explicit dialect signal and
you are replying in Spanish, read the bullet above and apply that dialect.
If the bullet is missing or unrecognized, fall back to `neutral_latam`.

The explicit signal in the current turn overrides whatever this file
records — and updates this file for the next turn.

Do not mention the file edit in your final JSON output. The user only sees
strict JSON; the MEMORY.md write happens as a tool call.

### Long-term preferences (operator-curated):

- (Add entries here, e.g. `wallet 0xabc... → argentina`.)

Examples (illustrative — replace as the live preference changes):

```
- Preferred Spanish dialect: mexico (set by 🇲🇽)
- Preferred Spanish dialect: argentina (set by 🇦🇷)
- Preferred Spanish dialect: spain (set by 🇪🇸)
```

## User-taught corrections

When the user corrects your Spanish, append a one-line entry here with the
date in `YYYY-MM-DD` format and what changed. Example:

- `2026-04-29` — user prefers "alpha" over "ventaja"; keep "alpha"
  untranslated.

(Add new corrections below this line.)
