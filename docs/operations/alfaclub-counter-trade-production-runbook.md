# AlfaClub Counter-Trade Production Runbook

This runbook covers production launch and steady-state operations for the AlfaClub counter-trade engine:

- Runtime loop: `frontend/server/_lib/alfaclub/counterTradeRunner.ts`
- Runtime config: `frontend/server/_lib/alfaclub/counterTradeConfig.ts`
- **Executor: Railway Hermit in-process ticker** (`frontend/server/_lib/alfaclub/counterTradeTicker.ts`, started from `frontend/server/agents/hermit/index.ts`)
- Manual ops trigger: `GET|POST /api/v1/alfaclub/counter-trade-run` (cron-secret gated; **not scheduled** — see below)
- User status endpoint: `GET /api/v1/alfaclub/counter-trade-status`
- Persistence: `alfaclub.counter_trade_*` tables from migration `20260709000000_alfaclub_counter_trade_engine.sql`

## Executor placement (read this first)

The execution lane (`runArenaTrade`) shells out to the dgclaw-skill CLI
(`npx ts-node scripts/trade.ts ...`) inside `ARENA_DGCLAW_DIR`
(`/app/dgclaw-skill`). That directory only exists in the **Railway Hermit
container** (`frontend/Dockerfile.hermit` clones it). Vercel serverless can
detect fills and derive decisions but can never execute — the original Vercel
cron produced only `failed` ledger rows. Therefore:

- The **Railway Hermit service is the single executor.** Set
  `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=1` (plus the engine env block and
  validated `ARENA_*` env per `virtuals-arena-railway-runbook.md`) on that
  service only.
- Tick cadence: `ALFACLUB_COUNTER_TRADE_RUNNER_INTERVAL_MS` (default 120000,
  floor 30000). Ticker state is visible on the Hermit `/healthz` payload
  (`counterTrade` field).
- The Vercel cron entry was removed from `frontend/vercel.json`. Do not
  re-add it. Keep `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED` unset/0 on Vercel
  and on any local/standby Hermit so only one executor runs.
- The `/api/v1/alfaclub/counter-trade-run` endpoint remains for manual
  smoke/ops invocation with the cron secret, but live execution from Vercel
  will fail by construction (no dgclaw CLI).

## Operating model

- Engine is gated by env: `ALFACLUB_COUNTER_TRADE_ENABLED`.
- Executor loop is gated by env: `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED`
  (Railway Hermit only).
- Engine is also gated by room strategy row:
  - `enabled = true`
  - `kill_switch = false`
- User execution is gated by per-user opt-in state:
  - only `state = 'active'` is processed
- Room control and user controls are command-driven:
  - `/strategy bias <bullish|bearish|neutral>` (trusted operator)
  - `/strategy optin <defensive|balanced|aggressive>`
  - `/strategy pause`
  - `/strategy resume`
  - `/strategy status`

Important: there is currently no explicit dry-run flag for this engine. "Shadow mode" is achieved by keeping all users un-opted (`state != 'active'`).

## Prerequisites

- Production deploy from `main` is healthy and the Railway Hermit service is green.
- `CRON_SECRET` is configured in production Vercel env (manual trigger only).
- Hyperliquid/Arena execution lane used by `runArenaTrade(...)` is already validated **on the Railway Hermit service** (see `docs/operations/virtuals-arena-railway-runbook.md`): `ARENA_ENABLED=1`, `ARENA_TRADING_ENABLED=1`, `ARENA_DRY_RUN` per rollout phase, `ARENA_DGCLAW_DIR=/app/dgclaw-skill`.
- Counter-trade env block is configured **on the Railway Hermit service** (see `frontend/.env.example` `ALFACLUB_COUNTER_TRADE_*` section), including `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=1`.
- Railway Hermit has DB access (`DATABASE_URL`) — already required by the chat bridge.

## Environment baseline (production-safe defaults)

Use these as launch defaults unless explicit risk approval says otherwise:

- `ALFACLUB_COUNTER_TRADE_ENABLED=0`
- `ALFACLUB_COUNTER_TRADE_ROOM_ID=1659`
- `ALFACLUB_COUNTER_TRADE_MIN_USER_NOTIONAL_USD=25`
- `ALFACLUB_COUNTER_TRADE_COOLDOWN_MS=120000`
- `ALFACLUB_COUNTER_TRADE_HOURLY_ACTION_CAP=12`
- `ALFACLUB_COUNTER_TRADE_DAILY_NOTIONAL_CAP_USD=7500`
- `ALFACLUB_COUNTER_TRADE_MAX_PER_TRADE_USD=750`
- `ALFACLUB_COUNTER_TRADE_GLOBAL_MAX_LEVERAGE=12`
- `ALFACLUB_COUNTER_TRADE_FAVORED_MULTIPLIER=1.35`
- `ALFACLUB_COUNTER_TRADE_NEUTRAL_MULTIPLIER=1.0`
- `ALFACLUB_COUNTER_TRADE_UNFAVORED_MULTIPLIER=0.75`
- `ALFACLUB_COUNTER_TRADE_FAVORED_NOTIONAL_RATIO=0.60`
- `ALFACLUB_COUNTER_TRADE_NEUTRAL_NOTIONAL_RATIO=0.45`
- `ALFACLUB_COUNTER_TRADE_UNFAVORED_NOTIONAL_RATIO=0.30`
- `ALFACLUB_COUNTER_TRADE_NEUTRAL_BIAS_LEVERAGE_CAP=8`
- `ALFACLUB_COUNTER_TRADE_FAVORED_BIAS_LEVERAGE_CAP=10`
- `ALFACLUB_COUNTER_TRADE_UNFAVORED_BIAS_LEVERAGE_CAP=6`
- `ALFACLUB_COUNTER_TRADE_LIQUIDATION_MIN_DISTANCE_PCT=8`
- `ALFACLUB_COUNTER_TRADE_EVENT_LOOKBACK_MS=2700000`
- `ALFACLUB_COUNTER_TRADE_RUN_LIMIT_PER_IDENTITY=20`

## Preflight checks

Quick path (recommended):

```bash
CRON_SECRET=... ./scripts/ops/counter-trade-smoke.sh --expect-disabled
```

### 1) Schema presence

Run in Supabase SQL editor:

```sql
select
  to_regclass('alfaclub.counter_trade_room_strategy') as room_strategy,
  to_regclass('alfaclub.counter_trade_user_opt_in') as user_opt_in,
  to_regclass('alfaclub.counter_trade_event_ledger') as event_ledger,
  to_regclass('alfaclub.counter_trade_action_ledger') as action_ledger;
```

All four must be non-null.

### 2) Room strategy row

```sql
select room_id, enabled, kill_switch, global_bias, updated_at
from alfaclub.counter_trade_room_strategy
where room_id = '1659';
```

If missing, it will be auto-created by first run/status read.

### 3) Endpoint authorization check

Expect `401` without cron secret:

```bash
curl -i "https://app.4626.fun/api/v1/alfaclub/counter-trade-run"
```

Expect success/accepted with cron secret:

```bash
curl -sS -X POST "https://app.4626.fun/api/v1/alfaclub/counter-trade-run" \
  -H "x-cron-secret: $CRON_SECRET"
```

## Rollout plan

### Phase 0: Disabled deploy (safe install)

1. On Railway Hermit set `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=1` but `ALFACLUB_COUNTER_TRADE_ENABLED=0`.
2. Redeploy the Hermit service.
3. Verify Hermit `/healthz` shows `counterTradeTickerStarted: true` and ticks with `reason: "disabled"`.
4. Confirm no new `executed` rows appear in action ledger.

### Phase 1: Shadow mode (no execution cohort)

1. On Railway Hermit set `ALFACLUB_COUNTER_TRADE_ENABLED=1`.
2. Keep all users un-opted (no active opt-in rows).
3. Confirm ticker runs (`/healthz` `counterTrade.lastResult`) with `ok: true` and `scannedIdentities: 0`.
4. Verify user status endpoint works in UI (`/strategy status` or status card).

### Phase 2: Canary execution

1. Select a small canary set (3-10 users).
2. Canary users run `/strategy optin defensive`.
3. Set room bias with trusted operator: `/strategy bias neutral` (or approved bias).
4. Monitor 24-72h before expansion.

Canary guardrails:

- Keep default caps (or lower).
- Do not use `aggressive` during initial canary.
- Keep strict operator presence for rapid pause.

### Phase 3: Controlled expansion

1. Increase opt-in cohort gradually.
2. Allow `balanced` preset after canary stability.
3. Tune caps only one variable at a time.
4. Keep live monitoring and daily review of block/fail reasons.

## Production verification queries

### Recent action distribution

```sql
select status, count(*) as n
from alfaclub.counter_trade_action_ledger
where created_at >= now() - interval '1 hour'
group by status
order by n desc;
```

### Top block/skip/fail reasons

```sql
select status, reason, count(*) as n
from alfaclub.counter_trade_action_ledger
where created_at >= now() - interval '24 hours'
group by status, reason
order by n desc
limit 25;
```

### Executed notional by user (24h)

```sql
select sender_address,
       count(*) filter (where status = 'executed') as executed_count,
       coalesce(sum(counter_notional_usd) filter (where status = 'executed'), 0) as executed_notional_usd
from alfaclub.counter_trade_action_ledger
where room_id = '1659'
  and created_at >= now() - interval '24 hours'
group by sender_address
order by executed_notional_usd desc;
```

### Active opt-ins

```sql
select preset, count(*) as n
from alfaclub.counter_trade_user_opt_in
where room_id = '1659'
  and state = 'active'
group by preset
order by n desc;
```

## Incident response

### Immediate freeze (preferred)

Trusted operator in-room:

- `/strategy pause` for affected user(s)
- `/strategy bias neutral` to de-risk directionality

### Immediate global stop (hard stop)

1. Set `ALFACLUB_COUNTER_TRADE_ENABLED=0` (or `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=0`) on the Railway Hermit service.
2. Redeploy the Hermit service (Railway auto-deploys on variable change).
3. Optionally force DB kill switch:

```sql
update alfaclub.counter_trade_room_strategy
set kill_switch = true, enabled = false, updated_at = now()
where room_id = '1659';
```

### Pause all users (if needed)

```sql
update alfaclub.counter_trade_user_opt_in
set state = 'paused',
    pause_reason = 'ops_global_pause',
    paused_at = now(),
    updated_at = now()
where room_id = '1659'
  and state = 'active';
```

## Go/No-Go checklist

- Schema tables exist and are queryable.
- Cron endpoint auth works (`401` without secret, success with secret).
- Phase 0 shows `reason=disabled`.
- Phase 1 shows zero execution with no active opt-ins.
- Canary shows stable execution with no unexplained failures.
- Kill switch path tested (env disable and DB stop).
- Operator on-call knows command and SQL emergency procedures.

If any item is unresolved, remain in current phase and do not expand cohort.

