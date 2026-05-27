---
title: Explore Analytics
sidebar_position: 6
---

# Explore analytics

This page explains how **4626 Explore** numbers are produced, what “indexed” means, and how to verify protocol activity independently.

## What Explore shows

| Surface | Data source | Notes |
|--------|-------------|--------|
| **Hero totals** (creators, market cap, 24h volume, 24h fees) | Supabase `creator_coins` + sync state | Served by `GET /api/zora/metrics?scope=creators` |
| **Explore tables** (creators, content, trends, vaults) | Same index + list APIs | Ethos sort uses `creator_ethos_projection` |
| **30D market-cap sparkline** | `creator_metrics_daily_snapshots` | Daily snapshots written by the metrics cron |
| **Per-coin charts** (content/creator detail) | Uniswap V4 subgraph (`PoolDayData`) first | Zora swap fallback when subgraph has no candles |
| **Fees on detail charts** | Subgraph fee events | May be unavailable when the pool is not indexed |

Explore does **not** mix live Zora Explore API samples into hero totals at request time. During backfill, labels read **Indexed creators** and financial hints read **Sum of indexed coins**.

## Sync states (in the app)

- **Partial index** — backfill still running or totals are not yet `exact`. Hero numbers sum only coins already in the database.
- **Full index** — on-chain scan backfill marked complete (`exact: true` on the metrics API).
- **Refreshing** — background sync in progress while displaying the last good snapshot.
- **Sync error** — database or sync failure; UI shows last known values with a timestamp.

Check the status line under the hero metrics on `/explore` for the latest refresh time and indexed creator count.

## How often data updates

| Job | Schedule (production) | Purpose |
|-----|----------------------|---------|
| Creator metrics sync | Vercel cron + manual `GET /api/sync-creator-metrics` | Upsert `creator_coins`, hero totals, daily snapshots |
| Zora profiles refresh | Every 6 hours (`/api/v1/zora-profiles/refresh-cron`) | Market/volume fields for outreach and Looker |
| Ethos projection refresh | `/api/v1/chat/ethos-sync` + hot cron | Creator list Ethos sort |

Operators: see [Explore metrics operations](/operations/explore-metrics-operations).

## Verify on-chain (Dune)

Public dashboards built from Base chain data are the Ramses-style transparency layer. After your team publishes a Dune dashboard, set `VITE_DUNE_DASHBOARD_URL` on the frontend so Explore shows **Verify on Dune**.

Starter queries and contract addresses: [Dune analytics runbook](/operations/dune-analytics-runbook).

## Integrators

- **Token manifest:** `https://app.4626.fun/data/explore-assets-manifest.json` (schema version + update policy; token rows are filled as the index grows).
- **Vault list API:** `GET /api/v1/explore/vaults` (authenticated agent API; see API docs).

## Related

- [Contract addresses](/reference/addresses) — canonical Base deployments
- [Ethos canonical score cache](/operations/ethos-canonical-score-cache) — reputation sort pipeline
