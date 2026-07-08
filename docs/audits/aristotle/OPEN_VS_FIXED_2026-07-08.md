# Aristotle Remediation Tracker (2026-07-08)

This tracker summarizes what has been fixed in the current working branch during the segmented Aristotle sweep, and what remains open or decision-dependent.

## Fixed in this remediation pass

| Area | File(s) | Status | Notes |
|---|---|---|---|
| AlfaClub pool lifecycle DoS | `contracts/other/alfaclub/AlfaCreatorKeyPool.sol` | Fixed | Added minimum-liquidity lock on first mint so LP supply/reserves cannot collapse to zero. |
| Solana bridge CCA ownership/auth | `contracts/shared/bridge/SolanaBridgeAdapter.sol` | Fixed | Added `ccaBidOwner` binding; enforce bid owner on claim/exit; added safer lottery amount scale-up guards. |
| Strategy share-drain via rescue | `contracts/shared/strategies/ERC4626StrategyAdapter.sol` | Fixed | Prevent rescue of underlying while active and always block rescue of position shares (`ERC4626_VAULT`). |
| Charm emergency drain surface | `contracts/shared/strategies/univ3/CharmStrategy4626.sol` | Fixed | Restricted owner emergency recipient and blocked core-token drains while active. |
| Charm withdraw sizing/slippage | `contracts/shared/strategies/univ3/CharmStrategy4626.sol` | Fixed | Replaced mixed-decimal share sizing with asset-denominated sizing; added nonzero min amounts for vault withdraw. |
| Charm rebalance fail-open | `contracts/shared/strategies/univ3/CharmStrategy4626.sol` | Fixed | Added hard failure on unavailable valuation (`RebalanceValuationUnavailable`). |
| Shareoft-mesh migrate init DoS | `contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol` | Fixed | `migrate()` now tolerates pre-initialized pool and enforces post-check by slot0 price. |
| LP manager seeding control | `contracts/shared/shareoft-mesh/cca/CCALaunchArm.sol` | Fixed | `seedLpManager()` restricted to approved/owner, made idempotent (`lpManagerSeeded`), and uses `safeTransfer`. |
| Univ4 rebalance slippage metric | `contracts/shared/shareoft-mesh/univ4/OVaultLPManager.sol` | Fixed | Slippage guard now checks full portfolio value (asset + paired converted via oracle), not idle asset only. |
| Univ4 fee accrual dead path | `contracts/shared/shareoft-mesh/univ4/OVaultLPManager.sol` | Fixed | Burn/collect now accrues realized fee excess into `accruedFees0/1` so `collectFees()` works. |
| Univ4 TWAP/spot bypass + native handling | `contracts/shared/shareoft-mesh/univ4/OVaultLPManager.sol` | Fixed | Removed spot fallback, tightened ETH input validation, and stopped over-forwarding native value on burn/decrease paths. |
| Ajna bucket authority risk | `contracts/shared/strategies/ajna/AjnaERC4626Vault.sol` | Fixed | Restricted `moveFromBuffer` and `move` to swapper-only path (keepers still allowed to de-risk via `moveToBuffer`). |
| Deferred VRF stale-drop after pause | `contracts/shared/lottery/manager/LotteryManager4626.sol` | Fixed | `applyDeferredVrf` refreshes `requestTimestamp` before replay to avoid stale discard after long pauses. |

## Open or not yet addressed in this pass

| Area | Source | Status | Next action |
|---|---|---|---|
| Burn-stream failed-burn accounting double-count | `docs/audits/aristotle/oracle/AUDIT.md` (M-2) | Open | Rework `VaultShareBurnStream` accounting so failed burns are not re-queued and double-tracked. |
| Burn-stream integration assumptions (`msg.sender == vault`) | `docs/audits/aristotle/oracle/AUDIT.md` (L-2) | Open | Add integration self-tests and explicit deployment/runtime checks. |
| External-swap keeper authority model | `docs/audits/aristotle/oracle/AUDIT.md` (L-3) | Partially open (governance) | Keep strict allowlists; optionally add spend caps / timelock policies. |
| Centralization/emergency controls across modules | Multiple audits | Open (governance) | Enforce timelock/multisig policy and monitoring, not just local code checks. |
| CreatorOVault high/medium set (queue payout semantics, liveness, config delay, debt-buy semantics) | `docs/audits/CreatorOVault_aristotle/ARISTOTLE_SUMMARY.md` | Open | Separate focused remediation pass on `CreatorOVault` and modules. |
| Creator interface semantic assumptions | `creator/interfaces` audit output | Open (implementation-level) | Validate and enforce in concrete contract implementations, not in interfaces alone. |

## Validation notes

- Solidity compilation has been re-run after each hardening batch with `forge build`, and each run completed successfully.
- No linter diagnostics were introduced on the touched Solidity files.

