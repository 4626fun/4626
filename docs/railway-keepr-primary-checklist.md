# Railway Keepr Primary — Environment Checklist

Use this when setting up or debugging the primary XMTP agent on Railway.

## Required (will cause hard `process.exit(1)` if missing/wrong)

- [ ] `AGENT_RUNTIME_ROLE=primary` (or left unset — default is primary)
- [ ] `AGENT_CONSUME_XMTP=true` (or left unset when role is primary)
- [ ] `DATABASE_URL` (Supabase strongly recommended) or `POSTGRES_URL` (legacy/generic fallback)
- [ ] `XMTP_AGENT_KEY_ENCRYPTION_KEY` (32-byte hex) — required for multi-agent mode
- [ ] `XMTP_DB_DIRECTORY` points to a **mounted Railway Volume** (not `/tmp` or ephemeral storage)
- [ ] If using CSW identity for the agent (recommended):
  - [ ] `CANONICAL_CSW_ADDRESS`
  - [ ] `CANONICAL_CSW_PRIVY_WALLET_ID`
  - [ ] Full Privy server auth set:
    - [ ] `PRIVY_APP_ID`
    - [ ] `PRIVY_APP_SECRET`
    - [ ] `PRIVY_WALLET_AUTHORIZATION_KEY`
    - [ ] `PRIVY_WALLET_OWNER_ID`

## Strongly Recommended on Railway Primary

- [ ] `AGENT_RUNTIME_LOCK_REQUIRED=true` (defaults on when Postgres + primary on Railway)
- [ ] Persistent volume attached and mounted at `XMTP_DB_DIRECTORY`

## Quick Diagnostic Commands

```bash
# Local pre-flight check with your intended env vars
pnpm agent:railway-keepr-doctor
```

On Railway, look for these very early lines in the logs (they print during module evaluation):

```
[eliza][early] === KEEPR RAILWAY PRIMARY DIAGNOSTICS ===
[eliza][early] SUMMARY: ...
```

These appear before most other code and before the normal health server.

## Common Failure Modes on Railway

1. Forgetting to set `AGENT_CONSUME_XMTP=true` on the primary service.
2. Using `AGENT_RUNTIME_ROLE=standby` on Railway (forbidden).
3. Pointing `XMTP_DB_DIRECTORY` at ephemeral storage instead of a mounted volume.
4. Missing `XMTP_AGENT_KEY_ENCRYPTION_KEY` when `DATABASE_URL` is set.
5. Incomplete Privy server wallet credentials for the agent's CSW.

## Related Commands

- `pnpm agent:eliza` — start locally
- `pnpm agent:railway-keepr-doctor` — pre-deployment checklist

See `frontend/server/agents/eliza/index.ts` (search for `[eliza][early]` and `validateStartupEnv`) for the current implementation of these checks.

---

## Hermit Creative Agent (hermit.4626.fun) — Separate Railway Service

This service runs the AlfaClub chat bridge + Pinata OpenClaw creative lane (`/hermit`, `/gmeow`, `/meme`, room-1659 theatrical injection, etc.). It is intentionally **not** the Keepr primary.

It still transitively imports a large chunk of the alfaclub + command surface at module load time (via `chatBridge.ts` → `executeDeterministicCommand` → `commands/execute.ts` → `hermit/skillRouter.ts` + many `chatTokenStore` / `authHealthStore` / `chatIngestStore` modules that all do `getDb()` + `ensureAlfaClubVigilanteSchema`).

### Required for Hermit Railway boot (missing = silent death before /healthz)
- [ ] `DATABASE_URL` or `POSTGRES_URL` (Supabase pooler — same as Keepr primary)
- [ ] AlfaClub auth (one of):
  - [ ] `ALFACLUB_CHAT_JWT` (short-lived identity token), **or**
  - [ ] The full Privy refresh triplet so the in-process refresher can bootstrap:
    - `ALFACLUB_CHAT_PRIVY_ACCESS_TOKEN`
    - `ALFACLUB_CHAT_PRIVY_REFRESH_TOKEN`
    - (The identity token will be written into `alfaclub_runtime_secret.chat_jwt` on first tick)

### Strongly Recommended for 1659 theatrical marketing
- [ ] `HERMIT_PINATA_CHAT_ENDPOINT` + `HERMIT_PINATA_BEARER_TOKEN` (the actual creative brain)
- [ ] `ALFACLUB_CHAT_ROOM_ID=1659` **or** `ALFACLUB_HERMIT_COMMAND_ROOMS=1659,1043,...`

### Quick Diagnostic
```bash
pnpm agent:railway-hermit-doctor
```

On Railway, look for the raw table that starts with:
```
[hermit][early] === HERMIT RAILWAY DIAGNOSTICS ===
[hermit][early] SUMMARY: ...
```

This table (plus the super-early minimal health listener) is emitted before the heavy imports run. It is the only signal when the process dies during static evaluation.

### Common Hermit-specific Failure on Railway
- Setting only the Keepr-primary vars on the hermit.4626.fun service and forgetting the DATABASE_URL + AlfaClub chat tokens.
- Expired `ALFACLUB_CHAT_JWT` with no Privy refresh triplet (bridge will start but will 401-spam with ws_open/ws_close churn).
- Missing Pinata creds (creative commands become no-ops, but the bridge itself may still boot).

The Hermit service is allowed to be "lighter" than Keepr primary — it does **not** require `AGENT_RUNTIME_ROLE`, encryption keys, or a dedicated volume. Its only hard requirements are Postgres (for the alfaclub tables the bridge touches) and the AlfaClub auth material.

See `frontend/server/agents/hermit/index.ts` (search for `[hermit][early]`) for the current implementation.