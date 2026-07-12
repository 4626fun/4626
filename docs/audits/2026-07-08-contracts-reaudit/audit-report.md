# 4626 Contracts Re-Audit — Findings

- **Report ID:** `4626-CONTRACTS-REAUDIT-2026-07-08`
- **Date:** 2026-07-08
- **Scope:** `contracts/` production Solidity (creator, agent, shared, other/alfaclub)
- **Baseline:** Pass-1 full audit + same-day P0 remediations
- **Method:** Multi-agent deep re-review, line verification of every High claim, Foundry regression on P0 suites

Severity: **Critical** permissionless fund loss / integrity break · **High** permissionless DoS, integrity break, or privilege-gated catastrophic drain · **Medium** misconfig / MEV / incomplete fix · **Low/Info** ops footgun / residual.

---

## P0 baseline (re-verified)

| ID | Finding | Status |
|----|---------|--------|
| C-01 | ShareOFT salt omits creatorToken + adopt rewire | **Fixed** |
| H-01 | Recovery `transferFrom` without allowance | **Fixed** (keeper notify path) |
| H-02 | Hub flash/just-bought coverage | **Fixed on hub** |
| H-03 | AMOE reads lane coin | **Fixed** |

```text
forge test --match-path 'test/audit/Audit20260708.P0.t.sol'     → 9/9
forge test --match-contract CreatorOVaultImpairmentV1Test       → 18/18
forge test --match-contract OVaultRecoveryEscrowTest            → 5/5
forge test --match-path 'test/LotteryManager4626.AmoeLinearParity.t.sol' → 29/29
```

---

## Critical

*None open.* Prior C-01 is closed.

---

## High

### R-H01 — Strategy eject recovery traps funds — **FIXED**

| | |
|--|--|
| **Status** | **Fixed** — see [remediation-rh.md](./remediation-rh.md) |
| **Files** | `OVaultStrategiesModule._ejectStrategyFromList` |

Eject now requires Finalized/Resolved + matching `recoveryAsset`, then push → notify → `totalRecovered += recovered` + `ImpairmentRecoveryNotified`.

---

### R-H02 — Escrow free custody global vs per-asset — **FIXED**

| | |
|--|--|
| **Status** | **Fixed** — see [remediation-rh.md](./remediation-rh.md) |
| **Files** | `OVaultRecoveryEscrow` (`totalUnclaimedRecoveryByAsset`) |

---

### R-H03 — Remote lottery coverage bypasses H-02 — **FIXED**

| | |
|--|--|
| **Status** | **Fixed** — see [remediation-rh.md](./remediation-rh.md) |
| **Files** | `CreatorShareOFT` / `AgentShareOFT` queue; hub `_handleLotteryEntry` |

---

### H-04 — CCA `migrate()` permanently griefable — **FIXED**

See [remediation-p1.md](./remediation-p1.md). Pool-key rotation on grief.

---

### NEW-H — Phase deploy accepts unallowlisted bytecode codeIds — **FIXED**

See [remediation-p1.md](./remediation-p1.md). On-chain `approvedCodeIds` + freeze.

---

### H-06 — Unbacked ShareOFT mint (OPEN, privilege)

`CreatorShareOFT.mint` / `onlyVaultOrMinter` — no vault-share backing check. Compromised minter/owner inflates ■.

---

### H-07 — Charm owner emergency drain (OPEN, privilege)

`ownerEmergencyWithdrawFromCharm` leaves assets on strategy; `setActive(false)` then `ownerEmergencyWithdraw` to owner. Strategy owner can rug sleeve.

---

### H-08 — Phase module hot-swap optional codehash — **FIXED**

See [remediation-p1.md](./remediation-p1.md). Non-zero codehash approval is mandatory for `setPhase1Module` / `setPhase2Module` / `wireDeploymentHelpers`.

---

### R-H04 — Instant `setLocalVRFConsumer` (OPEN, privilege)

| | |
|--|--|
| **Files** | `LotteryManager4626AdminModule.setLocalVRFConsumer` |
| **Confidence** | High |

No timelock (unlike VRF coordinator 2-day path). Compromised owner points consumer at a rig → deterministic local wins.

---

### R-H05 — Multi-vault jackpot design (OPEN, economic)

| | |
|--|--|
| **Files** | `LotteryManager4626._payoutLocalJackpotInner` |
| **Confidence** | High |

Any win skims default **69%** of **every** active vault’s jackpot. Cross-subsidy / cheap-entry extraction of rich vaults. Product design risk, not a coding bug.

---

## High partial

### H-05 — Charm withdraw (PARTIALLY FIXED)

Main `withdraw` now sizes in ASSET-denominated NAV and applies `depositSlippageBps` mins (~L952–969). Residuals: emergency paths still `minOut=0`; uncapped `depositSlippageBps`; stale oracle understates USDC leg.

---

## Medium (selected open)

| ID | Title | Location |
|----|--------|----------|
| **M-01** | Impairment challenge not public | `CreatorOVault.challengeImpairmentRoot` |
| **M-02** | `strategyMaxAssets` default uncapped | vault modules |
| **M-03** | ShareOFT `convertToAssets` ignores 1000× | `CreatorShareOFT` |
| **M-04** | Queue claim at claim-time PPS | core module |
| **M-05** | External swap arbitrary call | payout / agent routers |
| **M-06** | Remote oracle no deviation clamp | `CreatorOracle._lzReceive` |
| **M-07** | Solana lottery = trusted keeper | `SolanaBridgeAdapter` |
| **M-08** | Registry live rebind | `Registry4626` |
| **M-09** | CCA residual sweeps vacuum LP inventory | `CCALaunchArmConfigModule` |
| **M-10** | LP manager zero-slippage burns | `OVaultLPManager` |
| **M-11** | Local VRF no callback retry | `VRFConsumer4626` |
| **M-12** | Winner callback uses vault **count** as “shares paid” | `_payoutLocalJackpot` |
| **M-13** | Bribe permissionless rollover confiscates late claims | `BribeDepot` |
| **M-14** | Ajna buffer-only withdraw grief | `AjnaERC4626Vault` |
| **M-15** | `resetPhase1State` does not require `!finalized` | `DeploymentBatcher` |
| **M-NEW-01** | Uniswap payout path allows `minOut == 0` | `CreatorPayoutRouter._convertAndQueue` |
| **M-NEW-02** | Eject asset may ≠ epoch.recoveryAsset | strategies eject vs claims |
| **M-NEW-03** | Remote ShareOFT registry single reverse map | multi-chain lottery availability |

---

## Low / Informational

- Wrapper convenience deposit/withdraw without minOut  
- `riskConfigDelay` can be 0  
- Infinite strategy / LP manager approvals  
- Linear vesting pre-seed donation  
- Burn stream catch-up PPS jumps  
- ve4626 boost uses non-decaying total; `burnExpiredLock` incomplete lock clear  
- Solana relay always passes coverage `0` (under-boost, not inflate)  
- AlfaClub: donation-resistant; no post-deploy pool admin; no critical found  
- Module storage versioned but manual  

---

## Hardened areas (still solid)

ERC-4626 inflation defenses · same-block exit cooldowns · locked profit · strategy best-effort withdraws · gauge immutable BPS + jackpot emergency guards · ShareOFT fee CEI · burn stream no-owner · hub oracle deviation caps · CREATE2 deployer allowlists · hub lottery coverage (H-02) · AMOE ShareOFT (H-03) · ShareOFT salt scoping (C-01) · keeper notify recovery (H-01 primary path)

---

## Trust model (TCB)

Protocol treasury · vault owner/management/keepers · VRF consumer / AMOE relayer · Solana entry keepers · strategy owners · ShareOFT minters · phase bytecode store consumers  

Production should use Safe + timelocks; freeze phase modules and pin codeIds after cutover.

---

## Recommended fix order

| P | Items |
|---|--------|
| **P0** | **R-H01** eject `totalRecovered`; **R-H02** per-asset escrow free; **R-H03** remote eligible coverage |
| **P1** | **H-04** CCA migrate; **NEW-H** codeId allowlist; **H-08** mandatory module codehash |
| **P2** | **H-07** emergency → vault only; **H-05** residuals; **R-H04** VRF consumer timelock; **M-09** residual sweep guards |
| **P2** | Product decision on **R-H05** multi-vault jackpot; Medium backlog |

---

## Out of scope

- Solana program `creator-share-hook` (prior July-2 forgery if `relay_entries` on)  
- Frontend/API/KPR  
- Full-suite ~35 pre-existing Foundry failures (oracle HubOnly harness, lottery sponsorship, etc.) — not introduced by P0 pass  

---

## Bottom line

**Pass-1 P0s hold on their intended paths.** Re-audit finds **no open Critical**, but **new Highs created or exposed by the recovery free-custody model and incomplete remote coverage parity**, plus prior open Highs (CCA grief, bytecode codeIds, privilege drains). Treat R-H01/R-H02/R-H03 as the next mandatory remediation set before relying on impairment recovery or remote lottery at scale.
