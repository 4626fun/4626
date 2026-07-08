# 4626 Contracts Full Audit — Findings

- **Report ID:** `4626-CONTRACTS-2026-07-08`
- **Date:** 2026-07-08
- **Scope:** `contracts/` production Solidity (creator, agent, shared, other/alfaclub)
- **Method:** Multi-agent source review → critical-path line verification → Foundry PoCs

Trusted roles: **protocol treasury / batcher owner**, **vault owner / management / keepers**, **VRF consumer / AMOE relayer**, **Solana entry keepers**, **strategy owners**, **ShareOFT minters**. Severity accounts for whether a path is permissionless vs privilege-gated.

---

## Critical

### C-01 — ShareOFT CREATE2 salt omitted `creatorToken` (FIXED)

| | |
|--|--|
| **Status** | **Fixed** (this pass) |
| **Files** | `DeploymentBatcherUtilsHelper.deriveShareOftSalt`; phase-1 adopt-on-fail path |
| **Confidence** | High |

**Description:** Salt was `keccak(owner, symbolLower)` + version label. Same owner + symbol + version for two creator tokens collided. On CREATE2 fail, phase-1 **adopted** existing code and called `setVault` / `setMinter`, rewiring a foreign ShareOFT.

**Impact:** Cross-vault ShareOFT / mesh / lottery contamination.

**Fix shipped:**
1. Salt now `keccak(creatorToken, owner, symbolLower)` + version.
2. Adopt-on-fail only if `vault() == 0` or `vault() == thisVault`; else `Phase1ShareOFTAlreadyBound`.
3. Frontend `deriveShareOftSaltFromVersion` and Telegram deploy path updated.
4. Legacy helper `deriveShareOftSaltLegacy` retained for historical reconstruction.

**PoC:** `Audit20260708_C01_ShareOftSalt` in `test/audit/Audit20260708.P0.t.sol`.

---

## High

### H-01 — Impairment recovery always reverted (FIXED)

| | |
|--|--|
| **Status** | **Fixed** (this pass) |
| **Files** | `OVaultRecoveryEscrow.notifyRecovery`; callers in `CreatorOVaultCoreModule` / `OVaultStrategiesModule` |
| **Confidence** | High (was red in Foundry) |

**Description:** Vault **pushed** tokens then escrow `transferFrom` without allowance → `ERC20InsufficientAllowance`.

**Impact:** Side-pocket recovery non-functional after impairment finalize.

**Fix shipped:** Escrow credits free custody only (`held - totalUnclaimedRecovery`); reverts `InsufficientRecoveryCustody` if vault did not push first.

**Validation:** `CreatorOVaultImpairmentV1Test` 18/18; `OVaultRecoveryEscrowTest` 5/5; PoC suite H-01.

---

### H-02 — Lottery coverage flash-loanable via live ShareOFT balance (FIXED)

| | |
|--|--|
| **Status** | **Fixed** (this pass) |
| **Files** | `LotteryManager4626.processSwapLottery`; `CreatorShareOFT` / `AgentShareOFT` coverage snapshot |
| **Confidence** | High |

**Description:** Coverage used post-buy `balanceOf(buyer)` with no holding period. Flash-borrowed ShareOFT + aged ve lock inflated win PPM (up to maxWinChance). Wins draw 69% of active vault jackpots.

**Fix shipped:**
1. ShareOFT snapshots pre-mutation balance once per block (`balanceEligibleForLotteryCoverage`).
2. Manager uses reported eligible balance, capped by live pre-buy max (`live - amountIn`).
3. ShareOFT lottery trigger passes eligible (not post-buy) balance.

**PoC:** `test_PoC_sameBlockFlashShare_doesNotInflateCoverage`, `test_PoC_justPurchasedAmount_excludedFromCoverage`.

---

### H-03 — AMOE coverage read lane token, not ShareOFT (FIXED)

| | |
|--|--|
| **Status** | **Fixed** (this pass) |
| **Files** | `LotteryManager4626.processAmoeEntry` |
| **Confidence** | High |

**Description:** AMOE used `IERC20(token).balanceOf(buyer)` (creator/agent coin) while product intent is ShareOFT coverage parity with paid path.

**Fix shipped:** Resolve ShareOFT via registry; use `balanceEligibleForLotteryCoverage` when available.

**PoC:** `test_PoC_amoeCoverage_usesShareOftNotLaneCoin`.

---

### H-04 — CCA `migrate()` grief via V4 pool init front-run (OPEN)

| | |
|--|--|
| **Status** | Open |
| **Files** | `CCALaunchArm.migrate` (~L719–728) |
| **Confidence** | High |

Third party can `initialize(key, wrongSqrtPrice)` once; migrate reverts forever for that key. LP reserve / ETH stuck until owner emergency.

**Recommendation:** Pre-init under control, alternate pool key on mismatch, or first-mint price band.

---

### H-05 — Charm withdraw zero minOut + bad share math (OPEN)

| | |
|--|--|
| **Status** | Open |
| **Files** | `CharmStrategy4626.withdraw` (~L956–964) |
| **Confidence** | High |

`charm0 + charm1` mixes units; `withdraw(..., 0, 0, …)` sandwichable.

---

### H-06 — ShareOFT unlimited mint without vault-share backing (OPEN, privilege)

| | |
|--|--|
| **Status** | Open |
| **Files** | `CreatorShareOFT.mint` / minter role |
| **Confidence** | High |

Compromised minter/owner can mint unbacked ■.

---

### H-07 — Charm owner emergency drain path (OPEN, privilege)

| | |
|--|--|
| **Status** | Open |
| **Files** | `CharmStrategy4626.ownerEmergencyWithdrawFromCharm` + deactivate |
| **Confidence** | High |

---

### H-08 — Phase module hot-swap with optional codehash (OPEN, privilege)

| | |
|--|--|
| **Status** | Open |
| **Files** | `DeploymentBatcher._validatePhaseModuleCodehash` |
| **Confidence** | High |

---

## Medium (open)

| ID | Title | Location |
|----|--------|----------|
| M-01 | Impairment root challenge not public | `CreatorOVault.challengeImpairmentRoot` |
| M-02 | `strategyMaxAssets` defaults uncapped | vault modules |
| M-03 | ShareOFT `convertToAssets` ignores 1000× normalization | `CreatorShareOFT` ~L1336 |
| M-04 | Queued withdrawal claims at claim-time PPS | core module |
| M-05 | External swap = arbitrary call to allowlisted targets | payout / agent routers |
| M-06 | Oracle remote receive lacks deviation clamp | `CreatorOracle._lzReceive` |
| M-07 | Solana lottery entries = trusted keeper attestation | `SolanaBridgeAdapter` |
| M-08 | Registry can rebind live vault/ShareOFT/gauge | `Registry4626` |
| M-09 | CCA residual sweeps can vacuum LP inventory | `CCALaunchArm` config |
| M-10 | OVaultLPManager zero-slippage burns | `OVaultLPManager` |
| M-11 | Local VRF callback no retry | `VRFConsumer4626` |
| M-12 | Instant owner swap of VRF consumer / AMOE relayer | `LotteryManager4626` |
| M-13 | Permissionless bribe epoch rollover grief | `BribeDepot` |
| M-14 | Ajna buffer-only withdraw grief | `AjnaERC4626Vault` |
| M-15 | Multi-phase deploy non-atomic / powerful reset | `DeploymentBatcher` |

## Low / Informational

- Wrapper convenience deposit/withdraw without minOut  
- `riskConfigDelay` can be set to 0  
- Infinite strategy approvals  
- Linear vesting pre-seed donation  
- Burn stream catch-up PPS jumps  
- Module storage versioning careful but manual  
- AlfaClub: no post-deploy pool admin; docs may overstate fee splits  
- ve4626 `burnExpiredLock` leaves stale lock struct  
- Negligible VRF modulo bias  

---

## Hardened areas (strengths)

ERC-4626 inflation defenses, same-block exit cooldowns, locked profit reporting, strategy best-effort withdraws, gauge immutable BPS + jackpot protection, ShareOFT fee CEI + fail-closed gauge delivery, burn stream no-owner design, oracle hub deviation caps, CREATE2 deployer allowlists, AlfaClub factory-gated pools without admin.

---

## Out of scope

- Solana `creator-share-hook` (July-2 C-01 forgery if `relay_entries` enabled)  
- Frontend/API/KPR trust boundaries  
- Formal verification / economic simulation of multi-vault jackpot draw  

---

## Baseline test suite note

At audit time, full `forge test` reported **~882 pass / ~35 fail** (oracle HubOnly harness, lottery sponsorship, burn-stream fuzz, AlfaClub precision, seed registry drift). Those failures are **not claimed fixed** by this pass. P0-related suites above are green.
