# zora_csw_owner_class unused index drop — 2026-07-28

## Context

Post creator_coins / zora_csw_owners reclaim pass. Performance advisors and
`pg_stat_user_indexes` showed multiple secondary indexes on
`zora_csw_owner_class` with **0 scans**.

## Applied live

Migration: `20260728220000_zora_owner_class_unused_index_drop.sql`

### Dropped

| Index | Approx size | idx_scan |
|---|---|---|
| `idx_zora_csw_owner_class_ethos_refresh_queue` | ~17 MB | 0 |
| `idx_zora_csw_owner_class_wallet_class` | ~1.4 MB | 0 |
| `idx_zora_csw_owner_class_mainnet_nonce` | ~1.4 MB | 0 |
| `idx_zora_csw_owner_class_ethos_stale` | ~96 kB | 0 |
| `idx_zora_csw_owner_class_outreach_pool` | ~16 kB | 0 |
| `idx_zora_csw_owner_class_zora_handle` | ~16 kB | 0 |
| `idx_zora_csw_owner_class_ens_name` | ~16 kB | 0 |
| `idx_zora_csw_owner_class_farcaster_fid` | ~16 kB | 0 |
| `idx_zora_csw_owner_class_basename` | ~16 kB | 0 |
| `idx_zora_csw_owners_initial_owners` (if present) | GIN | n/a |
| projection volume/mcap leftovers (if present) | n/a | 0 |

### Kept

- `zora_csw_owner_class_pkey`
- `zora_csw_owner_class_lower_eoa_idx` (hot path, ~29M scans)
- `idx_zora_csw_owner_class_ethos_score`
- `zora_csw_owners` pkey + `lower(csw_address)`
- `current_owners` GIN if still present (exportOutreach `.contains`)

## Notes

- Offline `exportOutreach.ts` filters `wallet_class` / handles / `mainnet_nonce`
  but targets ~50 rows; seq scan of ~200k is fine.
- Do **not** prune unmatched CSW rows or drop audit columns (infra-ops policy).
- Next optional: normalize `zora_csw_owners.csw_address` to lowercase to drop
  the 99 MB functional index (requires writer + query path changes).
