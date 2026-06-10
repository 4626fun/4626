---
title: Dune Analytics Runbook
sidebar_position: 10
---

# Dune analytics runbook

Public, verifiable analytics (the [Ramses Exchange `spellbook`](https://github.com/RamsesExchange/spellbook) pattern) for 4626 on **Base**. Start with manual queries in the Dune UI; codify stable views in a repo fork only after metrics are validated for two weeks.

## Goals (MVP dashboard)

Publish a Dune dashboard with at least:

1. **Vault deploys** — `DeploymentBatcher` / factory events (count per day, cumulative)
2. **Share / gauge activity** — transfers and fee routing where indexed
3. **Lottery / jackpot** — `CreatorLotteryManager` payouts (when wired)
4. **CCA / auction** — launch strategy events for active vaults

Link the dashboard from Explore by setting on Vercel:

```bash
VITE_DUNE_DASHBOARD_URL=https://dune.com/<your-org>/<dashboard-slug>
```

Redeploy production after setting the variable so the app shows **Verify on Dune**.

## Canonical contract addresses (Base)

Use [Contract addresses](/reference/addresses) as source of truth. Current greenfield infrastructure (v1.11.2-pipe-a epoch) includes:

| Contract | Address |
|----------|---------|
| DeploymentBatcher | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| CreatorRegistry | `0x3f64087dc361Ad52300409E5873b26941D6418B6` |
| CreatorOVaultFactory | `0x09a2fd817F30D2599fb13520d06751259b6AdcFE` |
| CreatorLotteryManager | `0x5c0115589d7F4930A0dc93417aE409f44186f4E7` |
| SolanaBridgeAdapter | `0x700b4BBAf965c013123bAd02a6562FBa487aC0f1` |
| Zora factory (coin creates) | `0x777777751622c0d3258f214f9df38e35bf45baf3` |

Deprecated batcher `0x16aEA859bd709D16Cd1F94c1C349A9E8A315F1D8` — include only for historical AKITA / legacy vault charts.

## Starter SQL (Dune SQL editor)

Copy-ready queries live in the repo:

- `docs/operations/dune/queries/01-batcher-tx-volume.sql`
- `docs/operations/dune/queries/02-legacy-batcher-tx-volume.sql`
- `docs/operations/dune/queries/03-zora-factory-coin-created.sql`
- `docs/operations/dune/queries/04-registry-and-lottery-activity.sql`

Adjust table names to Dune’s decoded schema for your ABI uploads.

### Daily vault-related txs (proxy: batcher `msg.sender` volume)

```sql
SELECT
  date_trunc('day', block_time) AS day,
  count(*) AS tx_count
FROM base.transactions
WHERE "to" = 0xa99058f424fb3acc639f59355c65c40149030651
  AND block_time >= now() - interval '90' day
GROUP BY 1
ORDER BY 1
```

### Zora creator coin creates (factory `CoinCreated`)

After uploading `ZoraAccountManager` / factory ABI to Dune:

```sql
SELECT
  date_trunc('day', evt_block_time) AS day,
  count(*) AS coins_created
FROM zora_base.CoinCreated  -- replace with your decoded table name
WHERE evt_block_time >= now() - interval '90' day
GROUP BY 1
ORDER BY 1
```

### Compare to in-app indexed totals

In-app hero market cap / volume are **not** live Dune queries — they come from `GET /api/zora/metrics`. Use Dune for **on-chain protocol** truth and Supabase/API for **indexed Zora coin** aggregates. Document both on the dashboard description.

## Spellbook fork (phase 2)

When queries stabilize:

1. Fork [duneanalytics/spellbook](https://github.com/duneanalytics/spellbook) or maintain `4626-spellbook` under your org.
2. Add abstractions, e.g. `4626_vault_deploys`, `4626_share_transfers`, with tests per spellbook CI.
3. Open PR to Dune community or keep a private spellbook for your workspace only.

Ramses keeps protocol-specific SQL in-repo so dashboards survive UI refactors — same model for 4626.

## Server API (after `DUNE_API_KEY` is set)

Local probe (loads `frontend/.env` if exported in shell):

```bash
pnpm -C frontend exec tsx scripts/ops/dune-probe.ts
pnpm -C frontend exec tsx scripts/ops/dune-probe.ts --metric=batcher-tx
```

HTTP (15 min cache per metric):

- `GET /api/analytics/dune` — configured + allowed metric keys
- `GET /api/analytics/dune?probe=1` — `SELECT 1` health check
- `GET /api/analytics/dune?metric=batcher-tx` — runs SQL from `docs/operations/dune/queries/`

Copy `DUNE_API_KEY` to **Vercel** (`akita-llc/4626`, Production) — local `.env` does not apply in prod.

## Checklist before linking in production

- [ ] `DUNE_API_KEY` on Vercel production (server-only, not `VITE_`)
- [ ] Dashboard marked **public** (or team-visible with share link)
- [ ] Each chart caption states chain (Base) and contract version epoch
- [ ] AKITA / legacy vaults labeled separately from greenfield batcher
- [ ] `VITE_DUNE_DASHBOARD_URL` set on Vercel production
- [ ] [Explore analytics](/users/explore-analytics) doc reviewed for wording alignment

## Related

- [Explore metrics operations](/operations/explore-metrics-operations)
- [Looker Studio widget recipe](/operations/looker-studio-widget-recipe) — internal Supabase analytics
