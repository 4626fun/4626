---
title: Solana OVault Canary Rollout
sidebar_position: 4
---

# Solana OVault Canary Rollout

Run this guide when rolling out the Solana preflight path on mainnet.

It uses the canonical Solana preflight route:

- `/api/deploy/registerSolanaBridgeToken`

## Runtime Controls

Set on all deploy-session runtimes:

- `DEPLOY_SOLANA_OVAULT_KILL_SWITCH`
  - `0`: normal behavior
  - `1`: disable Solana preflight writes during incident response
- `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED`
  - `0`: canonical endpoint accepts writes
  - `1`: direct writes to `/api/deploy/registerSolanaBridgeToken` are disabled (`410`)

Optional aliases are also supported:

- `SOLANA_OVAULT_KILL_SWITCH`

## Canary Sequence

1. **Prepare**
   - Ensure `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
   - Ensure deploy-session TTL is long enough for mainnet latency (`DEPLOY_SESSION_TTL_MINUTES>=45`)
   - Deploy API/runtime config
2. **Canary creators (1-3)**
   - Run `/deploy` for canary creators only
   - Confirm phase progression reaches `phase3_sent`/`completed`
3. **Verify preflight path**
   - Confirm status handler calls `/api/deploy/registerSolanaBridgeToken`
   - Confirm expected `depositEligible`, `redeemEligible`, and compatibility gating behavior
4. **Expand**
   - Keep the canonical route enabled while cohort size increases
5. **Legacy cutover**
   - Set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=1`
   - Keep `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
   - Verify direct calls to `/api/deploy/registerSolanaBridgeToken` return `410`

## Monitoring / Go-No-Go

Watch deploy-session failures for:

- `Solana preflight failed`
- OVault eligibility failures (`existingMintCompatible`, `depositEligible`, `redeemEligible`)

No-Go if canary sessions regress or preflight failures spike.

## Fast Rollback

If canary health degrades:

1. Set `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=1`
2. Set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=0`
3. Redeploy config/runtime
4. Confirm new sessions stop performing Solana preflight writes
5. Keep investigating the preflight path before re-enabling writes

When ready to re-enable:

1. Set `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
2. After stability, set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=1` again if you want to freeze writes
3. Re-run canary validation

## Notes

- Kill switch affects deploy-session Solana preflight routing only.
- Legacy write-disable gate applies only to the canonical endpoint path.
- Existing compatibility/eligibility hard gates remain active regardless of route mode.
