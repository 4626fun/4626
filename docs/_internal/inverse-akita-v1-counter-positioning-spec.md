# InverseAKITA v1 — Selective Counter-Positioning Spec

Status: design draft for engineering implementation  
Date: 2026-07-12  
Agent: InverseAKITA (Virtuals 82414 / $ATIKA)  
Scope: falsifiable, auditable COUNTER / DELAY / SKIP engine + five ACP offerings  
Non-scope: live execution wiring of intelligence decisions (separate Stage D review)

---

## 0. Product thesis (concise)

InverseAKITA is not a price-prediction oracle. It is a **selective counter-positioning engine** that evaluates whether a *source trade* (AlfaClub room / wallet / agent) is entering a structure where the opposite side is justified.

v1 sells **timestamped market analysis** on Virtuals ACP before trading PnL is meaningful. The intelligence layer is successful only if:

```
Conditional Inverse Edge
  = E[R | selective COUNTER]
  − E[R | always-inverse]
```

is positive after fees, funding, slippage, latency, and failed fills — out of sample.

**Always opposite is the baseline product. Selectivity is the product upgrade.**

---

## 1. Current inventory (do not redesign what exists)

| Capability | State | Path |
| --- | --- | --- |
| Live counter-trade execution | Implemented | `frontend/server/_lib/alfaclub/counterTrade*.ts` |
| Risk / sizing / rebalance / defense | Implemented | same tree |
| 7/30/90d backtests + ACP | Implemented | `virtuals/backtestJobs.ts`, public offerings |
| `counterTradeSignal` ($0.10) | Public, price-path only | 7d backtest → long/short/neutral |
| `fundingOiRegimeShadow` ($0.10) | Hidden canary, Stage A done (job 67942) | snapshot funding + OI/vol proxy |
| Hermit `/signal` | Room multi-factor composite | counter 7d + Funding/OI → LONG/SHORT/STAY OUT |
| Shadow observation store | Implemented | `alfaclub.funding_oi_shadow_observation` + 1h/4h/24h settle |
| Historical funding / OI series | **Implemented** | `alfaclub.market_feature_snapshots` + 5m sampler cron |
| Basis / order flow / liquidations | **Missing** | cannot claim OF_t, L_t, B_t yet; stay `null` |
| COUNTER/DELAY/SKIP public ledger | **Implemented** | `alfaclub.decision_ledger` + outcomes; JSONL export gated |
| Live decision integration | **Forbidden** until Stage D | shadow invariant |

---

## 2. v1 product specification

### 2.1 Decision object (canonical)

Every paid flagship decision must be a **DecisionRecord**:

```json
{
  "decision_id": "uuid",
  "schema_version": "counter-decision-v1",
  "methodology_version": "inv-akita-decision-v1.0.0",
  "observed_at": "2026-07-12T08:31:00.000Z",
  "data_as_of": "2026-07-12T08:30:55.000Z",
  "venue": "hyperliquid",
  "asset": "HYPE",
  "source": {
    "id": "alfaclub_room_1659",
    "side": "LONG",
    "entry_price": 38.42,
    "notional_usd": 5000,
    "leverage": 5,
    "source_timestamp": "2026-07-12T08:30:00.000Z"
  },
  "decision": "COUNTER",
  "counter_side": "SHORT",
  "confidence": 0.78,
  "regime": "crowded_long_exhaustion",
  "market_state_vector": {
    "r_t": 0.012,
    "dr_t": -0.004,
    "F_t": 0.00021,
    "dF_t": null,
    "OI_t": 42000000,
    "dOI_t": null,
    "V_t": 180000000,
    "dV_t": null,
    "B_t": null,
    "dB_t": null,
    "OF_t": null,
    "L_t": null,
    "missing": ["dF_t", "dOI_t", "dV_t", "B_t", "dB_t", "OF_t", "L_t"],
    "proxies": {
      "oi_to_volume_24h": 0.23,
      "price_change_4h_pct": 2.1,
      "price_change_24h_pct": 4.7
    }
  },
  "supporting_evidence": ["..."],
  "contradicting_evidence": ["..."],
  "invalidation": {
    "price": 39.15,
    "conditions": ["price and OI rise while funding stays elevated"]
  },
  "suggested_risk_pct": 0.04,
  "suggested_notional_usd": 200,
  "expected_holding_period_hours": 8,
  "estimated_cost_bps": 9,
  "valid_for_minutes": 45,
  "evaluation_horizons_hours": [1, 4, 8, 24],
  "outcome": null,
  "shadow_only": true,
  "disclaimer": "Advisory only. Not investment advice. Does not execute trades."
}
```

### 2.2 Decision vocabulary (flagship only)

| Decision | Meaning | When |
| --- | --- | --- |
| **COUNTER** | Evidence supports taking the opposite side of the source | Regime is exhaustion / crowded fade **and** confidence ≥ threshold **and** cost budget ok |
| **DELAY** | Source may be initially correct; crowding/exhaustion developing | Trend + OI expansion aligned with source; funding rising; wait for exhaustion features |
| **SKIP** | Evidence does not justify an inverse trade | Ambiguous, missing data, conflict, liquidation cascade risk, or no edge after costs |

Hermit chat may continue using LONG/SHORT/STAY OUT for room UX. ACP flagship uses COUNTER/DELAY/SKIP relative to a **source trade**. Never mix vocabularies in the same deliverable schema.

### 2.3 What v1 claims vs cannot claim

| Claim | v1 allowed? | Gate |
| --- | --- | --- |
| Deterministic classification from available HL fields | Yes | Unit tests + fixtures |
| Timestamped, auditable decision ledger | Yes | Schema + public export |
| Snapshot crowding proxy (OI/vol, funding percentile vs rolling window once stored) | Yes | Document as proxy |
| ΔOI / ΔF / order flow / liquidations as true features | **No until ingested** | Data pipeline gate |
| Predictive edge over always-inverse | **No until OOS ledger** | Validation protocol §10 |
| “Proven Sharpe from README-style research repos” | **Never** | Epistemic policy |

### 2.4 Architecture

```
                    ┌─────────────────────────────┐
  Hyperliquid API ──┤ Data Ingestion (read-only)  │
  AlfaClub fills  ──┤  candles, metaAndAssetCtxs  │
  Room source txs ──┤  fills, clearinghouse       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Feature Engineering         │
                    │  returns, funding z, OI/vol │
                    │  MAD-z when history exists  │
                    │  fail-closed missing fields │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Regime Classifier (pure)    │
                    │  price×OI joint table       │
                    │  funding stage              │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │ Decision Engine (pure)      │
                    │  COUNTER | DELAY | SKIP     │
                    │  confidence, invalidation   │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   Position sizing           Public ledger            ACP handlers
   (advisory only)           + outcome settle         (submit mandatory)
          │
          ▼
   Live execution  ── FORBIDDEN until Stage D review
   (counterTradeRunner remains independent)
```

**LLM role:** parse messy buyer requests, explain structured output, format human prose.  
**LLM ban:** invent measurements, override risk limits, change decision when quant says SKIP.

### 2.5 Technology stack (repo-native)

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node/TS (existing Eliza Virtuals plugin) | Already online for ACP |
| Market data | Hyperliquid info API via `hyperliquid.ts` | Production path exists |
| Storage | Postgres (`alfaclub.*`) + schemaBootstrap + migrations | Observation pattern proven |
| ACP | `@virtuals-protocol/acp-node-v2` + `acp` CLI | Live jobs/canary proven |
| Compute | Deterministic pure TS modules + Vitest | No ML training in v1 |
| Chat surface | Hermit `/signal` composite (advisory) | Product preference |
| Execution | Existing counter-trade engine (orthogonal) | Isolation invariant |

---

## 3. Five ACP offerings (definition table)

| # | Offering name (machine) | Buyer | Problem | Price (v1) | SLA | Funds | Visibility launch | Depends on |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `fundingOiRegime` | Agents / traders needing one-asset structure | Is this rally new longs or short covering? | $1–$3 | 2–5 min | No | Unhide after rename from shadow + history slice | Classifier + history when ready |
| 2 | `counterTradeAnalysis` | Traders / agents with a concrete source trade | Follow, counter, delay, or ignore? | $2–$5 | 5 min | No | After #1 stable + decision ledger | #1 + decision engine |
| 3 | `crowdingSnapshot` | Screeners / other agents | Where is leverage crowded now? | $5 snap / $20–50 daily | 10 min | No | After multi-asset history | #1 scaled |
| 4 | `sourceStrategyAudit` | Room hosts / signal sellers / LPs | Does this source have inverse edge? | $25 / $50 / $100+ | 30–120 min | No | After ≥100 labeled trades | Ledger + fills history |
| 5 | `portfolioHedgeRecommendation` | Portfolio holders | Reduce drawdown without fake “hedge” claims | $5–$15 | 10 min | No | Last | #1–2 + portfolio model |

**Launch sequence (mandatory):** 1 → 2 → 3 → 4 → 5.  
Do not sell #5 before #1/#2 have public outcome samples.

Existing aliases:
- `fundingOiRegimeShadow` → Stage A canary; promote/rename carefully (parser exact match).
- `counterTradeSignal` → keep as cheap price-path product; **not** the flagship COUNTER/DELAY/SKIP object.
- Hermit `/signal` → free room composite; not a paid ACP substitute.

---

## 4. Full input/output schemas

### 4.1 `fundingOiRegime`

**Requirements**

```json
{
  "type": "object",
  "required": ["venue", "asset"],
  "properties": {
    "venue": { "type": "string", "enum": ["hyperliquid"] },
    "asset": { "type": "string", "minLength": 1, "maxLength": 20 },
    "lookback_hours": { "type": "integer", "minimum": 24, "maximum": 720, "default": 168 },
    "decision_horizon_hours": { "type": "integer", "minimum": 1, "maximum": 72, "default": 4 }
  }
}
```

**Deliverable**

```json
{
  "type": "object",
  "required": [
    "asset", "regime", "confidence", "data_timestamp", "methodology_version",
    "supporting_evidence", "contradicting_evidence", "missing_fields", "shadow_only"
  ],
  "properties": {
    "asset": { "type": "string" },
    "regime": {
      "type": "string",
      "enum": [
        "new_long_accumulation",
        "new_short_accumulation",
        "short_covering",
        "long_unwind",
        "crowded_long_continuation",
        "crowded_short_continuation",
        "long_exhaustion",
        "short_exhaustion",
        "liquidation_cascade",
        "neutral_or_ambiguous",
        "insufficient_data"
      ]
    },
    "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
    "funding_rate": { "type": ["number", "null"] },
    "open_interest_usd": { "type": ["number", "null"] },
    "volume_24h_usd": { "type": ["number", "null"] },
    "price_return_4h": { "type": ["number", "null"] },
    "price_return_24h": { "type": ["number", "null"] },
    "oi_to_volume_24h": { "type": ["number", "null"] },
    "z_scores": {
      "type": "object",
      "properties": {
        "funding_z": { "type": ["number", "null"] },
        "oi_delta_z": { "type": ["number", "null"] },
        "volume_delta_z": { "type": ["number", "null"] },
        "return_z": { "type": ["number", "null"] }
      }
    },
    "supporting_evidence": { "type": "array", "items": { "type": "string" } },
    "contradicting_evidence": { "type": "array", "items": { "type": "string" } },
    "missing_fields": { "type": "array", "items": { "type": "string" } },
    "data_timestamp": { "type": "string", "format": "date-time" },
    "methodology_version": { "type": "string" },
    "human_summary": { "type": "string" },
    "shadow_only": { "type": "boolean" }
  }
}
```

### 4.2 `counterTradeAnalysis` (flagship)

**Requirements**

```json
{
  "type": "object",
  "required": ["venue", "asset", "source_side", "entry_price", "source_timestamp"],
  "properties": {
    "venue": { "type": "string", "enum": ["hyperliquid"] },
    "asset": { "type": "string" },
    "source_side": { "type": "string", "enum": ["LONG", "SHORT"] },
    "entry_price": { "type": "number", "exclusiveMinimum": 0 },
    "position_notional_usd": { "type": "number", "exclusiveMinimum": 0 },
    "leverage": { "type": "number", "exclusiveMinimum": 0 },
    "source_timestamp": { "type": "string", "format": "date-time" },
    "evaluation_horizon_hours": { "type": "integer", "minimum": 1, "maximum": 72, "default": 8 },
    "source_id": { "type": "string" }
  }
}
```

**Deliverable:** DecisionRecord schema from §2.1 (required fields enforced).

### 4.3 `crowdingSnapshot`

**Requirements**

```json
{
  "type": "object",
  "properties": {
    "universe": { "type": "string", "enum": ["hyperliquid_top_50", "hyperliquid_majors"], "default": "hyperliquid_top_50" },
    "lookbacks": {
      "type": "array",
      "items": { "type": "string", "enum": ["1h", "4h", "24h"] },
      "default": ["1h", "4h", "24h"]
    },
    "minimum_daily_volume_usd": { "type": "number", "default": 10000000 },
    "result_limit": { "type": "integer", "minimum": 1, "maximum": 50, "default": 10 }
  }
}
```

**Deliverable**

```json
{
  "type": "object",
  "required": ["crowded_longs", "crowded_shorts", "generated_at", "methodology_version", "coverage"],
  "properties": {
    "crowded_longs": { "type": "array", "items": { "$ref": "#/$defs/crowdingRow" } },
    "crowded_shorts": { "type": "array", "items": { "$ref": "#/$defs/crowdingRow" } },
    "generated_at": { "type": "string", "format": "date-time" },
    "methodology_version": { "type": "string" },
    "coverage": {
      "type": "object",
      "required": ["assets_scanned", "assets_qualified", "stale_assets"],
      "properties": {
        "assets_scanned": { "type": "integer" },
        "assets_qualified": { "type": "integer" },
        "stale_assets": { "type": "integer" }
      }
    }
  },
  "$defs": {
    "crowdingRow": {
      "type": "object",
      "required": ["asset", "score", "stage", "funding_z", "price_return_4h"],
      "properties": {
        "asset": { "type": "string" },
        "score": { "type": "number" },
        "stage": { "type": "string", "enum": ["early_crowding", "mid_crowding", "late_crowding", "exhaustion"] },
        "funding_z": { "type": ["number", "null"] },
        "oi_delta_z": { "type": ["number", "null"] },
        "basis_z": { "type": ["number", "null"] },
        "price_return_4h": { "type": ["number", "null"] },
        "warning": { "type": "string" }
      }
    }
  }
}
```

### 4.4 `sourceStrategyAudit`

**Requirements**

```json
{
  "type": "object",
  "required": ["source"],
  "properties": {
    "source": {
      "type": "object",
      "required": ["type", "id"],
      "properties": {
        "type": { "type": "string", "enum": ["wallet", "alfaclub_room", "trade_export"] },
        "id": { "type": "string" }
      }
    },
    "range": {
      "type": "object",
      "properties": {
        "from": { "type": "string", "format": "date-time" },
        "to": { "type": "string", "format": "date-time" }
      }
    },
    "fee_bps": { "type": "number", "default": 3 },
    "slippage_bps": { "type": "number", "default": 5 },
    "horizons_hours": {
      "type": "array",
      "items": { "type": "integer" },
      "default": [4, 8, 24]
    }
  }
}
```

**Deliverable (required fields)**

```json
{
  "source": "alfaclub_room_1659",
  "sample_size": 184,
  "net_expectancy_bps": -14.2,
  "always_follow_expectancy_bps": -14.2,
  "always_counter_expectancy_bps": 5.8,
  "selective_counter_expectancy_bps": 19.4,
  "conditional_inverse_edge_bps": 13.6,
  "best_counter_regime": "crowded_long_exhaustion",
  "worst_counter_regime": "new_short_accumulation",
  "confidence": "preliminary",
  "limitations": ["..."],
  "methodology_version": "source-audit-v1",
  "generated_at": "..."
}
```

### 4.5 `portfolioHedgeRecommendation`

**Requirements**

```json
{
  "type": "object",
  "required": ["positions", "collateral_usd", "risk_objective"],
  "properties": {
    "positions": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["asset", "side", "notional_usd"],
        "properties": {
          "asset": { "type": "string" },
          "side": { "type": "string", "enum": ["LONG", "SHORT"] },
          "notional_usd": { "type": "number" },
          "entry_price": { "type": "number" },
          "leverage": { "type": "number" },
          "liquidation_price": { "type": "number" }
        }
      }
    },
    "collateral_usd": { "type": "number" },
    "maximum_additional_margin_usd": { "type": "number" },
    "risk_objective": {
      "type": "string",
      "enum": ["reduce_8h_drawdown", "reduce_beta", "reduce_liquidation_proximity"]
    }
  }
}
```

**Deliverable:** before/after gross+net exposure, candidate hedge, size range, modeled risk reduction band, cost increase, removal conditions, residual risks, `shadow_only: true`.

---

## 5. One realistic example job per offering

### 5.1 fundingOiRegime

Request: `{ "venue":"hyperliquid", "asset":"BTC", "lookback_hours":168, "decision_horizon_hours":4 }`

Human response:

> BTC classified **short_covering** (not new long accumulation). Price +2.1% / 4h while OI −1.4% (when history available); funding near neutral band. Confidence 0.71. Missing: order flow, liquidations. Advisory only.

### 5.2 counterTradeAnalysis

Request: HYPE LONG $5k @ 38.42, 5x, source ts 08:30Z, horizon 8h.

Response excerpt: decision COUNTER, counter_side SHORT, confidence 0.78, regime crowded_long_exhaustion, invalidation 39.15, cost 9 bps, valid 45m.

### 5.3 crowdingSnapshot

Top crowded long HYPE score 87 stage late_crowding; warning “momentum remains positive”.

### 5.4 sourceStrategyAudit

Room 1659, n=184, selective COUNTER expectancy +19.4 bps vs always-inverse +5.8 → Conditional Inverse Edge +13.6 bps; confidence preliminary; limitations listed.

### 5.5 portfolioHedgeRecommendation

Long HYPE+BTC book → prefer small BTC short $2.0–2.75k notional; modeled 8h downside reduction 21–29%; funding+fee drag explicit; not a full HYPE inverse.

---

## 6. Quantitative decision methodology

### 6.1 Market-state vector

Target:

`X_t = [r, Δr, F, ΔF, OI, ΔOI, V, ΔV, B, ΔB, OF, L]`

**v1.0 available now (Hyperliquid `metaAndAssetCtxs` + candles):**

| Feature | Source | Notes |
| --- | --- | --- |
| r_t (1h/4h/24h) | candles / prevDayPx | Available |
| Δr_t | candle differences | Available once multi-horizon candles cached |
| F_t | `funding` | Available (per-period rate) |
| OI_t | `openInterest * markPx` | Available |
| V_t | `dayNtlVlm` | Available (24h notional) |
| oi_to_volume | OI_t / V_t | **Proxy**, not ΔOI |
| ΔF, ΔOI, ΔV | time series store | **Missing** until continuous sampling |
| B, ΔB | mark vs oracle/index | **Missing** until endpoint wired |
| OF | aggressive flow | **Missing** (needs trades/L2) |
| L | long/short liq imbalance | **Missing** (needs liq feed) |

**Hard rule:** if a feature is missing, set `null`, list in `missing_fields`, **never impute**. Confidence penalty = f(#critical missing).

### 6.2 Robust z-score (when history exists)

```
z_x(t) = (x_t − median(x_{t-W:t})) / (1.4826 * MAD(x_{t-W:t}) + ε)
ε = 1e-12
W default = 168h for funding; 72h for returns; 24h for volume
```

Until W samples exist for a symbol: use absolute thresholds (current fundingOiRegime) and mark `normalization: "absolute_thresholds_v2"`.

### 6.3 Joint price × OI structure (mandatory interpretation)

| Price | OI | Structure label |
| --- | --- | --- |
| ↑ | ↑ | new leveraged positioning (with side from funding/sign) |
| ↑ | ↓ | short covering |
| ↓ | ↑ | new short positioning |
| ↓ | ↓ | long unwind / liquidation |

Without ΔOI, v1.0 **cannot** assign the four cells honestly. Interim proxy:

- Use multi-horizon price returns + funding sign + OI/vol level + (if available) OI change from **stored snapshots** (our observation table, not live HL history API).
- If ΔOI unavailable → max regime set is reduced; prefer `neutral_or_ambiguous` over false precision.

### 6.4 Decision engine rules (v1.0)

Inputs: source_side S ∈ {LONG, SHORT}, regime R, confidence c, cost_bps, risk_budget.

```
if missing critical fields OR data stale > max_age:
  return SKIP (reason: data quality)

if R in liquidation_cascade:
  return SKIP  # do not inverse into cascade blindly

if R aligns with S as "early accumulation / continuation":
  return DELAY  # source may be right initially

if R is exhaustion/crowded fade AGAINST S
   AND c >= c_counter
   AND expected_edge_bps > cost_bps + buffer:
  return COUNTER

if R ambiguous OR c < c_min:
  return SKIP

default:
  return SKIP
```

Suggested thresholds (must be tuned empirically; treat as priors):

| Param | Prior | Notes |
| --- | --- | --- |
| c_counter | 0.65 | COUNTER gate |
| c_min | 0.45 | below → SKIP |
| cost buffer | 5 bps | over estimated fees+slippage+funding |
| valid_for_minutes | 30–60 | shorter in high vol |
| max data age | 120s for snapshot fields | fail closed |

### 6.5 Confidence composition

```
c = clip01(
  0.35 * regime_separability
+ 0.25 * feature_completeness
+ 0.20 * agreement(counter_path, funding_oi)
+ 0.10 * liquidity_score
+ 0.10 * (1 - staleness)
− 0.15 * contradiction_penalty
)
```

All terms deterministic, unit-tested.

### 6.6 Position sizing (advisory)

```
risk_usd = equity * suggested_risk_pct   # default risk_pct in [0.01, 0.05]
notional = risk_usd * leverage_cap_factor
if decision != COUNTER: notional = 0
if confidence < c_counter: notional = 0
cap by max_asset_notional and portfolio heat
```

Does **not** call `counterTradeRunner` in v1 intelligence path.

---

## 7. Market-regime classification table

| Regime | Price | OI | Funding | Volume/flow (when avail.) | Typical inverse stance vs long source |
| --- | --- | --- | --- | --- | --- |
| new_long_accumulation | ↑ | ↑ | longs paying rising | buy flow ↑ | DELAY / SKIP |
| new_short_accumulation | ↓ | ↑ | shorts paying | sell flow ↑ | DELAY / SKIP if source short |
| short_covering | ↑ | ↓ | flat/mild | covering | SKIP (not fade-worthy) |
| long_unwind | ↓ | ↓ | flat→shorts | unwind | SKIP / DELAY |
| crowded_long_continuation | ↑ | high/↑ | elevated + | momentum strong | DELAY |
| crowded_short_continuation | ↓ | high/↑ | elevated − | momentum strong | DELAY |
| long_exhaustion | ↑ slowing / ↓ | high, growth decelerates | extreme + | flow flips − | COUNTER short |
| short_exhaustion | ↓ slowing / ↑ | high, growth decelerates | extreme − | flow flips + | COUNTER long |
| liquidation_cascade | fast ↓ or ↑ | ↓ sharp | chaotic | liq spike | SKIP |
| neutral_or_ambiguous | mixed | mixed | flat | mixed | SKIP |
| insufficient_data | n/a | n/a | n/a | n/a | SKIP |

**Mapping from current DB-stable labels** (`crowded-longs|crowded-shorts|balanced|insufficient-data`):
coarse shadow labels remain for observation store compatibility; product regimes above are the public taxonomy. Store both: `regime_coarse` + `regime_fine`.

---

## 8. Risk and position-sizing specification

| Control | Rule |
| --- | --- |
| Max suggested risk per COUNTER | 1–5% of stated capital (buyer param; default 2%) |
| Max leverage suggestion | min(source leverage, venue max * 0.5, hard 10x) |
| Portfolio heat | sum suggested risk ≤ 10% |
| Correlation haircut | if |ρ| of hedge candidates high, prefer single beta hedge |
| Liquidation distance | never suggest size that puts modeled liq distance < 8% |
| Cost gate | COUNTER only if modeled edge > costs + 5 bps |
| Kill switch | env `INV_AKITA_INTEL_KILL=1` returns SKIP/insufficient for all paid intel |
| Execution isolation | intelligence modules must not import entry/exit runners |

---

## 9. Public performance ledger

### 9.1 Tables (new; migration + bootstrap)

`alfaclub.decision_ledger`
- decision_id PK
- observed_at, data_as_of
- venue, asset, source_id, source_side
- decision, counter_side, confidence, regime_fine, methodology_version
- market_state jsonb, evidence jsonb, invalidation jsonb
- suggested_risk_pct, estimated_cost_bps, valid_for_minutes
- acp_job_id nullable, shadow_only bool
- idempotency (source_provider, idempotency_key) UNIQUE

`alfaclub.decision_outcomes`
- decision_id, horizon_hours
- due_at, settled_at
- mark_at_decision, mark_at_horizon, price_at
- return_bps, funding_pnl_bps_est, cost_bps_est, net_bps
- would_have_been_always_inverse_bps
- status: pending|settled|deferred

`alfaclub.market_feature_snapshots` (for Δ features)
- symbol, observed_at, funding, oi_usd, volume_24h, mark, extras jsonb
- unique(symbol, observed_at)

### 9.2 Public export

- Daily JSONL of settled decisions (no PII; wallet ids hashed if needed)
- Metrics dashboard fields: hit rate, expectancy, Conditional Inverse Edge, sample size, methodology version
- Claim gating: public “edge” copy only when n ≥ N and OOS protocol passes

### 9.3 Settlement

Reuse funding-OI pattern: point-in-time `readMarkPriceAt`, conditional update, no current-price fallback.

---

## 10. Backtesting and validation protocol

### 10.1 Baselines (required)

1. Always counter source  
2. Always follow source  
3. Random direction @ identical timestamps  
4. No-trade  
5. Simple funding-rate fade  
6. Price-only momentum  
7. Price-only mean reversion  
8. **Selective COUNTER engine (candidate)**

Primary metric:

```
Conditional Inverse Edge = R_selective_counter − R_always_inverse
```

Secondary: profit factor, max DD, turnover, fee drag, funding drag, fraction SKIP, calibration of confidence vs hit rate.

### 10.2 Validation design

- Purged walk-forward (embargo ≥ max feature lookback)
- OOS blocks by time
- Asset holdouts (train majors, test alts and reverse)
- Realistic fees, funding, slippage, latency, failed/partial fills
- Liquidation risk model for leveraged paths
- Parameter sensitivity + bootstrap CIs
- PBO / Deflated Sharpe where return series allow

### 10.3 Overfit defenses

- Freeze methodology_version before OOS
- No peeking at OOS for threshold tuning
- Report probability of backtest overfitting when multiple configs searched
- Require paper-trading period before any Stage D execution wiring

### 10.4 Epistemic tiers (use in all docs/marketing)

| Tier | Meaning |
| --- | --- |
| Infrastructure | Code runs, schemas valid |
| Plausible hypothesis | Economic story only |
| In-sample backtest | Not sufficient for claims |
| Out-of-sample | Required for edge language |
| Paper trading | Required pre-live |
| Independent live | Required for strong public claims |

Research GitHub READMEs = **plausible infrastructure / hypotheses**, never “proven.”

---

## 11. 30-day implementation roadmap

### Days 1–5 — Data spine
- Continuous `market_feature_snapshots` sampler (1–5m) for top assets
- Wire funding history if HL endpoint available; else our sampler is source of truth for ΔF/ΔOI
- Extend hyperliquid reader for any basis/index fields if present
- Document still-missing OF/L

### Days 6–10 — Regime v2
- Implement fine regime classifier with joint price×OI using stored deltas
- MAD-z normalization module
- Promote `fundingOiRegime` public offering (or unhide shadow after rename plan)
- Horizon settlement + public metrics stub

### Days 11–16 — Decision engine + flagship ACP
- Pure `decideCounterDelaySkip(...)`
- `counterTradeAnalysis` offering + schemas + submit handler
- Decision ledger + outcomes
- Hermit optional: `/signal` can show COUNTER framing only when source trade supplied; default stays composite action card

### Days 17–21 — Crowding snapshot
- Multi-asset scan job
- Ranked JSON + human table
- ACP `crowdingSnapshot`

### Days 22–26 — Source audit MVP
- Ingest room 1659 / wallet fills via existing HL fills APIs
- Always-follow / always-counter / selective comparison
- `sourceStrategyAudit` paid tier 1 (���100 trades)

### Days 27–30 — Validation + paper
- Walk-forward harness
- Conditional Inverse Edge report
- Paper-trade selective COUNTERs (no auto size into live runner)
- Kill switch + monitoring
- Explicit Stage D proposal only if edge > 0 with CI excluding 0

---

## 12. Repository structure (proposed additions)

```
frontend/server/_lib/alfaclub/
  marketState/
    types.ts
    featureSnapshotStore.ts
    madZ.ts
    ingestSampler.ts
  regimes/
    priceOiJoint.ts
    fundingOiRegime.ts          # evolve existing
    regimeTaxonomy.ts
  decisions/
    counterDecisionEngine.ts    # COUNTER|DELAY|SKIP pure
    confidence.ts
    sizingAdvisory.ts
    decisionLedgerStore.ts
    decisionOutcomeSettle.ts
  audits/
    sourceStrategyAudit.ts
  portfolio/
    hedgeRecommendation.ts
  compositeMarketSignal.ts      # existing room UX

frontend/server/agents/eliza/plugins/virtuals/
  backtestJobs.ts               # existing
  intelJobs.ts                  # NEW: parsers/runners for 5 offerings
  service.ts                    # offering-name routes + submit

supabase/migrations/
  YYYYMMDDHHMMSS_inv_akita_decision_ledger.sql
  YYYYMMDDHHMMSS_inv_akita_feature_snapshots.sql

docs/_internal/
  inverse-akita-v1-counter-positioning-spec.md   # this file
  inverse-akita-market-intelligence-shadow.md    # existing shadow rules
```

---

## 13. Pseudocode — decision engine

```ts
function decideCounterDelaySkip(input: {
  sourceSide: 'LONG' | 'SHORT'
  regime: FineRegime
  confidence: number // 0..1
  costBps: number
  modeledEdgeBps: number
  dataQuality: 'ok' | 'degraded' | 'bad'
  staleSeconds: number
}): Decision {
  if (input.dataQuality === 'bad' || input.staleSeconds > 120) {
    return skip('data_quality')
  }
  if (input.regime === 'insufficient_data') return skip('insufficient_data')
  if (input.regime === 'liquidation_cascade') return skip('cascade')

  const fadeLong = ['long_exhaustion', 'crowded_long_continuation_late' /* if split */]
  const fadeShort = ['short_exhaustion', 'crowded_short_continuation_late']
  const delayRegimes = [
    'new_long_accumulation', 'new_short_accumulation',
    'crowded_long_continuation', 'crowded_short_continuation',
    'short_covering', 'long_unwind'
  ]

  if (delayRegimes.includes(input.regime) && input.confidence >= 0.55) {
    // Source may be right initially; do not inverse yet
    if (sourceAlignedWithRegime(input.sourceSide, input.regime)) {
      return delay('source_aligned_early_or_covering')
    }
  }

  const wantsCounterShort = input.sourceSide === 'LONG' && isLongExhaustionFamily(input.regime)
  const wantsCounterLong = input.sourceSide === 'SHORT' && isShortExhaustionFamily(input.regime)

  if ((wantsCounterShort || wantsCounterLong)
      && input.confidence >= 0.65
      && input.modeledEdgeBps > input.costBps + 5) {
    return counter(wantsCounterShort ? 'SHORT' : 'LONG')
  }

  return skip('no_edge_after_costs_or_ambiguity')
}
```

---

## 14. Assumptions requiring empirical testing

1. Elevated funding + high OI/vol predicts mean-reversion on 4–24h horizons for HL perps.  
2. Joint price↑ OI↓ (short covering) is **not** a good fade.  
3. Selective SKIP improves Conditional Inverse Edge vs always-inverse.  
4. Source trades from AlfaClub room 1659 are timestamp-accurate enough for event studies.  
5. 7d counter-path bias is complementary to Funding/OI (current composite hypothesis).  
6. Snapshot OI/vol is correlated with true crowding (proxy validity).  
7. Suggested cost model (fees+slippage+funding) is not systematically optimistic.  
8. Confidence scores are calibrated (decile hit rates increase).  
9. MAD-z windows generalize across BTC/ETH/alts.  
10. Buyers will pay $1–$5 for machine-readable, timestamped structure vs free chat.

---

## 15. Claims we must not make until evidenced

1. “InverseAKITA predicts price.”  
2. “Always opposite is optimal.”  
3. “Our Sharpe is X” from unvalidated or third-party README backtests.  
4. “OI is expanding/contracting” without time-series OI.  
5. “Order flow / liquidations confirm …” without OF/L feeds.  
6. “Proven edge” without OOS + paper + public ledger sample size.  
7. “Hedge eliminates risk” (only modeled reduction bands).  
8. “ACP revenue implies strategy alpha.”  
9. Any live-trading claim tied to intelligence decisions before Stage D.  
10. Equating Hermit `/signal` LONG/SHORT with ACP COUNTER/DELAY/SKIP without a source trade.

---

## 16. Acceptance, refunds, verification (all paid offerings)

| Item | Rule |
| --- | --- |
| Acceptance | All required schema fields present; `data_timestamp` within SLA freshness; methodology_version set; missing fields explicit |
| Refund / reject | Stale data, venue outage, insufficient coverage (snapshot), unparseable source history (audit) |
| Independent verify | Buyer re-queries HL at `data_timestamp` ± tolerance; compares published formulas in methodology_version |
| Worth paying vs chatbot | Live normalized multi-field snapshot, joint structure, ledger ID, settlement path, cost model — not prose guessing |

---

## 17. Monitoring and kill switch

- Metrics: job success rate, submit failures, p95 latency, data staleness, SKIP rate, ledger settle lag  
- Alerts: submit error spike, HL fetch fail rate, confidence mass near 0.5 (calibration smell)  
- Kill: `INV_AKITA_INTEL_KILL=1` → all intel offerings return structured SKIP/insufficient; execution engine unaffected  
- Shadow invariant remains until Stage D ticket explicitly lifts it

---

## 18. Immediate engineering next steps (smallest vertical slice)

1. **Feature snapshot sampler** → enable honest ΔF/ΔOI for top symbols.  
2. **Fine regime classifier** using price×OI joint + funding z.  
3. **`counterTradeAnalysis` pure engine + ledger** (still shadow_only).  
4. **ACP offering** hidden canary → Stage A purchase like fundingOiRegimeShadow.  
5. Only then unhide and price at $2–$5.

Do not start with portfolio hedge or marketing claims.

### Implementation status (2026-07-12)

Repo now includes the staged modules, migrations, crons, and hidden ACP handlers
described in §11–§12. Operator actions still required:

- Apply migrations `20260716000000_inv_akita_feature_snapshots.sql` and
  `20260716010000_inv_akita_decision_ledger.sql`.
- Register/rename Virtuals offerings with exact machine names in
  `inverse-akita-market-intelligence-shadow.md`.
- Run funded purchase canaries before changing Virtuals visibility/price.
- Stage D / live execution wiring remains explicitly out of scope.

---

## 19. Explicit unknowns / bias risks

- HL funding units and payment frequency must stay documented; mis-scaling funding z is a high-severity bug.  
- Source timestamps from chat may be delayed vs fill time → look-ahead bias if not careful.  
- Survivorship in asset universe for crowding snapshots.  
- Multiple testing across regimes/thresholds inflates apparent edge.  
- Room 1659 behavior may not generalize to other sources.  
- Composite `/signal` mixes a price-path contrarian with funding fade; agreement may overstate independence of legs.

---

## 20. Success definition for v1

v1 is successful when:

1. Five offerings exist as schemas + handlers (even if 3–5 still hidden).  
2. Every COUNTER/DELAY/SKIP is in the public ledger with settleable horizons.  
3. Conditional Inverse Edge is measured (even if negative — truth over theater).  
4. ACP revenue path works (submit + complete) independent of trading PnL.  
5. Live execution remains isolated until a separate review says otherwise.
