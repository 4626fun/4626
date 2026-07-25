# ODA jobs 496–498 remediation

**Sources:** [job 496](https://leftclaw.services/jobs/496) / [497](https://leftclaw.services/jobs/497) / [498](https://leftclaw.services/jobs/498) (HTML: `/result/{id}.html`); local copies under `oda-reports/`.

**Branch:** `fix/oda-496-498-remediations` (private `main` already held most 496 lottery remediations from #801).

## Scored findings

| ID | Severity (report) | Disposition |
|----|-------------------|-------------|
| ODA-496-1 | High | **Done (pre-existing):** transient `_jackpotPayoutGate` on `payoutLocalJackpot` — only `_payoutLocalJackpot` can open the gate. |
| ODA-496-2 | High | **Done (pre-existing):** `LotteryManager4626PricingLib` fair-EV prize cap (`fairEvFeeBps` × fee proxy / win chance). Residual economic design risk tracked as ops review, not an open code hole. |
| ODA-496-3 | Medium | **Done (pre-existing):** VRF result relay permissionless while unpaused (`VRFConsumer4626` / LM #801). |
| ODA-496-4 | Medium | **Done (pre-existing):** hub `vrfResultGracePeriod` default **1 hour** (aligned with spoke keep-alive). |
| ODA-496-5 | Medium | **Done (pre-existing):** AMOE `try/catch` around `consumer.recordAmoeEntry`. |
| ODA-496-6 | Low | **Done (pre-existing):** PricingLib always enforces deviation vs last reference and widens band with age; no silent disable on stale ref. |
| ODA-497-1 | High | **Done (pre-existing):** `OVaultImpairmentClaims` soulbound (`ClaimTransferDisabled` on non-mint/burn transfers). |
| ODA-497-2 | High | **Fixed this branch:** `proposeImpairmentRoot` reverts if unlock ≥ stale deadline; `clearStaleImpairmentTrip` reverts if `snapshotRoot != 0`. |
| ODA-497-3 | Medium | **Fixed this branch:** `report()` requires `VaultMode.Normal`. |
| ODA-497-4 | Medium | **Fixed this branch:** share burns decrement report baseline by cost basis (`_decreaseReportBaselineForShareBurn`). |
| ODA-497-5 | Medium | **Fixed this branch:** `queueWithdrawal` / `claimQueuedWithdrawal` honor `paused`. |
| ODA-498-1 | High | **Fixed this branch:** cooldown follows hot ShareOFT units, so pre-seeded recipients cannot launder them while unsolicited dust cannot freeze older cooled balances. |
| ODA-498-2 | Medium | **Fixed this branch:** `flushFees` requires `composeMsg.length == 0`. |
| ODA-498-3 | High | **Fixed this branch:** dust folded into unwrap only when `accountingUser == burnFrom` (blocks operator siphon; dust may remain until a self-unwrap path — accepted residual). |
| ODA-498-4 | Medium | **Fixed this branch:** `unwrap` calls `_requireSynchronousRedemption`. |

## Leads / informational (disposition)

### Job 496
| Lead | Disposition |
|------|-------------|
| `renounceOwnership` on VRF consumer / integrator | **Already fixed** — both override to pure revert. |
| LZ fee buffer refund to `owner()` | **Already fixed** — `relayPendingResponse` refunds `msg.sender`. |
| AMOE buyer binding low-160 | **Already fixed** — full-width equality vs zero-extended address. |
| VRF rotation strands in-flight / deferred-VRF asymmetry / AMOE relayer revoke | **Accepted residual** — owner/timelock ops; document in runbooks; no code change this pass. |

### Job 497
| Lead | Disposition |
|------|-------------|
| Warm-wallet cooldown carve-out | **Accepted design** — anti-grief vs flash-loan tradeoff; PPS guards remain. |
| `notifyImpairmentRecovery` amount trust + baseline | **Partial:** baseline helper for share burns fixed; recovery still keeper-trusted (role assumption). |
| Per-tx large-withdrawal split / valuation fail-open on redeem | **Accepted residual** — needs broader queue accounting redesign; not in this diff. |

### Job 498
| Lead | Disposition |
|------|-------------|
| Lottery inbound peer allowlist | **Accepted residual** — LZ `peers` auth is owner-gated; defense-in-depth follow-up. |
| Raw `approve` on Creator Coin | **Fixed this branch** — `forceApprove` in constructor + `refreshApproval`. |
| `flushFees` reconstruct SendParam / dust strand / one-shot bindings / Ownable | **Partial:** compose blocked; remaining are ops/UX residuals. |
| Async gate fail-open on vault staticcall failure | **Accepted residual** — separate from unwrap gap (498-4). |

## Code touchpoints (this branch)

- `contracts/creator/vault/modules/CreatorOVaultCoreModule.sol` — 497-2/3/4/5
- `contracts/creator/vault/CreatorOVault.sol` — matching 497-2 errors + NatSpec
- `contracts/creator/vault/CreatorOVaultWrapper.sol` — 498-1/3/4 + forceApprove
- `contracts/creator/vault/CreatorShareOFT.sol` — 498-2
- `test/CreatorOVault.ImpairmentV1.t.sol`, `test/oda/ODA480_481_P0.t.sol` — 497-2 behavior

## Validation

```bash
forge test --match-contract CreatorOVaultImpairmentV1Test -vv
forge test --match-path test/oda/ODA480_481_P0.t.sol -vv
forge test --match-contract CreatorOVaultWrapperTest -vv
forge test --match-contract CreatorShareOFTRemoteFeeFlushCommandTest -vv
```
