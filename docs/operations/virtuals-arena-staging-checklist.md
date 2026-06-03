# Virtuals Arena Staging Checklist

Use this exact sequence before enabling live Arena trading from room `1659`.

## 0) Baseline env

- `ARENA_ENABLED=1`
- `ARENA_TRADING_ENABLED=0`
- `ARENA_DRY_RUN=1`
- `ARENA_DGCLAW_DIR` points to the runtime directory containing `dgclaw.sh` and scripts.

## 1) Read-only readiness

- Run: `/arena status`
  - Expect: lane configured, dry-run state visible.
- Run: `/arena assets`
  - Expect: supported asset list returns.

## 2) Setup flow (dry-run)

- (Optional programmatic) Run: `/arena register <id> <wallet>` (after you create via web connected as your Alfa, or use no-args `/arena register` which creates under the bot ACP session) — binds your sender + runs the below in one shot.
- Run: `/arena join`
- Run: `/arena activate`
- Run: `/arena add-api-wallet`

Expected: commands return success with `[dry-run]`.

## 3) Validation guards

- Run: `/arena trade open foo:bar long 1000 2`
  - Expect rejection with `xyz:` guidance.
- Run from a non-allowlisted room (on Railway: go to the alfaclub-bridge/hermit service Variables, add HERMIT_OWNER_ADDRESS=0x64c3... or HERMIT_ALLOWED_USERS, redeploy the service):
  - Expect `only enabled in approved rooms`.

## 4) Controlled trading rehearsal

Temporarily set:

- `ARENA_TRADING_ENABLED=1`
- keep `ARENA_DRY_RUN=1`

Then run:

- `/arena register` (or with ids) for bind+onboard rehearsal (see runbook; /arena gated — use HERMIT_OWNER_ADDRESS or ALLOWED_USERS + restart for your Alfa 0x64c3... in 1659)
- `/arena deposit 100`
- `/arena trade open xyz:GOLD long 5000 2`
- `/arena trade close xyz:GOLD`

Expected: success + `[dry-run]`.

## 5) Live smoke

Change:

- `ARENA_DRY_RUN=0`

Execute smallest acceptable notional:

- `/arena deposit <small>`
- `/arena trade open <small>`
- `/arena trade close <pair>`

Confirm:

- command responses indicate success
- `[arena.audit]` logs present for each action
- no policy validation bypasses

## 6) Rollback switch

If any anomaly:

- set `ARENA_TRADING_ENABLED=0` immediately
- optionally set `ARENA_ENABLED=0`
