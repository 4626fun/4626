# Security Audit Report — 4626 `/contracts`

**Date:** 2026-07-01  
**Scope:** All 103 `.sol` files under `contracts/` (~26,835 LOC)  
**Compiler:** Solidity 0.8.30, `via_ir`, EVM Cancun  
**Remediation:** See [remediation.md](./remediation.md)

---

## Contracts analyzed

| Domain | Key contracts |
|--------|----------------|
| ERC-4626 vault | `CreatorOVault`, modules (`Core`/`Admin`/`Strategies`), `CreatorOVaultWrapper`, impairment/escrow |
| Strategies | `CCALaunchStrategy`, `ERC4626StrategyAdapter`, `SolanaStrategy`, `SolanaBridgeStrategy` |
| Lottery / gauge / oracle | `CreatorLotteryManager`, `CreatorGaugeController`, `CreatorOracle`, `VoterRewardsDistributor` |
| ve(3,3) | `ve4626`, `ve4626BoostManager`, `VaultGaugeVoting`, `BribeDepot` |
| Cross-chain | `CreatorShareOFT`, `OVaultHubComposer`, `SolanaBridgeAdapter` |
| Deploy / periphery | `DeploymentBatcher`, `PayoutRouter`, `VaultShareBurnStream`, `CreatorRegistry`, factories, alfaclub |

**Architecture:** Hub-centric (Base); vault uses **delegatecall modules** with `MODULE_STORAGE_VERSION` gate; jackpot **custody** (`CreatorGaugeController`) vs **authority** (`CreatorLotteryManager`) correctly split.

---

## Findings summary

| Severity | Count (original) | Fixed in code | Partial / deferred |
|----------|------------------|---------------|---------------------|
| Critical | 0 | — | — |
| High | 7 | 5 | 2 |
| Medium | 18 | 9 | 9 |
| Low | ~20 | 4 | ~16 |
| Informational / Gas | ~16 | 0 | documented |

**Overall risk (pre-fix):** Medium  
**Overall risk (post-fix):** Medium-Low (with deploy checklist + deferred items tracked)

---

## High findings (detail)

### H-01 — `report()` zero-baseline profit mis-accounting

**Contract/File:** `contracts/vault/modules/CreatorOVaultCoreModule.sol:704-744`  
**Description:** When `totalAssetsAtLastReport == 0` but `_totalSupply > 0`, next `report()` treated full NAV as profit.  
**Impact:** Performance/management fees and profit-lock minting on residual NAV; keeper-triggerable.  
**Recommendation:** Reset baseline with zero profit (implemented).  
**Status:** **Fixed**

### H-02 — VRF cherry-pick while paused

**Contract/File:** `contracts/utilities/lottery/CreatorLotteryManager.sol:813-849`  
**Description:** Owner could selectively `processPendingVrfResult` after reading public `pendingRandomWord`.  
**Impact:** Lottery fairness / censorship.  
**Recommendation:** FIFO flush all deferred results on `unpause()` (implemented).  
**Status:** **Fixed**

### H-03 — Emergency reset bribe over-claim

**Contract/File:** `VaultGaugeVoting.sol:434-436`, `BribeDepot.sol:115-128`  
**Description:** `emergencyResetAllVotes` cleared aggregates but not per-user weights; bribe claims used stale weight.  
**Impact:** Bribe pool theft after emergency reset.  
**Recommendation:** Generation check in `getUserVoteWeightAtEpoch` (implemented).  
**Status:** **Fixed**

### H-04 — `getPastVotes` clock / historical state

**Contract/File:** `contracts/governance/ve4626.sol:454-490`  
**Description:** `ERC20Votes` default block clock vs timestamp lock math; reads current lock not historical.  
**Impact:** Broken if wired to OZ Governor; gauge path uses `votingPowerAt` instead.  
**Recommendation:** Timestamp `clock()` (implemented); full lock checkpoints still needed for true historical queries.  
**Status:** **Partial**

### H-05 — Permissionless vesting `seed()`

**Contract/File:** `contracts/utilities/vesting/CreatorLinearVesting.sol:46-53`  
**Description:** One-shot `seed()` fixed `totalAllocation` from any caller.  
**Impact:** Griefing/bricking 30% creator vesting allocation.  
**Recommendation:** Restrict to `seeder`; batcher calls `seed()` atomically (implemented).  
**Status:** **Fixed**

### H-06 — Remote lottery entry routing

**Contract/File:** `CreatorShareOFT.sol:734-758, 861-886`  
**Description:** Remote entries sent to hub ShareOFT peer; no handler before `super._lzReceive`.  
**Impact:** Cross-chain lottery entries fail after LZ delivery.  
**Recommendation:** Hub ShareOFT forwards to `receiveRemoteLotteryEntry` (implemented); requires `setAuthorizedHubShareOftForwarder` at deploy.  
**Status:** **Fixed** (config required)

### H-07 — `PayoutRouter.emergencyWithdraw`

**Contract/File:** `contracts/utilities/routers/PayoutRouter.sol:305-317`  
**Description:** Owner could drain creator-coin / ShareOFT revenue.  
**Impact:** Centralization / rug vector.  
**Recommendation:** Block core payout tokens (implemented); timelock/multisig still required operationally.  
**Status:** **Partial**

---

## Medium findings (summary)

| Finding | Status |
|---------|--------|
| Gauge emergency withdraw drains jackpot | **Fixed** — `JackpotReserveProtected` |
| Concurrent wins over-commit reserve | **Deferred** |
| `injectCapital` baseline | **Fixed** |
| Operator bitmask not enforced | **Deferred** |
| `maxWithdraw` liquidity honesty | **Deferred** |
| Suspect mode queued claims | **Fixed** |
| Base sequencer oracle check | **Deferred** |
| Auto TWAP `answeredInRound` | **Fixed** |
| `notifyRewards` DoS | **Fixed** |
| Zero mesh compose peers | **Fixed** |
| Solana relay premature consume | **Fixed** |
| Composer/OFT stuck funds | **Partial** |
| SolanaStrategy remote NAV | **Deferred** |
| Voter reward sweep centralization | **Deferred** |
| Boost timelock not armed | **Deferred** (deploy script) |
| Activation batcher registry | **Deferred** |
| Hot-swappable deploy modules | **Deferred** (ops) |
| ERC4626 adapter silent deposit | **Fixed** |

Full Low / Informational / Gas items unchanged from review; see [remediation.md](./remediation.md).

---

## Key strengths

1. Delegatecall module storage gated by `MODULE_STORAGE_VERSION` — no layout divergence found vs OZ 5.4 bases.
2. Reentrancy: guarded vault paths use `_delegateAndReturn` (preserves `nonReentrant` epilogue).
3. ERC-4626 inflation defenses: virtual offset, min first deposit, tracked `coinBalance`, PPS guards.
4. Jackpot custody/authority split enforced (`OnlyLotteryManager` on `payJackpot`).
5. Immutable fee splits validated at gauge construction (`10_000` bps).
6. LayerZero compose: endpoint-only + allowlisted senders + balance-delta invariants.
7. Extensive prior hardening visible (`FIX: CLM-*`, `G-*`, `H-*` tags throughout).

---

## High-priority before production

1. Complete [post-deploy checklist](./remediation.md#post-deploy-checklist-required-for-h-06) for hub lottery forwarding.
2. Run full `forge test` + add regression tests listed in remediation doc.
3. Arm lottery boost timelock (`armBoostSourceTimelock()`) before live traffic.
4. Multisig + timelock on all `onlyOwner` surfaces (gauge, payout router, batcher treasury).
5. Resolve **Partial** H-04 (ve historical checkpoints) before any OZ Governor integration.

---

## Further testing recommendations

- **Unit:** report baseline edges, emergency reset → bribe, deferred VRF unpause, vesting seed auth, lottery forward.
- **Fuzz:** ERC-4626 round-trip; fee-split dust; VRF modulo distribution.
- **Invariant:** `jackpotReserve` only decreases via `payJackpot`; bribe pool conservation across reset/claim.
- **Fork:** Base mainnet lottery + oracle + compose paths.
- **Static:** Slither on changed files; `scripts/security-audit-local.sh`.

---

## Validation log

| Command | When | Result |
|---------|------|--------|
| `forge build` | Pre-fix baseline | Pass |
| `forge build` | Post-remediation | Pass |
| `forge test` | — | Not run in this pass |
