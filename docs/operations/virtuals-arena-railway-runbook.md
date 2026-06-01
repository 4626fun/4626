# Virtuals Arena Runbook (Railway-First)

This runbook covers the 4626 `Arena` control lane exposed through Hermit command rooms (default: room `1659`) and backed by `frontend/server/_lib/arena/*`.

## Scope

- Railway-first operations for:
  - Arena onboarding (`join`)
  - unified account activation
  - API wallet setup
  - Base USDC deposit
  - Hyperliquid/Arena trade commands
- Safety defaults:
  - `ARENA_ENABLED=0` unless intentionally turned on
  - `ARENA_TRADING_ENABLED=0` unless execution is approved
  - `ARENA_DRY_RUN=1` by default

## Prerequisites

- Existing Virtuals agent created (non-custodial Base wallet).
- `dgclaw-skill` (or equivalent scripts) available on the Railway runtime host.
- Env configured in `frontend/.env.example` Arena section:
  - `ARENA_ENABLED`
  - `ARENA_TRADING_ENABLED`
  - `ARENA_DRY_RUN`
  - `ARENA_DGCLAW_DIR`
  - optional `ARENA_ALLOWED_ROOM_IDS`
  - optional `ARENA_ASSET_ALLOWLIST`

## Migration (Legacy Agent -> V2 wallet)

If agent is still on legacy wallet:

1. Open `app.virtuals.io/acp/agents` and link a new agent wallet to the same Agent ID.
2. Open `degen.virtuals.io/dashboard` and use **Migrate** on the agent.
3. Confirm balances moved to the new wallet before re-enabling trading.

## Command Surface (from room 1659)

- `/arena status`
- `/arena assets`
- `/arena join`
- `/arena activate`
- `/arena add-api-wallet`
- `/arena deposit <usdc>`
- `/arena trade open <pair> <long|short> <sizeUsd> <leverage>`
- `/arena trade close <pair>`

## HIP-3 Pair Policy

Enforced in code (`arenaPairPolicy.ts`):

- Crypto perps: plain symbol (`BTC`, `ETH`, `SOL`)
- HIP-3 assets: must use `xyz:` prefix (`xyz:GOLD`, `xyz:NVDA`)
- Any colon pair not starting with `xyz:` is rejected

Policy rationale aligns with Arena council recognition filter.

## Rollout Sequence

1. Enable read-only lane:
   - `ARENA_ENABLED=1`
   - `ARENA_TRADING_ENABLED=0`
   - `ARENA_DRY_RUN=1`
2. Validate command + room gating:
   - `1659` accepts `/arena status`
   - non-allowed room rejects `/arena ...`
3. Dry-run setup:
   - `/arena join`
   - `/arena activate`
   - `/arena add-api-wallet`
   - `/arena deposit 100`
   - `/arena trade open xyz:GOLD long 5000 2`
4. Controlled execute window:
   - `ARENA_TRADING_ENABLED=1`
   - keep `ARENA_DRY_RUN=1` for one pass
5. Live execution:
   - set `ARENA_DRY_RUN=0`
   - run minimal-size deposit + one minimal-size trade

## Incident Playbook

### Pair rejected

- Symptom: command replies with `xyz: prefix` guidance.
- Action: rewrite pair with `xyz:` prefix for HIP-3 assets.

### Trading disabled

- Symptom: command replies with `ARENA_TRADING_ENABLED`.
- Action: confirm change window approval, then set `ARENA_TRADING_ENABLED=1`.

### Command path misconfigured

- Symptom: status passes but join/deposit/trade fails with command/file errors.
- Action:
  - verify `ARENA_DGCLAW_DIR`
  - verify `ARENA_DGCLAW_BIN`
  - verify scripts exist (`scripts/deposit.ts`, `scripts/trade.ts`)

### API wallet/setup drift

- Symptom: trade failures after successful command dispatch.
- Action:
  - rerun `/arena add-api-wallet`
  - confirm API key in runtime env used by scripts
  - rerun `/arena status` + dry-run trade first

### Risk stop

- Immediate freeze:
  - set `ARENA_TRADING_ENABLED=0` OR
  - set `ARENA_ENABLED=0`

## Audit Expectations

Arena actions emit structured logs (`[arena.audit] ...`) including:

- event type (`join`, `activate_unified_account`, `deposit`, `trade_open`, `trade_close`)
- dry-run state
- key trade metadata (pair/side/size/leverage)

Use these logs as the source of truth for post-mortems.
