---
title: Looker Studio Widget Recipe
sidebar_position: 10
---

# Looker Studio Widget Recipe — 4626 Outreach Dashboard

Exact component + field config for the 4626 outreach dashboard in
Looker Studio. Pairs with the
[4626 Outreach Looker Studio Connector](../../indexer/scripts/lookerStudioConnector/README.md)
so all six widgets pull live from Supabase.

## Prerequisite

You have deployed the connector (see the connector's `README.md`) and
created a Looker Studio data source pointing at `zora_profiles`.

## Top-level layout

```
┌────────────────────────────────────────────────────────────────────┐
│  [Cohort filter]  [Priority filter]  [Status filter]               │ ← controls bar
├────────────────────────────────────────────────────────────────────┤
│  ┌───────────┐  ┌───────────┐  ┌───────────┐                       │
│  │  TOTAL    │  │ REACHABLE │  │REACH RATE │                       │ ← 3 scorecards
│  │    379    │  │    302    │  │   79.7%   │                       │
│  └───────────┘  └───────────┘  └───────────┘                       │
├────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────┐  ┌──────────────────────┐             │
│  │ Cohort × Priority       │  │ Address Kind Donut   │             │
│  │ (stacked bar)           │  │                      │             │
│  └─────────────────────────┘  └──────────────────────┘             │
├────────────────────────────────────────────────────────────────────┤
│  Work queue table (filtered: XMTP Reachable = true,                │
│    Status = "Not contacted"; sorted by Priority asc, Unique Holders│
│    desc)                                                           │
└────────────────────────────────────────────────────────────────────┘
```

## Widgets

### 1 — Scorecard · TOTAL

- **Metric**: `Record Count`
- **Filter**: none
- **Style**: font 36pt bold, label "TOTAL CREATORS"

### 2 — Scorecard · REACHABLE

- **Metric**: `Record Count`
- **Filter**: `Primary Wallet Kind IS NOT NULL` (proxy for enrichment
  completeness — if you've also loaded `xmtp_reachable` via the future
  migration, swap to that instead)
- **Style**: font 36pt bold, green color `#188038`, label "REACHABLE"

### 3 — Scorecard · REACH RATE

- **Metric**: create a calculated field —
  ```
  SUM(IF(Primary Wallet Kind IS NOT NULL, 1, 0)) / COUNT(Zora Handle)
  ```
  - Format: percent, 1 decimal
- **Style**: font 36pt bold, blue color `#1a73e8`, label "REACH RATE"

### 4 — Stacked column · Cohort × Priority

- **Dimension**: derive a `Priority` field via calculated metric —
  ```
  CASE
    WHEN Unique Holders >= 20000 THEN "P0"
    WHEN Unique Holders >= 1000  THEN "P1"
    WHEN Unique Holders >= 100   THEN "P2"
    ELSE "P3"
  END
  ```
- **Breakdown dimension**: `Priority` (from the calculated field above)
- **Metric**: `Record Count`
- **Derive `Cohort`** if needed —
  ```
  CASE
    WHEN Zora Creator Coin Address IS NOT NULL THEN "top_creator"
    ELSE "supporter"
  END
  ```
- **Style**: colors P0=`#d93025`, P1=`#e8710a`, P2=`#f9ab00`,
  P3=`#9aa0a6`; stacked on; legend bottom

### 5 — Donut · Install-readiness split

- **Dimension**: derive an `Install Readiness` field —
  ```
  CASE
    WHEN Signer Balance (wei) >= 100000000000000     THEN "ready"
    WHEN Signer Balance (wei) IS NULL OR Signer Balance (wei) = 0
                                                      THEN "needs_gas"
    ELSE "unknown"
  END
  ```
  (Thresholds: 0.0001 ETH ≈ 1e14 wei — tweak to whatever you deem
  "enough to cover a deploy".)
- **Metric**: `Record Count`
- **Style**: donut hole 55%, colors `ready`=`#188038`,
  `needs_gas`=`#e8710a`, `unknown`=`#9aa0a6`

### 6 — Table · Work queue

- **Dimensions** (left-to-right): `Zora Handle`, `Coin Ticker`,
  `Unique Holders`, `Install Target`, `Signing EOA`,
  `Farcaster Username`, `Twitter Username`
- **Metric**: none (detail table)
- **Sort**: `Unique Holders` descending
- **Filter**: `Zora Handle IS NOT NULL`
- **Style**: alternating row shading, 9pt body, 10pt header

### Controls row

Drop three **Drop-down list** controls across the top, bound to:

1. `Primary Wallet Kind` (cohort proxy)
2. The calculated `Priority` dimension from widget 4
3. The calculated `Install Readiness` dimension from widget 5

Viewers can now slice every widget with one click.

## Theming

- **Theme & layout → Theme** → *Constellation* (dark) or *Simple* (light).
  Applies a consistent type scale, gutter spacing, and legend style
  across widgets.
- **Report background**: `#fafafa` (light) or `#0a0a0a` (dark).
- **Grid**: hide grid lines in every chart
  (Chart → Style → Background and border → Grid lines = off).

## Refresh

- Toolbar refresh icon (circular arrow) forces a fresh Supabase pull.
- Default cache TTL = 12 hours. Override per data source:
  **Data source → Edit → Data freshness**.

## Embed in Notion

- Share → **Anyone with the link** → Viewer → copy URL.
- In the target Notion page: type `/embed` → paste URL →
  **Embed link**. The embed renders in Notion and refreshes whenever
  the underlying Looker Studio cache refreshes.
