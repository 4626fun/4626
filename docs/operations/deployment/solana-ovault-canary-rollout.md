---
title: Solana OVault Canary Rollout
sidebar_position: 4
---

# Solana OVault Canary Rollout

Run this guide when rolling out the OVault-first Solana preflight path on mainnet.

It adds an explicit runtime switch between:

- OVault-first preflight (`/api/deploy/setupSolanaOvaultMesh`)
- legacy preflight (`/api/deploy/registerSolanaBridgeToken`)

and provides a one-step rollback kill switch.

## Runtime Controls

Set on all deploy-session runtimes:

- `DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE`
  - `ovault_first` (default): OVault route first, fallback to legacy on route-unavailable responses (`404`, `405`, request failure)
  - `legacy_first`: legacy first, fallback to OVault on route-unavailable responses
  - `ovault_only`: strict OVault route, no fallback
  - `legacy_only`: strict legacy route, no fallback
- `DEPLOY_SOLANA_OVAULT_KILL_SWITCH`
  - `0`: normal behavior from route mode
  - `1`: force `legacy_only` regardless of route mode
- `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED`
  - `0`: legacy endpoint still accepts writes (default during canary)
  - `1`: direct writes to `/api/deploy/registerSolanaBridgeToken` are disabled (`410`)
    - OVault alias route (`/api/deploy/setupSolanaOvaultMesh`) remains available

Optional aliases are also supported:

- `SOLANA_PREFLIGHT_ROUTE_MODE`
- `SOLANA_OVAULT_KILL_SWITCH`

## Canary Sequence

1. **Prepare**
   - Ensure `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
   - Set `DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE=ovault_first`
   - Ensure deploy-session TTL is long enough for mainnet latency (`DEPLOY_SESSION_TTL_MINUTES>=45`)
   - Deploy API/runtime config
2. **Canary creators (1-3)**
   - Run `/deploy` for canary creators only
   - Confirm phase progression reaches `phase3_sent`/`completed`
3. **Verify preflight path**
   - Confirm status handler calls OVault route first
   - Confirm expected `depositEligible`, `redeemEligible`, and compatibility gating behavior
4. **Expand**
   - Keep `ovault_first` while cohort size increases
   - Move to `ovault_only` only after stability window is clean
5. **Legacy cutover**
   - Set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=1`
   - Keep `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
   - Verify direct calls to `/api/deploy/registerSolanaBridgeToken` return `410`

## Monitoring / Go-No-Go

Watch deploy-session failures for:

- `Solana preflight failed (mode=...)`
- OVault eligibility failures (`existingMintCompatible`, `depositEligible`, `redeemEligible`)
- repeated route-unavailable failures from OVault endpoint

No-Go if canary sessions regress or preflight failures spike.

## Fast Rollback

If canary health degrades:

1. Set `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=1`
2. Set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=0` (required so legacy route can accept writes)
3. Redeploy config/runtime
4. Confirm new sessions use legacy route only
5. Keep investigating OVault path while production deploys continue on legacy mode

When ready to re-enable:

1. Set `DEPLOY_SOLANA_OVAULT_KILL_SWITCH=0`
2. Restore `DEPLOY_SOLANA_PREFLIGHT_ROUTE_MODE=ovault_first`
3. After stability, set `DEPLOY_SOLANA_LEGACY_WRITE_DISABLED=1` again
4. Re-run canary validation

## Notes

- Kill switch affects deploy-session Solana preflight routing only.
- Legacy write-disable gate applies only to the direct legacy endpoint path.
- Existing compatibility/eligibility hard gates remain active regardless of route mode.
