# ODA 2026-07-22 triage

Source pin audited: `4626fun/4626` @ `audit/oda-2026-07-22` (`423e0e3`).
Private working tree is ahead of that pin (High + Medium/Low remediations).

## Job status

| Job | System | Report | Disposition |
|-----|--------|--------|-------------|
| 460 | Lottery probe (LM only) | complete | Critical/High FIXED; Mediums/Lows below |
| 461 | Lottery stack | complete | Critical/High FIXED; Mediums/Lows below |
| 462 | CreatorOVault | stuck `accepted` | Superseded by **480** |
| 463 | ShareOFT + Wrapper | stuck `accepted` | Superseded by **481** |
| 464 | DeploymentBatcher | complete | F-01 + Mediums below; F-03/F-04 SKIP |
| 465 | Registry | complete | High factory scoping = DESIGN; Mediums below |
| 466 | Charm + Ajna | complete | Highs = DESIGN/OPS residual; Mediums below |
| 467 | CreatorGaugeController | complete | Bridged unwrap + Mediums below |
| 468 | ve4626 + bribes | complete | Mediums/Lows below |
| 480 | CreatorOVault resubmit | complete | See `oda-reports/480-TRIAGE.md` — Highs [1],[3] **FIXED** |
| 481 | ShareOFT/Wrapper resubmit | complete | See `oda-reports/481-TRIAGE.md` — [2] **FIXED** |

## P0 / High (prior pass)

- **460-[2]** `return(0,0)` permanent nonReentrant DoS → FIXED
- **467-[1]** Bridged ShareOFT unwrap DoS → FIXED (Creator+Agent)
- **464-F01** Permissionless registry squat → FIXED
- **Critical** `adminModuleCall` → `onlyOwner` already on private tree (`30ca1bfa1`); **public pin still stale**

## Medium / Low / Info — this pass

### Lottery (460 / 461)
| ID | Disposition | Notes |
|----|-------------|-------|
| 460-3 / 461-3 | FIXED | Deviation guard fail-closed |
| 460-5 | FIXED | Multi-vault payout try/catch isolation |
| 460-6 | FIXED | Replay namespaced by origin (BREAKING vs bare keys) |
| 460-7 / 461-2 | FIXED | Pricing decimals normalize |
| 460-9 | FIXED | `renounceOwnership` disabled |
| 460-13 / 461-15 | FIXED | Registry/balanceOf hot-path try/catch fail-closed |
| 460-17 | FIXED | Caller fee refund when `useCallerFunds` |
| 461-5 | FIXED | Eligible-view revert → 0 (no live balanceOf flash path) |
| 461-9 | FIXED | Hub-only integrator peer |
| 461-11 | FIXED | `_lzReceive` emit+return (non-brick) |
| 461-18 | FIXED | Legacy AMOE ECDSA path disabled |
| 461-20 | FIXED | Boost clamp |
| 461-24 | FIXED | VRF empty `randomWords` guard |
| 461-F4 | FIXED | Nonzero V3 `sourceEventId` all lanes |
| 461-F22 | FIXED | Amount ceiling vs mulDiv overflow |
| 461-I34 | FIXED | Local VRF stray `msg.value` refund (not revert) |
| pause-before-grace | FIXED | Defer-while-paused before VRF grace discard |

### Registry (465)
| ID | Disposition | Notes |
|----|-------------|-------|
| 465-3 | FIXED | Canonical wallet: owner or wallet itself |
| 465-4 | FIXED | LZ overlay always applies live maps |
| 465-5 | FIXED | `setCreator` clears canonical wallet + reverse |
| 465-6 | FIXED | Factory codehash re-checked at call time |
| 465-8 | SKIP (EIP-170) | Cross-namespace remote-OFT uniqueness removed for size; same-namespace reverse maps remain |
| zero-checks | FIXED | Ecosystem/token binding zero rejects |

### Gauge (467)
| ID | Disposition | Notes |
|----|-------------|-------|
| 467-2 | FIXED | `lotteryManager` address(0) instant revoke |
| 467-3/4 | FIXED | TWAP floor 1800s; amountOutMinimum-only WETH |
| 467-5 | FIXED | `distributionInterval` capped (30d) |
| 467-6 | FIXED | Fee-tier whitelist |

### Charm / Ajna / adapter (466)
| ID | Disposition | Notes |
|----|-------------|-------|
| 466-3 | FIXED | `setCharmVault` / `setAjnaPool` code+probe validation |
| 466-4 | FIXED | Stale oracle + Ajna debt → fail closed |
| 466-5 | FIXED | Harvest baseline advances on not-ready deposit |
| 466-6 | SKIP | Spot Charm withdraw mins (commented; same CLM source) |
| 466-8 | FIXED | Adapter `min(maxWithdraw)` liquidity mark |
| 466-9 | FIXED | TWAP floor = 1800 (frozen constant; EIP-170) |
| 466-10 | PARTIAL | Oracle rewire owner-gated; **24h timelock dropped for EIP-170** |
| 466-11 | FIXED | Ajna bankrupt LP → 0 |
| 466-12 | FIXED | Withdraw USDC shortfall sizing |
| High sandwich | DESIGN | Spot NAV / rebalance sandwich residual |

### DeploymentBatcher (464)
| ID | Disposition | Notes |
|----|-------------|-------|
| F-01 | FIXED | Creator token control before first `registerToken` |
| F-02 | FIXED | codeId bytecode hash pin at approve + require |
| F-03 / F-04 | SKIP | Finalize redesign deferred |
| F-05 | FIXED | Phase3 `vault.asset()` must match `creatorToken` |
| F-06 | FIXED | First-deposit bounds scaled by token decimals |

### ve4626 / bribes (468)
| ID | Disposition | Notes |
|----|-------------|-------|
| M1 | FIXED | Emergency reset blocked inside 2× freeze window |
| M2 | FIXED | Whitelist / vault / minVotingPower 48h timelocks |
| M3 | SKIP | Trust-model / design |
| L1 | FIXED | Generation-gate clears escrow lock on emergency reset |
| L3 | FIXED | `increaseLock` burns when power drops |
| L8 | FIXED | BribeDepot CEI before transfer |
| L11 | FIXED | `renounceOwnership` disabled (ve / boost / bribes / voting) |
| L14 | FIXED | `extendLock` enforces `MIN_LOCK_DURATION` |
| L18 | FIXED | `permit` reverts |

## EIP-170 size trim (required to ship)

| Contract | Runtime | Margin |
|----------|---------|--------|
| CharmStrategy4626 | ~22.6k | +~2k |
| CharmStrategy4626Factory | ~628 (delegates to Deployer) | large |
| CharmStrategy4626Deployer | ~24.0k | +~0.5k |
| Registry4626 | 24,566 | +10 |
| LotteryManager4626 | 23,932 | +644 |

Size tradeoffs: Charm auto fee-tier discovery removed; TWAP duration frozen; oracle rewire instant; Registry cross-namespace peer uniqueness skipped; view helpers moved to `Registry4626ViewLib`.

## Accepted / not fixed
- Registry multi-factory first-writer bindings (465-[2]) — trust model
- Charm spot NAV / rebalance sandwich Highs — CLM residual
- 464-F03/F04 finalize redesign — deferred
- 466-6 spot withdraw mins — documented SKIP
- 468-M3 trust model — SKIP
- Jobs **462** / **463** — reports not available yet

## Validation (this pass)
```
forge build --sizes                         # exit 0 (no EIP-170 overflow)
forge test --match-path 'test/LotteryManager4626.*'   # 135 passed, exit 0
forge test --match-path 'test/oda/*'                  # 9 passed, exit 0
forge test --match-path 'test/Registry4626*'          # 17 passed, exit 0
forge test --match-path 'test/CreatorGaugeController.t.sol'  # 18 passed, exit 0
forge test --match-path 'test/vault/CharmStrategy*'   # 36 passed, exit 0
forge test --match-path 'test/*ve4626*'               # 102 passed, exit 0
forge test --match-path 'test/LotteryAmoeRouter.ScanM2.t.sol' # 3 passed, exit 0
forge test --match-path 'test/ChainlinkVRFIntegratorV2_5.NonblockingLzReceive.t.sol' # 7 passed, exit 0
```

Known pre-existing / out-of-scope: some `test/DeploymentBatcher.ThreeWaySplit.t.sol` and Phase1EndpointPoisoning failures (error-ordering / fixture "missing code") still fail and are not introduced by the Medium/Low remediation semantics.

## Resubmit 462/463 (2026-07-23)
- Stuck originals remain `in_progress`/`accepted` (no refund path).
- New jobs: **480** (CreatorOVault) → https://onedollaraudit.com/audit/480 ; **481** (ShareOFT/Wrapper) → https://onedollaraudit.com/audit/481

## Jobs 480 / 481 (resubmit complete)

- **480/481 P0 FIXED** in private tree: bond refund soft-fail; self-only cooldown refresh; lottery-entry classifier V3 harden.

- Reports: [480](https://leftclaw.services/result/480.html) · [481](https://leftclaw.services/result/481.html)
- Triage: `oda-reports/480-TRIAGE.md`, `oda-reports/481-TRIAGE.md`
- **Fix next:** vault bond-refund liveness + cooldown grief; ShareOFT lottery-entry classifier

## LeftClaw research

- Commissioned **482** → https://leftclaw.services/jobs/482 ($3 USDC, 2026-07-23)
