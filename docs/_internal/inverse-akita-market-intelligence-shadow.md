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
- Existing tests established a green pre-change baseline of 53 tests across
  the engine, sizing, risk, ACP backtest/signal handler, and service cleanup.

## Capability map

| Product capability | Current state | This slice |
| --- | --- | --- |
| Counter-trade execution | Implemented | Unchanged |
| Position sizing and risk | Implemented | Unchanged |
| Historical backtesting | Implemented | Unchanged |
| ACP backtest/signal delivery | Implemented | Unchanged |
| Current funding/OI ingestion | Data existed in another reader | Added a small reusable read-only accessor |
| Deterministic funding/OI regime | Missing | Added as pure classifier |
| ACP funding/OI delivery | Missing | Added unpublished dedicated handler/schema |
| Historical OI/funding changes | Missing | Deferred; current snapshot cannot infer deltas |
| Liquidation map/order-book flow | Missing | Deferred pending validated data sources |
| Live decision integration | Intentionally absent | Prohibited during shadow validation |

## Shadow invariant

`fundingOiRegimeShadow` is advisory only. Its classifier and handler function
do not call the counter-trade runner, entry, sizing, leverage, or execution
paths (the ACP routing module also hosts unrelated backtest/signal handlers).
Output does not emit `COUNTER`, `DELAY`, or `SKIP`, and cannot alter a live
decision.

The current classifier uses funding, 24-hour price change, and the ratio of
current open-interest notional to 24-hour volume. This ratio is a deterministic
crowding proxy, not a historical OI-change claim. Missing fields fail closed as
`insufficient-data`.

## Rollout gates

1. Keep the offering unpublished while collecting shadow observations.
2. Persist timestamped inputs, regime, confidence, and subsequent price
   outcomes before evaluating predictive usefulness. Each observation records
   source provider (`hyperliquid-meta-and-asset-ctxs`), classifier version
   (`funding-oi-regime-v1`), data quality, and explicit missing fields. Inserts
   are idempotent on a stable provider/job key and create fixed 1h, 4h, and 24h
   outcome horizons only when the observation has a valid starting price. Due
   outcomes are settled from timestamped historical one-minute candles at the
   target horizon (with the actual candle timestamp retained), not a later
   request-time mark-price fetch;
   concurrent workers use a conditional update so only one records settlement.
3. Add historical funding/OI series and replay tests before claiming trend or
   OI expansion/contraction.
4. Require a separately reviewed production change before any regime signal
   can affect execution, sizing, leverage, or live decision vocabulary.
5. Publish only after deterministic handler/schema tests and a real ACP
   purchase-to-`session.submit(...)` canary succeed.

The observation and outcome writes are best-effort telemetry. Storage or price
read failures do not change the classifier output and cannot affect live
counter-trading. The ACP offering remains unpublished during this validation.
