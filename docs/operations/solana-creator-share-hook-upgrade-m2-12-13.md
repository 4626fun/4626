# Solana creator-share-hook upgrade (M2-12 / M2-13)

> **Historical upgrade record.** KPR entry/winner relay workflows were removed
> in July 2026. Keep the on-chain upgrade evidence; do not use relay deployment
> steps as current instructions.

**Program ID:** `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`  
**Source:** `programs/creator-share-hook/`  
**IDL:** `programs/creator-share-hook/target/idl/creator_share_hook.json`  
**Keep B2 `relay_entries` off** until this upgrade is live + pool verify complete.

## What changed

| Finding | Change |
|---------|--------|
| **M2-12** | `record_winner(winner, shares_paid, win_id)` — non-zero `win_id`; one-shot PDA `["win_id", mint, win_id]`; replays fail on init |
| **M2-13** | `settle_fees` enforces `settlement_threshold` post-harvest; requires `keeper == TransferFeeConfig.withdraw_withheld_authority` |
| **L2-06** | Mint cross-constraints on `creator_config` / `winner_record` vs `creator_mint` |

KPR winner-relay already digests Base `(block, logIndex, creatorCoin, winner)` → 32-byte `win_id` and includes the new accounts. Deploy KPR after the program upgrade (or simultaneously).

## Pre-flight

1. Confirm upgrade authority key is available (`SOLANA_PRIVATE_KEY` — base58 → CLI JSON keypair; see AGENTS.md).
2. Build SBF binary:
   ```bash
   cd programs/creator-share-hook
   bash scripts/build-sbf.sh
   # or: anchor build
   ls -la target/deploy/creator_share_hook.so
   ```
3. Check program data size vs binary:
   ```bash
   solana program show EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU --url https://api.mainnet-beta.solana.com
   # If .so larger than allocated data length:
   solana program extend EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU <extra-bytes> \
     --url https://api.mainnet-beta.solana.com --keypair <deployer.json>
   ```
4. Ensure deployer has ~2.4+ SOL for buffer (refunded after upgrade).

## Upgrade

```bash
solana config set --url https://api.mainnet-beta.solana.com --keypair <deployer-keypair.json>

solana program deploy \
  programs/creator-share-hook/target/deploy/creator_share_hook.so \
  --program-id EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU
```

Do **not** pass the local `creator_share_hook-keypair.json` as `--program-id` (it does not match mainnet).

## Post-upgrade smoke

1. **IDL:** commit/deploy the updated `target/idl/creator_share_hook.json` (already regenerated in-repo).
2. **Redeploy KPR / Solana orchestrator** with winner-relay that sends `win_id` + `win_id_record` + system program.
3. Dry-run winner path (staging mint or canary):
   - Record a winner with a fresh `win_id` → success.
   - Same `win_id` again → account already in use / reject.
4. `settle_fees` with threshold > 0 and withheld below threshold → `BelowSettlementThreshold`.
5. Confirm `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` still default-deny.
6. Confirm single trigger plane (M2-09): local cron off if Vercel→sidecar is canonical; action leases on.

## Rollback

Solana program upgrade is **not** easily rolled back without another upgrade to a prior binary. Keep the previous `.so` artifact and its git SHA ready. Prefer staging/canary mint smoke before relying on production winner UX.

## Related

- Ops checklist: `docs/audits/PRE_LOTTERY_OPS_CHECKLIST.md`
- Open findings: `docs/audits/OPEN_FINDINGS_BOARD.md`
- AGENTS.md § Solana program deployment
