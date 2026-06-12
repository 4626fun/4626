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
- Room `1659` enforces a single active strategy actor. The runner now auto-pauses
  extra active opt-ins (`pause_reason=room1659_single_actor_enforced`) and logs
  `counter_trade.room1659_multiple_active_optins` whenever drift is detected.
  For one-off/manual normalization use:
  `pnpm -C frontend ops:counter-trade:normalize-optins -- --room 1659 --apply`.

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

## Mirrored exits (June 2026)

The loop is no longer entry-only. When the countered user's fill classifies as
`close` or `liquidated` on a pair, the bot submits a **full close**
(`runArenaTrade({ action: 'close', pair })`) of its own position on that pair.

- Gating: `ALFACLUB_COUNTER_TRADE_EXIT_ENABLED` (default **on**). Exits still
  honour the env + DB kill switches and per-fill dedupe, but deliberately
  **bypass** the cooldown, hourly action cap, daily notional cap, and the LLM
  gate — closing risk must never be rate-limited.
- `reduce` fills are intentionally not mirrored: the dgclaw `trade.ts close`
  command has no partial-close, so partial reductions are skipped
  (`fill_action_not_counterable:reduce`) and the bot's position closes in full
  on the user's final exit instead.
- Ledger semantics: successful exits record `status = 'executed'` with
  `reason = 'exit_executed'` and **null notional**, and are excluded from the
  entry cooldown clock and the hourly/daily usage windows. Skips record
  `exit_no_position` / `exit_disabled:<action>` / `exit_already_closed_this_tick`;
  failures record `exit_failed:<arena message>`.
- If the bot holds no position on the pair (and didn't open one earlier in the
  same tick), the exit is a no-op skip — safe for users who close positions
  the bot never countered.

## Harvest accounting (June 2026)

The exit mirror turns chop into realized PnL transfers between the countered
wallet and the bot wallet — every user round trip forces a bot round trip.
`frontend/server/_lib/alfaclub/counterTradeHarvest.ts` makes that channel
observable. Hyperliquid fills are the source of truth (`closedPnl` / `fee`
per fill); there is no local schema for this.

- **Banked line on exit cards.** After a successful mirrored close, the runner
  polls the bot wallet's own fills (up to 3 attempts, ~1.5 s apart) and, when
  the close fill has landed, the room post includes
  `Banked +$12.10 (pnl +$12.40, fees $0.30)`. If the fill hasn't landed yet
  the card posts without the line — the lookup is best-effort and never blocks
  or fails the exit.
- **Structured log.** Every executed exit emits `counter_trade.harvest` with
  `bankedRealizedPnlUsd` / `bankedFeesUsd` / `bankedNetUsd` / `bankedFillCount`
  (nulls when unresolved), so Railway logs carry a per-round-trip harvest
  ledger.
- **Window summary API.** `GET /api/v1/alfaclub/counter-trade-status?harvest=1`
  adds a `harvest` block: 7-day realized PnL, fees, net, gross volume, fill
  count, and round-trip win/loss counts for both the countered wallet and the
  bot wallet, computed live from Hyperliquid fills. Omitting the query param
  skips the extra Hyperliquid calls entirely.

Interpretation: `userWallet.realizedPnlUsd + botWallet.realizedPnlUsd` is the
net drift the bias tilt earned (minus combined fees); the individual legs show
how much got shifted between the wallets, and `grossVolumeUsd` on both legs is
the volume the strategy generated.

## Liquidation defense + profit recycling (June 2026)

Each silo (the bot wallet, and symmetrically the countered wallet if it runs
its own instance) defends itself with its own free USDC — there are **no
cross-wallet transfers**. dgclaw opens everything in cross margin, so every
free dollar in the wallet automatically backs every open leg: the buffer IS
the liquidation defense. `frontend/server/_lib/alfaclub/counterTradeDefense.ts`
runs every tick on the bot wallet's own legs, before user fills are processed:

- **`defend_reduce`** — when a leg's liquidation distance falls to/below
  `ALFACLUB_COUNTER_TRADE_DEFEND_LIQ_DISTANCE_PCT` (default 12%), partially
  close it (reduce-only, `defendReduceFraction` of notional, default 25%).
  This shrinks maintenance margin while equity stays put, pushing the
  liquidation price away and releasing margin back into the silo's buffer.
  Inside half the threshold the fraction doubles (capped at 50%) so fast moves
  get a meaningful response per tick. Dust legs (≤ 2× the minimum order) are
  fully closed instead of leaving an unreducible remainder.
- **`harvest_take_profit`** — when a leg's unrealized PnL reaches
  `ALFACLUB_COUNTER_TRADE_HARVEST_TRIGGER_ROI_PCT` (default 50% of the leg's
  margin), partially realize it (`harvestFraction`, default 25% of notional).
  Paper profit on the winning side becomes banked USDC in the same silo — the
  buffer that will defend this wallet when the market turns and this side
  becomes the loser. Harvest never fully closes a healthy winner; the exit
  mirror owns full closes.
- **Buffer-floor entry gate** — new counter entries are blocked
  (`reason = 'buffer_floor'`) when `withdrawable / accountValue` drops below
  `ALFACLUB_COUNTER_TRADE_MIN_BUFFER_RATIO` (default 20%). Mirrored exits and
  defense actions are risk-reducing and bypass this gate.

Mechanics: partial closes go through the repo-patched dgclaw
`close --size <usd>` (reduce-only; overlay in `frontend/Dockerfile.hermit`).
Ledger rows use `reason = 'defense_reduce_executed'` / `'harvest_tp_executed'`
and — like mirrored exits — never count toward the cooldown clock, hourly
action cap, or daily notional cap. Each action posts a `🛡️ Defense` /
`🌾 Harvest` card with the resulting buffer ratio.

Env knobs (Railway InverseAKITA executor):

- `ALFACLUB_COUNTER_TRADE_DEFENSE_ENABLED` — master switch (default 1).
- `ALFACLUB_COUNTER_TRADE_DEFEND_LIQ_DISTANCE_PCT` — defend trigger (default 12).
- `ALFACLUB_COUNTER_TRADE_DEFEND_REDUCE_FRACTION` — shave per action (default 0.25, capped 0.75).
- `ALFACLUB_COUNTER_TRADE_HARVEST_TRIGGER_ROI_PCT` — harvest trigger vs margin (default 50).
- `ALFACLUB_COUNTER_TRADE_HARVEST_FRACTION` — realize per action (default 0.25, capped 0.75).
- `ALFACLUB_COUNTER_TRADE_MIN_REDUCE_USD` — partial-order floor (default 15; HL min order is $10).
- `ALFACLUB_COUNTER_TRADE_MIN_BUFFER_RATIO` — entry gate floor (default 0.2, capped 0.9).
- `ALFACLUB_COUNTER_TRADE_MAX_DEFENSE_ACTIONS_PER_TICK` — per identity (default 2).

Observability: every action emits `counter_trade.defense` (silo, type, coin,
side, reduce notional, liq distance, ROI, buffer ratio, ok) and failures emit
`counter_trade.defense_execution_failed` — failed actions are recorded as
`status = 'failed'` with `reason = 'defense_reduce_executed_failed:…'` /
`'harvest_tp_executed_failed:…'`.

### User-silo defense (both wallets defended)

The same defend/harvest pass can run on the **countered user's own wallet**,
so both legs of the long/short pair are protected — each silo still uses only
its own free USDC. Signing for the user wallet does not go through ACP:
instead, an **API wallet** (agent key) must be approved for that master
account on Hyperliquid (<https://app.hyperliquid.xyz/API>). API wallets can
place orders only — they can never withdraw or transfer funds.

**Alert-only fallback (custodied accounts).** For room 1659 the countered
wallet is the AlfaClub room portfolio wallet, which AlfaClub custodies — no
API-wallet key exists until AlfaClub grants delegation. With
`ALFACLUB_COUNTER_TRADE_USER_DEFENSE_ENABLED=1` and **no**
`ALFACLUB_COUNTER_TRADE_USER_HL_AGENT_KEY`, the user silo runs in **alert
mode**: the same liquidation-distance / harvest triggers fire, but instead of
placing orders the bot posts an advisory card (`⚠️ Defense alert (user silo)`
/ `🌾 Harvest alert (user silo)`) with the suggested reduce size, so the
position can be trimmed manually through AlfaClub. Alerts dedupe per
(silo, coin, action type) for 30 minutes, are ledgered as `status='skipped'`
with `reason='defense_alert_posted'` / `'harvest_alert_posted'`, and emit
`counter_trade.defense_alert` logs. Setting the agent key later upgrades the
silo to full execution with no code change.

Wiring:

1. Create + approve an API wallet from the user's master account, copy its
   private key.
2. On the Railway InverseAKITA service set:
   - `ALFACLUB_COUNTER_TRADE_USER_DEFENSE_ENABLED=1`
   - `ALFACLUB_COUNTER_TRADE_USER_HL_AGENT_KEY=0x…` (the API-wallet key)
   - `ALFACLUB_COUNTER_TRADE_USER_DEFENSE_MASTER=0x…` (optional; defaults to
     the fill-source wallet whose trades are mirrored)
3. Redeploy. Each tick now also snapshots the user wallet and runs
   defend/harvest on its legs; room posts are tagged `(user silo)`.

Execution path: the runner builds an `ArenaConfig` with `hlAgentPrivateKey` +
`hlMasterAddressOverride`; `arenaClient` exports `HL_AGENT_PRIVATE_KEY` /
`HL_MASTER_ADDRESS` to the dgclaw child, and the patched `trade.ts` signs
locally with viem instead of acp-cli (the Dockerfile installs `viem` into
`/app/dgclaw-skill`). The bot (ACP) lane explicitly clears
`HL_AGENT_PRIVATE_KEY` so an ambient key can never hijack bot signing.

Feedback-loop safety: a user-silo **partial** reduce lands as a `reduce` fill
on the user wallet, which the mirror classifies as non-counterable and
ignores. A dust **full close** lands as `close` and correctly triggers the
exit mirror on the bot's opposite leg next tick — the hedge pair dissolves
together instead of leaving the bot one-sided.

## LLM risk-review gate (optional)

`frontend/server/_lib/alfaclub/counterTradeLlmAdvisor.ts` adds an optional
Eliza-LLM review step between the deterministic decision and execution. The
deterministic engine stays authoritative for every hard cap; the model's power
is strictly one-directional — it can **veto** a candidate counter-trade or
**shrink** its notional (`sizeFactor` in (0, 1]), and can never enlarge size,
raise leverage, flip side, or originate trades.

Context the model sees per candidate: the room wallet's fill (action, side,
pair, price, size, leverage), the deterministically sized counter-trade, the
counter wallet's open positions / account value / liquidation distances, and
the hourly + daily usage against caps.

Env (Railway Hermit executor only — it needs an Eliza LLM provider key such as
`GROQ_API_KEY` or `OPENAI_API_KEY` on that service):

- `ALFACLUB_COUNTER_TRADE_LLM_ENABLED` — master switch (default 0).
- `ALFACLUB_COUNTER_TRADE_LLM_MODE` — `advisory` (default; decisions are
  logged as `counter_trade.llm_advice` but never change execution) or `gate`
  (veto/downsize applied).
- `ALFACLUB_COUNTER_TRADE_LLM_FAIL_MODE` — `allow` (default; deterministic
  trade proceeds when the LLM errors/times out/returns garbage) or `block`.
- `ALFACLUB_COUNTER_TRADE_LLM_TIMEOUT_MS` — per-decision budget (default 12000).
- `ALFACLUB_COUNTER_TRADE_LLM_MIN_SIZE_FACTOR` — execute verdicts below this
  floor are treated as a veto instead of placing dust trades (default 0.2).

Ledger semantics: gate-mode vetoes are recorded as `status = 'skipped'` with
`reason = 'llm_veto:<model reason>'` (or `llm_downsize_below_floor:<factor>` /
`llm_unavailable:<cause>` under fail-block). Downsized executions record the
reduced notional.

Rollout: enable with `mode=advisory` first and review the
`counter_trade.llm_advice` log stream against actual outcomes for a few days;
flip to `gate` only once the veto quality looks right. Keep `failMode=allow`
unless you explicitly prefer missing trades over trading without review.

## Prerequisites

- Production deploy from `main` is healthy and the Railway Hermit service is green.
- `CRON_SECRET` is configured in production Vercel env (manual trigger only).
- Hyperliquid/Arena execution lane used by `runArenaTrade(...)` is already validated **on the Railway Hermit service** (see `docs/operations/virtuals-arena-railway-runbook.md`): `ARENA_ENABLED=1`, `ARENA_TRADING_ENABLED=1`, `ARENA_DRY_RUN` per rollout phase, `ARENA_DGCLAW_DIR=/app/dgclaw-skill`.
- Counter-trade env block is configured **on the Railway Hermit service** (see `frontend/.env.example` `ALFACLUB_COUNTER_TRADE_*` section), including `ALFACLUB_COUNTER_TRADE_RUNNER_ENABLED=1`.
- Railway Hermit has DB access (`DATABASE_URL`) — already required by the chat bridge.

## Environment baseline (production-safe defaults)

Use these as launch defaults unless explicit risk approval says otherwise:

- `ALFACLUB_COUNTER_TRADE_ENABLED=0`
- `ALFACLUB_COUNTER_TRADE_EXIT_ENABLED=1`
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
- `ALFACLUB_COUNTER_TRADE_DEFENSE_ENABLED=1`
- `ALFACLUB_COUNTER_TRADE_DEFEND_LIQ_DISTANCE_PCT=12`
- `ALFACLUB_COUNTER_TRADE_DEFEND_REDUCE_FRACTION=0.25`
- `ALFACLUB_COUNTER_TRADE_HARVEST_TRIGGER_ROI_PCT=50`
- `ALFACLUB_COUNTER_TRADE_HARVEST_FRACTION=0.25`
- `ALFACLUB_COUNTER_TRADE_MIN_REDUCE_USD=15`
- `ALFACLUB_COUNTER_TRADE_MIN_BUFFER_RATIO=0.2`
- `ALFACLUB_COUNTER_TRADE_MAX_DEFENSE_ACTIONS_PER_TICK=2`

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

