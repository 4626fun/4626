# Mainnet creator-share-hook upgrade — 2026-07-09

> **Historical deployment record.** References to KPR entry/winner relay
> deployment describe the retired Twin era and are not current runbook steps.

## Result: **SUCCESS**

| Field | Value |
|-------|--------|
| Program ID | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
| Signature | `39udr1opeY1q26GLS3uP2GznqacYvHEMvGKhynge3JgKkZ4oKG9ahsRyKSxNgf6yhxuxZA5tZ1SNBnWNHgmnyT7w` |
| Last Deployed Slot (before) | `430461604` |
| Last Deployed Slot (after) | **`431796316`** |
| Binary SHA-256 | `43e99ee693962d92bfc42fe897d79bb496066d8c2270adcec0eeea0566754c22` |
| Binary size | 329 632 bytes |
| Git commit | `f6c9fa93f` (main, PR #681) |
| Upgrade authority | `7Qi3WW7q4kmqXcMBca76b3WjNMdRmjjjrpG5FTc8htxY` |
| Authority SOL before | 2.760359798 |
| Authority SOL after | 2.758714798 (~0.0016 fee; buffer reclaimed) |

## Features now live

- **M2-12** `record_winner(..., win_id)` + `WinIdRecord` PDA
- **M2-13** settle threshold / withdraw authority
- **C-01** transfer + mint gates

## Immediate follow-ups

See **[post-solana-hook-upgrade-checklist.md](./post-solana-hook-upgrade-checklist.md)**.

1. **Redeploy KPR / Solana orchestrator** with winner-relay that sends `win_id` (repo `main` already has this).
2. Keep **`SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`**.
3. Smoke: record winner once; duplicate `win_id` should fail/idempotent.
4. Base LotteryManager / boost arm / Safe transfers remain separate ops.

## Verified post-upgrade (agent)

```text
Last Deployed In Slot: 431796316   # re-checked after deploy
Authority balance: ~2.76 → ~2.76 SOL (buffer reclaimed; small fee)
```

