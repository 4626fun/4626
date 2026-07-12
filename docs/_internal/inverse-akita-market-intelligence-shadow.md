# InverseAKITA market-intelligence shadow slice

## Baseline inventory

- Live execution remains owned by the existing counter-trade engine, runner,
  risk, sizing, rebalance, defense, entry, adjust, and exit modules.
- Deterministic 7/30/90-day backtests and the existing `counterTradeSignal`
  ACP offering already have offering-name routing, payment gates, and
  `session.submit(...)` delivery.
- Hyperliquid already supplies candles, market metadata, account state, fills,
  and current `metaAndAssetCtxs` fields. No new external provider is required
  for the first funding/open-interest slice.
- Continuous `alfaclub.market_feature_snapshots` sampling now exists via
  `/api/v1/alfaclub/market-feature-sampler` (cron every 5 minutes).
- Decision ledger + outcomes exist for flagship COUNTER/DELAY/SKIP (`shadow_only`).

## Capability map

| Product capability | Current state | Notes |
| --- | --- | --- |
| Counter-trade execution | Implemented | Unchanged; intel must not import runners |
| Position sizing and risk | Implemented | Live path unchanged; advisory sizing is separate |
| Historical backtesting | Implemented | Unchanged |
| ACP backtest/signal delivery | Implemented | Unchanged |
| Continuous funding/OI snapshots | Implemented | `market_feature_snapshots` + sampler cron |
| Fine regime taxonomy | Implemented | `regime_fine` + `regime_coarse` dual labels |
| ACP `fundingOiRegime` / shadow | Implemented | Hidden canary; Virtuals visibility is operator-owned |
| ACP `counterTradeAnalysis` | Implemented | Hidden; writes decision ledger |
| ACP crowding / audit / hedge | Implemented | Hidden; launch order 3→4→5 |
| Order flow / liquidations / validated basis | Missing | Stay `null` in `missing_fields` |
| Live decision integration | Intentionally absent | Stage D only after separate review |

## Shadow invariant

Intelligence modules under `marketState/`, `regimes/`, `decisions/`, `audits/`,
`portfolio/`, and `intelJobs.ts` are advisory only. They do not import
`counterTradeRunner`, entry/exit/adjust flows, or the live decision engine.

Kill switch: `INV_AKITA_INTEL_KILL=1` forces structured SKIP/insufficient
responses for paid intel handlers. Execution remains unaffected.

`fundingOiRegimeShadow` may still emit coarse prose without COUNTER/DELAY/SKIP.
Canonical `fundingOiRegime` and `counterTradeAnalysis` use the public fine
taxonomy / DecisionRecord schema and remain `shadow_only: true`.

Missing features stay `null` and are listed explicitly. Never impute. Never
claim OI expansion/contraction without stored snapshot history.

## Sampler + settlement operations

| Surface | Path / command | Cadence |
| --- | --- | --- |
| Feature sampler cron | `/api/v1/alfaclub/market-feature-sampler` | `*/5 * * * *` |
| Outcome settle cron | `/api/v1/alfaclub/decision-outcome-settle` | `*/5 * * * *` |
| Settled ledger export | `/api/v1/alfaclub/decision-ledger-export` | `15 12 * * *` (read-only JSONL + claim-gate report) |
| Auth | `CRON_SECRET` via `x-cron-secret` or Bearer | fail-closed |
| Retention | prune snapshots older than 45 days | on sampler tick |

Settlement uses point-in-time 1m candles (`readMarkPriceAt`). No current-price
fallback. Concurrent workers use conditional updates.

Export is privacy-safe (`source_id` hashed); it never includes buyer/job private
payloads. Public “edge” language remains gated on `claimAllowed` from
`evaluateConditionalInverseEdge`.

## Virtuals offering machine names (exact)

Operator registration / price / visibility live on Virtuals, not in-repo:

1. `fundingOiRegime` (promote from `fundingOiRegimeShadow` after warm history)
2. `counterTradeAnalysis` (flagship; keep hidden through Stage A purchase canary)
3. `crowdingSnapshot`
4. `sourceStrategyAudit`
5. `portfolioHedgeRecommendation`

Keep existing public `counterTradeSignal` and free Hermit `/signal` unchanged.

## Rollout gates

1. Keep new intel offerings unpublished while collecting ledger samples.
2. Sampler warm-up must exist before claiming ΔF/ΔOI or joint price×OI cells.
3. Publish `fundingOiRegime` only after fixture tests + real funded
   purchase→`session.submit(...)` canary on the canonical name.
4. Publish `counterTradeAnalysis` only after decision ledger settle path is live.
5. Public “edge” language only when walk-forward Conditional Inverse Edge CI
   excludes 0 at configured minimum n (`exportSettledDecisionsJsonl` /
   `evaluateConditionalInverseEdge`).
6. Require a separately reviewed Stage D ticket before any intel decision can
   affect execution, sizing, leverage, or live runner behavior.

## ACP status / heartbeat metrics

Railway Virtuals ACP `getStatus()` / runner heartbeat now includes:

- per-offering `success`, `failure`, `submitFailures`
- SKIP rate (`skipCount / (success + failure)`)
- avg / last latency and last `dataAgeMs`
- `settlementLagMs` / `lastSettlementAt` when recorded in-process

Kill switch (`INV_AKITA_INTEL_KILL=1`) returns structured SKIP/insufficient
without touching the live execution engine.

## Methodology versions

| Module | Version |
| --- | --- |
| Feature snapshots | `market-feature-snapshot-v1.0.0` |
| Fine regime | `inv-akita-regime-v1.0.0` |
| Decision engine | `inv-akita-decision-v1.0.0` |
| Edge prior | `inv-akita-edge-prior-v1.0.0-unvalidated` |
| Crowding snapshot | `crowding-snapshot-v1.0.0` |
| Source audit | `source-audit-v1` |
| Portfolio hedge | `portfolio-hedge-v1.0.0` |

## Rollback

- Disable crons or set `INV_AKITA_INTEL_KILL=1` to fail closed on intel ACP.
- Hide/unpublish offerings in Virtuals UI.
- Do not drop ledger tables without an explicit migration; shadow data is
  evidence for validation.
