# Railway Keepr Primary — Environment Checklist

Use this when setting up or debugging the primary XMTP agent on Railway.

## Required (will cause hard `process.exit(1)` if missing/wrong)

- [ ] `AGENT_RUNTIME_ROLE=primary` (or left unset — default is primary)
- [ ] `AGENT_CONSUME_XMTP=true` (or left unset when role is primary)
- [ ] `DATABASE_URL` or `POSTGRES_URL` (Supabase pooler strongly recommended)
- [ ] `XMTP_AGENT_KEY_ENCRYPTION_KEY` (32-byte hex) — required for multi-agent mode
- [ ] `XMTP_DB_DIRECTORY` points to a **mounted Railway Volume** (not `/tmp` or ephemeral storage)
- [ ] If using CSW identity for the agent (recommended):
  - [ ] `XMTP_AGENT_CSW_ADDRESS`
  - [ ] `XMTP_AGENT_PRIVY_WALLET_ID`
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