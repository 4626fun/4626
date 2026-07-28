# creator_coins index reclaim (2026-07-28)

## Scope note: Shovel vs creator_coins

| Path | Tables | Writer |
|---|---|---|
| **Shovel** (protocol Tier A) | `shovel.*`, `protocol_*` | `indexer/shovel` (`SHOVEL_PG_URL` session :5432) |
| **Zora / metrics** | `creator_coins`, `creators`, `zora_csw_*` | App crons + Zora CSW indexer |

This reclaim only touches **creator_coins**. Shovel tables were ~1.5 MB total (`task_updates` ~1.5 MB, protocol tables empty/tiny) — no action needed.

## Live before → after

| Metric | Before | After |
|---|---|---|
| Table total | **939 MB** | **561 MB** |
| Heap | 179 MB | 179 MB |
| Indexes | **759 MB** | **~382 MB** |

## Changes

1. **Dropped** `creator_coins_creator_idx` (0 scans; `creator_coins_chain_creator_rank_idx` covers `lower(creator_address)`).
2. **Added** `idx_creator_coins_volume_rank_hot` partial `WHERE volume_24h_usd > 0` (~282 rows).
3. **REINDEX CONCURRENTLY** on remaining indexes (no write lock).

Full `idx_creator_coins_volume_rank` kept: `refreshCreatorEthosProjection` does unfiltered `ORDER BY volume_24h_usd … LIMIT n` (zeros fill after the 282 positive-volume coins).

## Optional next (code)

In `creatorEthosProjection.ts` `volume_candidates`, split:

1. `WHERE volume_24h_usd > 0` (uses hot partial)
2. fill remainder with `volume_24h_usd = 0 ORDER BY market_cap_usd`

Then drop the full  volume_rank index (~hundreds of MB write amplification gone).
