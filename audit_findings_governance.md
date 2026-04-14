# Security Audit: 4626 Governance Contracts

**Audit Date:** 2025  
**Contracts Reviewed:**
1. `CreatorGaugeController.sol` (1043 lines)
2. `VaultGaugeVoting.sol` (433 lines)
3. `VoterRewardsDistributor.sol` (280 lines)
4. `ve4626.sol` (387 lines)
5. `ve4626BoostManager.sol` (153 lines)
6. `bribes/BribeDepot.sol` (185 lines)

**Solidity Version:** `^0.8.20`

---

## Summary Table

| ID | Contract | Severity | Title |
|----|----------|----------|-------|
| G-01 | ve4626 | CRITICAL | Voting power not reduced on lock expiry — stale ve4626 ERC20 balance enables ghost votes |
| G-02 | ve4626 | CRITICAL | `_totalVotingSupply` permanently inflated after lock expiry without unlock |
| G-03 | VaultGaugeVoting | HIGH | Vote weight not invalidated after veToken lock expires mid-epoch |
| G-04 | VoterRewardsDistributor | HIGH | `notifyRewards` called during current epoch — rewards for epoch N are allocated before epoch N votes are finalized |
| G-05 | BribeDepot | HIGH | `rolloverExpiredEpoch` double-counts rolled amount against live `totalBribes` — overclaims possible |
| G-06 | VaultGaugeVoting | HIGH | `emergencyResetAllVotes` orphans user-internal vote accounting, causing permanent underflow risk |
| G-07 | ve4626 | HIGH | Voting power decay not reflected in ERC20Votes checkpoints — delegated balances are stale |
| G-08 | VaultGaugeVoting | MEDIUM | Rounding loss in `normalizedWeight` computation allows weight to silently floor to zero |
| G-09 | VaultGaugeVoting | MEDIUM | Vote manipulation via same-block `lock → vote` sandwich before any block-delay guard |
| G-10 | VoterRewardsDistributor | MEDIUM | `recoverVaultRewardToken` can remap token mid-epoch, making old-epoch rewards unclaimable |
| G-11 | CreatorGaugeController | MEDIUM | `receiveBridgedFees` accounts balance vs `pendingFees` only — `jackpotReserve` held in vault shares, not OFT, so the accounting comment is misleading and fragile |
| G-12 | CreatorGaugeController | MEDIUM | Oracle slippage protection silently falls to zero — swap proceeds with `minAmountOut = 0` |
| G-13 | ve4626BoostManager | MEDIUM | `setBoostParameters` permanently locks after single call — no recovery path |
| G-14 | BribeDepot | MEDIUM | Bribes can be deposited into the current epoch with zero vault whitelist check — deposits for de-listed/never-listed vaults are locked |
| G-15 | CreatorGaugeController | MEDIUM | `emergencyWithdraw` drains `jackpotReserve` vault shares without adjusting the accounting variable |
| G-16 | VaultGaugeVoting | LOW | `timeUntilNextEpoch` returns `0` before genesis — used in lock expiry guard, allows pre-genesis votes |
| G-17 | ve4626 | LOW | `lock` error message says "Must use increaseLock" but revert is `NoExistingLock()` — incorrect guard logic |
| G-18 | VoterRewardsDistributor | LOW | Unclaimed rewards for epochs with votes are permanently locked after the grace window (no non-zero sweep path) |
| G-19 | CreatorGaugeController | LOW | `distribute()` permissionlessly callable but bypassed by `forceDistribute` — interval can be permanently circumvented by owner |
| G-20 | ve4626BoostManager | LOW | Flash-loan block-delay protection (`MIN_HOLDING_BLOCKS = 10`) is trivially defeated by waiting ~2 minutes |
| G-21 | BribeDepot | LOW | `rolloverZeroVoteEpoch` missing `rolloverGraceEpochs` check — anyone can immediately roll zero-vote epochs |
| G-22 | ve4626 | INFO | `extendLock` never decreases ve4626 balance — old power can only increase, never correct downward on same lock |
| G-23 | VaultGaugeVoting | INFO | `checkpoint()` only checkpoints `current - 1` — skipped epochs (e.g. no-activity gaps) are never checkpointed |
| G-24 | CreatorGaugeController | INFO | Fee split constants sum to 10000 bps only when `creatorShareBps = 0`; any future non-zero value breaks the identity |

---

## Detailed Findings

---

### G-01 — CRITICAL: Voting power not reduced on lock expiry — stale ve4626 ERC20 balance enables ghost votes

**Contract:** `ve4626.sol`  
**Lines:** 263–269, 304–308, 370–372

**Code Snippet:**
```solidity
// L263-269
function _calculateVotingPower(uint256 amount, uint256 lockEnd) internal view returns (uint256) {
    if (block.timestamp >= lockEnd) return 0;
    uint256 duration = lockEnd - block.timestamp;
    return (amount * duration) / MAX_LOCK_DURATION;
}

// L304-308
function votingPower(address user) public view returns (uint256) {
    Lock memory userLock = _locks[user];
    if (userLock.amount == 0) return 0;
    return _calculateVotingPower(userLock.amount, userLock.end);
}
```

**Issue:**  
`votingPower()` / `getVotingPower()` correctly return 0 after lock expiry. However, `ve4626` inherits `ERC20Votes`, and the **ERC20 balance** (minted at `lock()` / `increaseLock()` / `extendLock()`) is **never burned** until the user explicitly calls `unlock()`. This means:

1. Any consumer that reads `balanceOf(user)` instead of `getVotingPower(user)` sees a non-zero balance forever.
2. `ERC20Votes` checkpoints are driven by the ERC20 balance, not by `_calculateVotingPower`. After expiry the ERC20 balance remains, making `getPastVotes()` stale.
3. The non-transferable override only prevents trading; the inflated balance still participates in any ERC20Votes–based governance snapshot.

**Attack Scenario:**  
User locks 1,000 tokens for 1 week (minimum). Lock expires. User does not call `unlock()`. Any governance module reading `balanceOf` sees the user still has voting weight. If a secondary governance module (e.g., an on-chain proposal system) queries `balanceOf` or `getPastVotes`, the expired locker retains full vote power at the time they locked, with no decay.

**Recommended Fix:**  
Either:
- Override `_update` to return 0 for expired lockers (not straightforward with ERC20Votes), or
- At lock expiry, trigger a burn checkpoint. A keeper function `burnExpiredLock(address user)` that burns the balance and updates `_totalVotingSupply` should be added, or
- Replace the ERC20-balance-based token with a purely view-based voting power system that does not use ERC20 balances, and avoid inheriting `ERC20Votes` (which relies on transferable balance semantics).

---

### G-02 — CRITICAL: `_totalVotingSupply` permanently inflated after lock expiry without unlock

**Contract:** `ve4626.sol`  
**Lines:** 154, 184, 220, 244, 323–325

**Code Snippet:**
```solidity
// L323-325
function getTotalVotingPower() external view override returns (uint256) {
    return _totalVotingSupply;
}
```

**Issue:**  
`_totalVotingSupply` is incremented on mint and decremented only in `unlock()`. If a user's lock expires and they never call `unlock()`, their contribution to `_totalVotingSupply` is never removed.

`ve4626BoostManager.calculateBoostWithProtection` uses `getTotalVotingPower()` as the denominator to calculate `scaledShare`:

```solidity
// ve4626BoostManager.sol L89
uint256 scaledShare = Math.mulDiv(userPower, BOOST_PRECISION, totalPower);
```

If many users let locks expire without unlocking, `totalPower` grows artificially large, and all active lockers receive artificially small boosts. In the extreme (all historical lockers never unlock), `scaledShare → 0` and everyone receives only `baseBoost` (1.0x), defeating the entire ve incentive.

**Attack Scenario:**  
Attacker creates many small ve4626 locks using ephemeral addresses (or has Sybil accounts), waits for them to expire, and never calls `unlock()`. The denominator inflates permanently, diluting all honest lockers' boost multipliers.

**Recommended Fix:**  
Add a `burnExpiredLock(address user)` permissionless function that subtracts the expired user's balance from `_totalVotingSupply` and burns their ERC20 balance. Alternatively, track `_totalVotingSupply` as the sum of all active locked amounts weighted by time (a running integral), expiring naturally — but this requires a proper checkpoint system similar to Curve's VotingEscrow.

---

### G-03 — HIGH: Vote weight not invalidated after ve4626 lock expires mid-epoch

**Contract:** `VaultGaugeVoting.sol`  
**Lines:** 167–219, 228–243

**Code Snippet:**
```solidity
// L173
if (ve4626.getRemainingLockTime(msg.sender) < timeUntilNextEpoch()) revert LockExpiresBeforeEpochEnd();
```

**Issue:**  
Votes are cast using `userPower` at the instant of the call. The normalized weight stored in `_epochVaultVotes` is **static** — it never decays as the lock approaches expiry. Furthermore, while the lock-expiry guard at L173 prevents voting if a lock expires *before the end of the current epoch*, it does not handle multi-epoch votes: a lock set to expire at `end of current epoch + 1 second` passes the guard but can vote in the next epoch simply by calling `vote()` again (since the guard rechecks against `timeUntilNextEpoch()` at that future call time, and the lock might still hold by then).

The deeper issue is that user voting power returned by `getVotingPower` is a live, decaying value, but the votes stored in `_epochVaultVotes` reflect the power *at the time of voting*, not at epoch close. A voter who voted at the start of the epoch with 100 units of power (lock almost expiring) and one who voted at the end with 100 units of power (fresh 4-year lock) contribute identically to the epoch tally, despite radically different economic commitment.

**Attack Scenario:**  
Alice has a lock expiring in `EPOCH_DURATION + 1 second`. She votes at the epoch start with high voting power (long duration-weighted amount), then the power decays throughout the epoch. Bob has an identical lock amount but locked at the end of the epoch with full power. Bob's actual commitment is much larger but they contribute the same weight.

**Recommended Fix:**  
Compute voting weight at epoch *end* (snapshot the lock's projected power at `epochEndTime`) rather than at `block.timestamp`. Alternatively, use Curve-style slope/bias checkpoints so that accrued votes automatically decay.

---

### G-04 — HIGH: `notifyRewards` credits current epoch — rewards deposited before any votes are cast

**Contract:** `VoterRewardsDistributor.sol`  
**Lines:** 163–166

**Code Snippet:**
```solidity
uint256 epoch = gaugeVoting.currentEpoch();
epochVaultRewards[epoch][vault] += amount;
```

**Issue:**  
Rewards are always credited to the **current, live epoch**. Users vote during the live epoch, then claim rewards from past epochs. This is correct in intent, but creates a race condition:

If `notifyRewards` is called early in epoch N (say, block 1 of the epoch), any user who votes during epoch N and claims after it ends will receive rewards that were notified before any votes were cast. However, a sophisticated protocol could send rewards *late* in epoch N, after the vote tallies are largely settled, benefiting known heavy voters. More critically, if the reward token mapping is changed (see G-10), rewards deposited at different points within the same epoch may reference different tokens.

Additionally, there is no access control limiting who can call `notifyRewards` beyond the registry lookup:
```solidity
address expectedGauge = registry.getGaugeControllerForToken(creatorToken);
if (expectedGauge == address(0) || msg.sender != expectedGauge) revert UnauthorizedNotifier();
```
If the `registry` can be updated by an admin, or if the registry is compromised, any caller could be recognized as `expectedGauge`.

**Recommended Fix:**  
Consider crediting rewards to epoch `currentEpoch() - 1` or `currentEpoch() + 1` (i.e., reward the next epoch, creating forward-looking incentives). This prevents informational asymmetry where a large voter knows which epoch will be well-funded before casting their vote.

---

### G-05 — HIGH: `rolloverExpiredEpoch` double-counts rolled amount into live `totalBribes` — overclaims possible

**Contract:** `bribes/BribeDepot.sol`  
**Lines:** 158–184

**Code Snippet:**
```solidity
rolled = totalAmount - alreadyClaimed;
isClosed[epoch][token] = true;

if (rolled > 0) {
    totalBribes[current][token] += rolled;  // L180
}
```

**Issue:**  
When `rolloverExpiredEpoch` is called, `rolled = totalBribes[epoch][token] - claimedAmount[epoch][token]` is added to `totalBribes[current][token]`. The function closes the source epoch and zeroes `totalBribes[epoch][token]` (implicitly — it sets `isClosed` to true but **does NOT zero `totalBribes[epoch][token]`**).

Wait — re-reading: `totalBribes[epoch][token]` is **not zeroed** in `rolloverExpiredEpoch`. Only `isClosed[epoch][token] = true` is set. This is inconsistent with `rolloverZeroVoteEpoch` (which does `totalBribes[epoch][token] = 0`). While the `isClosed` guard prevents further claims from the source epoch, `rolled` is computed from the non-zeroed `totalBribes[epoch][token]`. If the epoch's `claimedAmount` is somehow manipulated or if a non-standard token causes `claimedAmount` to be wrong, there is an inaccuracy.

More critically: if `rolloverExpiredEpoch` is called multiple times on the same epoch (before the `isClosed` flag is set — but the first call sets `isClosed = true`, so subsequent calls revert via `EpochClosed`). This is protected. However, there is no zeroing of `totalBribes[epoch][token]`. A future code path or a similar function could re-read `totalBribes[epoch][token]` and see stale data.

The deeper issue: `claimedAmount[epoch][token]` is a **running sum of transfer amounts** but **not atomically bounded**. In `claim()`:
```solidity
amount = (totalAmount * userWeight) / totalWeight;
claimedAmount[epoch][token] += amount;
```
Due to rounding down, the sum of all individual claims may be less than `totalBribes[epoch][token]`. The residue (rounding dust) flows into `rolled`. This is acceptable. But the **total amount transferred to the current epoch** is `rolled + totalBribes[current][token]` (the pre-existing current value), and claims against the current epoch are computed against this inflated `totalBribes`. This is correct and intentional.

The real bug is: **there is no rollover grace check in `rolloverZeroVoteEpoch`** (see G-21). But in `rolloverExpiredEpoch`, there is no validation that the epoch was actually a non-zero-vote epoch. An epoch with votes could be rolled before claimants have claimed, effectively stealing their rewards.

**Specifically:** `rolloverExpiredEpoch` can be called on any epoch with `epoch + rolloverGraceEpochs < current`, including epochs where `getVaultWeightAtEpoch > 0`. If voters did not claim within the grace period (4 weeks), their rewards are forcibly rolled forward into the *current* epoch — they cannot claim them from the original epoch (it's closed), and they have no vote weight in the current epoch (they voted in the old one), so the rolled amount is permanently stolen from them.

**Attack Scenario:**  
Epoch 1 has 10 voters. None of them claim within 4 epochs. At epoch 6, anyone calls `rolloverExpiredEpoch(1, token)`. The 10 voters permanently lose their rewards, which are redistributed to epoch 6 voters (likely a different set).

**Recommended Fix:**  
Either (a) disallow rollover of epochs with non-zero vote weight (mirror `rolloverZeroVoteEpoch`'s guard), or (b) never roll rewards with active claimants — only roll true rounding dust after all claimants have explicitly opted out, or (c) provide a user-facing multi-epoch claim path with explicit no-expiry policy.

---

### G-06 — HIGH: `emergencyResetAllVotes` orphans user-internal vote accounting, causing permanent underflow risk

**Contract:** `VaultGaugeVoting.sol`  
**Lines:** 423–431

**Code Snippet:**
```solidity
function emergencyResetAllVotes() external onlyOwner {
    uint256 epoch = currentEpoch();
    uint256 vaultCount = _whitelistedVaults.length();
    for (uint256 i = 0; i < vaultCount; i++) {
        address vault = _whitelistedVaults.at(i);
        _epochVaultVotes[epoch][vault] = 0;
    }
    _epochTotalVotes[epoch] = 0;
}
```

**Issue:**  
This function zeroes the aggregate vote tallies (`_epochVaultVotes` and `_epochTotalVotes`) but **does not clear the per-user vote records** (`_epochUserVaultVotes` and `_epochUserVotedVaults`). 

After the emergency reset, any user who had voted can call `vote()` again. `vote()` calls `_clearUserVotes()` first, which reads `_epochUserVaultVotes[epoch][user][vault]` and subtracts from `_epochVaultVotes[epoch][vault]`. But `_epochVaultVotes[epoch][vault]` is now 0. The subtraction `_epochVaultVotes[epoch][vault] -= weight` will **underflow** (Solidity 0.8 panics on underflow).

**Attack Scenario:**  
1. Owner calls `emergencyResetAllVotes()`.
2. Any previously voting user calls `vote()` or `resetVotes()`.
3. `_clearUserVotes` executes and attempts to subtract from the already-zeroed aggregate — **reverts with arithmetic underflow**.
4. All previously voting users are permanently locked out of voting for the rest of the epoch.

**Recommended Fix:**  
Either call `_clearUserVotes` for all users before resetting aggregates (gas-expensive), or iterate and zero all `_epochUserVaultVotes` entries. Alternatively, use a generation counter / epoch invalidation flag so old user entries are ignored without explicit deletion.

---

### G-07 — HIGH: Voting power decay not reflected in ERC20Votes checkpoints — delegated balances are stale

**Contract:** `ve4626.sol`  
**Lines:** 370–372

**Code Snippet:**
```solidity
function _update(address from, address to, uint256 value) internal override(ERC20, ERC20Votes) {
    super._update(from, to, value);
}
```

**Issue:**  
`ve4626` inherits `ERC20Votes`, which stores timestamped checkpoints of the ERC20 balance. When `getPastVotes(user, timestamp)` is called for a historical timestamp, it returns the ERC20 balance at that time — not the linearly-decayed voting power `_calculateVotingPower(amount, lockEnd)` at that timestamp.

This creates a fundamental divergence:
- `getVotingPower(user)` = decayed, time-weighted power (correct for governance)
- `getPastVotes(user, pastTimestamp)` = raw ERC20 balance at `pastTimestamp` (potentially 4× the actual power if the checkpoint was made at lock time with full 4-year weight)

Any consumer using the OpenZeppelin Governor pattern (which calls `getPastVotes`) will receive incorrect, inflated voting powers for proposal quorum/snapshot queries.

**Recommended Fix:**  
Either do not inherit `ERC20Votes` (remove the checkpointing entirely and rely solely on `getVotingPower`), or override `getPastVotes` and `getPastTotalSupply` to compute decay from stored lock data. A dedicated `votingPowerAt(address, timestamp)` function already exists (L314–321) but is not integrated into the ERC20Votes checkpoint flow.

---

### G-08 — MEDIUM: Rounding loss in `normalizedWeight` computation causes vote weight to silently floor to zero

**Contract:** `VaultGaugeVoting.sol`  
**Lines:** 211–216

**Code Snippet:**
```solidity
uint256 normalizedWeight = (userPower * aggregatedWeights[i]) / totalWeight;

_epochVaultVotes[epoch][vault] += normalizedWeight;
_epochTotalVotes[epoch] += normalizedWeight;
_epochUserVaultVotes[epoch][msg.sender][vault] = normalizedWeight;
```

**Issue:**  
`normalizedWeight` is computed as `floor(userPower * w_i / totalWeight)`. For a user distributing power across many vaults with small fractional weights, rounding errors can be significant. More critically, if `userPower * aggregatedWeights[i] < totalWeight`, `normalizedWeight = 0`, but the call still succeeds (no `ZeroWeight` check on the *output*).

Consequence: the user's vote for that vault is registered (via `_epochUserVotedVaults.add(vault)` and `_epochUserVaultVotes[epoch][msg.sender][vault] = 0`), but the aggregate tallies receive nothing. On `_clearUserVotes`, the per-user record exists (with weight=0), but `_epochVaultVotes[epoch][vault] -= 0` is a no-op — so clearing is safe. However:

- The user's slot is wasted (one of `MAX_VAULTS_PER_VOTE`).
- The user's total power is silently lost in rounding — the sum of all `normalizedWeight` may be less than `userPower`, but there is no check or "dust" collection.
- `_epochTotalVotes` underestimates the true combined weight.

**Attack Scenario:**  
A user with moderate power (e.g., 9,999 wei of voting power) distributes equally across 10 vaults (each weight = 1/10 of total = 9999/10 = 999 wei per vault). Each normalizedWeight floors to 999. The user contributed 9,999 but only 9,990 is recorded. For small amounts this is negligible; for large numbers of users with many vaults, cumulative rounding can skew gauge weights by several percent.

**Recommended Fix:**  
Add a "dust" allocation: add any remainder `(userPower - sum(normalizedWeights))` to the first or largest vault's allocation. Also add an explicit check: if `normalizedWeight == 0` after computation, revert with a meaningful error.

---

### G-09 — MEDIUM: Same-block `lock → vote` enables snapshot gaming without lock commitment

**Contract:** `VaultGaugeVoting.sol` + `ve4626.sol`  
**Lines:** VaultGaugeVoting.sol L171–173

**Code Snippet:**
```solidity
uint256 userPower = ve4626.getVotingPower(msg.sender);
if (userPower == 0) revert NoVotingPower();
if (ve4626.getRemainingLockTime(msg.sender) < timeUntilNextEpoch()) revert LockExpiresBeforeEpochEnd();
```

**Issue:**  
There is no minimum age requirement on a lock before it can be used for voting. A user can lock tokens and vote in the same block (even the same transaction in a multicall). This means:

1. Borrow tokens (flash loan or standard borrow).
2. Lock tokens in `ve4626` → receive voting power.
3. Vote in `VaultGaugeVoting` using that fresh power.
4. (Cannot unlock same-block due to `LockNotExpired` guard, so flash-loan in a single transaction is blocked for the lock itself.)

However, since lock duration can be as short as 7 days (MIN_LOCK_DURATION), the attacker only needs to commit tokens for 7 days — which is not capital-free but is capital-efficient for large whales looking to swing a weekly epoch vote. The lock-duration guard (`getRemainingLockTime >= timeUntilNextEpoch`) only ensures the lock doesn't expire before the *current* epoch ends; a 7-day lock passes this for any vote cast early in an epoch.

**Recommended Fix:**  
Require a minimum lock age before voting (e.g., lock must be at least 1 epoch old before votes count). This prevents last-minute large locks from swinging any single epoch.

---

### G-10 — MEDIUM: `recoverVaultRewardToken` remaps token mid-epoch — future claims use new token but old balances are in old token

**Contract:** `VoterRewardsDistributor.sol`  
**Lines:** 128–133

**Code Snippet:**
```solidity
function recoverVaultRewardToken(address vault, address token) external onlyOwner {
    if (vault == address(0) || token == address(0)) revert ZeroAddress();
    address oldToken = vaultRewardToken[vault];
    vaultRewardToken[vault] = token;
    emit RewardTokenRecovered(vault, oldToken, token);
}
```

**Issue:**  
`vaultRewardToken[vault]` is a **single mapping** used both for new reward notifications and for `_claim()` payouts. If the owner calls `recoverVaultRewardToken` to change the token for a vault:

1. All **past epochs** for which rewards were deposited in `oldToken` will now be claimed by users using `newToken` — but the contract only holds `oldToken`.
2. `_claim()` calls `IERC20(token).safeTransfer(user, amount)` where `token = vaultRewardToken[vault]` — the new token. This will drain whatever new token balance the contract has (if any), or revert with insufficient balance.
3. The old-token rewards are permanently stranded.

There is no per-epoch reward token record. All epochs for a vault share the same token.

**Attack Scenario:**  
Owner (or attacker who compromises owner key) calls `recoverVaultRewardToken(vault, attackerToken)`. Users try to claim past legitimate rewards. `_claim` attempts to transfer `attackerToken` (which may be worth nothing), and the real vault share tokens are never redeemable.

**Recommended Fix:**  
Store reward token per `(epoch, vault)` rather than per `vault`. Use `epochRewardToken[epoch][vault]` to record the token at notification time and use that token at claim time.

---

### G-11 — MEDIUM: `receiveBridgedFees` accounting is fragile — `jackpotReserve` is vault shares, not OFT

**Contract:** `CreatorGaugeController.sol`  
**Lines:** 341–360

**Code Snippet:**
```solidity
function receiveBridgedFees() external nonReentrant {
    uint256 balance = shareOFT.balanceOf(address(this));
    // (pendingFees + jackpotReserve are held as vault shares or OFT,
    //  but only pendingFees are in OFT form — jackpotReserve is vault shares)
    uint256 accounted = pendingFees;
    if (balance <= accounted) return;

    uint256 bridgedAmount = balance - accounted;
    pendingFees += bridgedAmount;
```

**Issue:**  
The comment in the code explicitly acknowledges that `jackpotReserve` is held as vault shares (not OFT). The OFT balance of the contract (`shareOFT.balanceOf(address(this))`) should only reflect `pendingFees` in OFT form. This assumption holds as long as:

1. No one accidentally sends `shareOFT` tokens directly to the contract (a `transfer()` from another holder or contract, not via `receiveFees`).
2. The wrapper never returns partial OFT amounts that remain unaccounted.

If an attacker (or well-meaning holder) sends `shareOFT` directly to the contract (not via `receiveFees`), `receiveBridgedFees` will sweep it into `pendingFees`, crediting `totalFeesReceived` for tokens that were donated by accident. This is not strictly harmful but inflates accounting.

More critically, if `shareOFT` == `vaultShares` (same token at different stages of wrapping), then `jackpotReserve` vault shares would be counted as bridged OFT, leading to `bridgedAmount` being drastically overestimated.

**Recommended Fix:**  
Add a `pendingBridgedFees` snapshot or use a dedicated pull pattern (tokens are sent to a separate escrow address, then pulled here), to cleanly separate bridged OFT intake from distribution accounting.

---

### G-12 — MEDIUM: Oracle slippage protection silently reverts to zero minimum — WETH swap proceeds with no floor

**Contract:** `CreatorGaugeController.sol`  
**Lines:** 497–523, 440–451

**Code Snippet:**
```solidity
function _calculateMinOutput(uint256 wethAmount) internal view returns (uint256 minOut) {
    if (!useOracleSlippage || address(oracle) == address(0)) {
        return 0;
    }
    try oracle.isPriceFresh() returns (bool fresh) {
        if (!fresh) return 0;
    } catch {
        return 0;
    }
    // ...
}

// In _processWETHFees:
uint256 minAmountOut = _calculateMinOutput(wethAmount);
if (minAmountOut == 0) revert MinOutputUnavailable();
```

**Issue:**  
`_processWETHFees` correctly reverts if `minAmountOut == 0`. However, `_calculateMinOutput` returns 0 in multiple silent failure paths:
- Oracle not set
- `useOracleSlippage = false`
- Oracle price is stale
- `getCreatorEthTWAP` reverts

If `useOracleSlippage` is set to `false` by the owner (a valid config path via `setOracleConfig`), the swap proceeds with **`minAmountOut = 0`**, meaning any amount of slippage is accepted including complete sandwich attacks. The `MinOutputUnavailable` revert never triggers because `_calculateMinOutput` returns 0 only when oracle is disabled, but the revert check happens unconditionally.

Wait — re-reading: when `useOracleSlippage = false`, `_calculateMinOutput` returns `0`, and `_processWETHFees` hits `if (minAmountOut == 0) revert MinOutputUnavailable()`. So the swap is **blocked** when oracle is disabled, not open. This is actually correct protection.

The real issue is more subtle: in `receiveWETHFees` auto-processing path (L396–400):
```solidity
if (_calculateMinOutput(amountToProcess) > 0) {
    _processWETHFees(amountToProcess);
}
```
This silently skips processing if the oracle is unavailable — which is the desired behavior. But there is no event or notification that the auto-process was skipped due to oracle staleness, making it unmonitorable.

The broader concern: if the owner sets `useOracleSlippage = false` AND `maxPermissionlessWethProcess > 0`, the permissionless `processWETHFees()` path will always revert with `MinOutputUnavailable` because the oracle returns 0. The WETH fees will be permanently stuck until the owner re-enables the oracle. There is no override path for this case.

**Recommended Fix:**  
Add an explicit "no-oracle mode" with a configurable absolute minimum (`fallbackMinOutput` per-token or as a percentage), rather than hard-failing when oracle is disabled.

---

### G-13 — MEDIUM: `setBoostParameters` permanently locks after a single call — no emergency recovery

**Contract:** `ve4626BoostManager.sol`  
**Lines:** 134–142

**Code Snippet:**
```solidity
function setBoostParameters(uint256 _baseBoost, uint256 _maxBoost) external onlyOwner {
    if (boostParametersLocked) revert BoostParametersAreLocked();
    if (_baseBoost == 0 || _maxBoost <= _baseBoost || _maxBoost > MAX_VE_BOOST) revert InvalidBoostParameters();

    baseBoost = _baseBoost;
    maxBoost = _maxBoost;
    boostParametersLocked = true;   // permanently locks after ONE call
    emit BoostParametersUpdated(_baseBoost, _maxBoost);
}
```

**Issue:**  
The function sets `boostParametersLocked = true` on first invocation, making it one-time-use. There is no `unlockBoostParameters` or timelock override. If boost parameters are misconfigured or need adjustment as the protocol evolves, there is no recovery path. The `setMinVotingPower` function remains unlocked, but `baseBoost` and `maxBoost` cannot be changed.

This is an operational risk more than a direct exploit, but if `baseBoost` is set too high (e.g., `10_001` — immediately above `MAX_VE_BOOST` check but passing validation) or `maxBoost` is too low, the boost system is permanently broken.

**Recommended Fix:**  
Use a timelock for parameter updates rather than a one-time lock. If immutability is truly desired, set these as constructor parameters. Alternatively, allow a governance multisig with a 48-hour delay to update parameters.

---

### G-14 — MEDIUM: Bribes can be deposited into current epoch for any token, including de-listed vault tokens — deposited funds are stuck

**Contract:** `bribes/BribeDepot.sol`  
**Lines:** 82–96

**Code Snippet:**
```solidity
function bribe(address token, uint256 amount) external nonReentrant {
    if (token == address(0)) revert ZeroAddress();
    if (amount == 0) revert ZeroAmount();

    uint256 epoch = gaugeVoting.currentEpoch();
    uint256 beforeBal = IERC20(token).balanceOf(address(this));
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    uint256 afterBal = IERC20(token).balanceOf(address(this));
    uint256 received = afterBal - beforeBal;
    totalBribes[epoch][token] += received;
    emit Bribed(token, received, epoch);
}
```

**Issue:**  
`bribe()` accepts any ERC-20 token with no validation. There is no check that:
1. The vault associated with this `BribeDepot` is still whitelisted in `VaultGaugeVoting`.
2. The bribe token is a recognized/valuable token.

If the vault is de-listed between a bribe deposit and epoch end, no voters will have voted for that vault in that epoch (`getVaultWeightAtEpoch` = 0). Claims will revert with `NoUserVotes`. Rollover is required to recover funds. During the `rolloverGraceEpochs = 4` window, the briber cannot recover their tokens.

Additionally, a briber can deposit zero-value tokens (tokens that revert on transfer, highly illiquid tokens, or honeypot tokens) which can pollute the bribe accounting and interfere with legitimate multi-token claim flows.

There is also no mechanism for a depositor to reclaim their bribe before the epoch ends (e.g., if they made a mistake). Bribes are irrevocably committed at deposit time.

**Recommended Fix:**  
Add a bribe token whitelist managed by the owner. Add a `revokeBribe` function allowing the briber to reclaim funds within the same epoch (with appropriate accounting). Add a vault-active-status check before accepting bribes.

---

### G-15 — MEDIUM: `emergencyWithdraw` can drain `jackpotReserve` vault shares without adjusting the accounting variable

**Contract:** `CreatorGaugeController.sol`  
**Lines:** 1039–1042

**Code Snippet:**
```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
    if (to == address(0)) revert ZeroAddress();
    IERC20(token).safeTransfer(to, amount);
}
```

**Issue:**  
`emergencyWithdraw` performs a raw ERC20 transfer without updating any state. If `token == address(vaultShares)`, this drains vault shares from the contract. The `jackpotReserve` variable is not decremented.

After the emergency withdrawal:
- `jackpotReserve` reports a non-zero reserve.
- `payJackpot` can be called by the lottery manager with a value ≤ reported `jackpotReserve`.
- The `safeTransfer` in `payJackpot` will revert (insufficient balance).
- The lottery is effectively bricked until more vault shares arrive.

**Attack Scenario:**  
Owner (or attacker with owner key) calls `emergencyWithdraw(vaultShares, fullBalance, attacker)`. The jackpot reserve shows e.g. 100,000 shares, but the contract holds 0. The lottery manager calls `payJackpot` for a winner, which reverts. No winners can be paid.

**Recommended Fix:**  
Add explicit accounting updates in `emergencyWithdraw`. If `token == address(vaultShares)`, decrement `jackpotReserve` proportionally (or entirely). Alternatively, reject withdrawing the vault shares token unless `jackpotReserve` is also zeroed.

---

### G-16 — LOW: `timeUntilNextEpoch` returns 0 before genesis — allows voting before protocol launches

**Contract:** `VaultGaugeVoting.sol`  
**Lines:** 274–278

**Code Snippet:**
```solidity
function timeUntilNextEpoch() public view returns (uint256) {
    uint256 epoch = currentEpoch();
    uint256 endTime = epochEndTime(epoch);
    return block.timestamp >= endTime ? 0 : endTime - block.timestamp;
}
```

**Issue:**  
Before `genesisEpochStart`, `currentEpoch()` returns 0. `epochEndTime(0) = genesisEpochStart + EPOCH_DURATION`. So `timeUntilNextEpoch()` would return `genesisEpochStart + EPOCH_DURATION - block.timestamp` (a large positive number), not 0. The lock expiry guard `getRemainingLockTime(msg.sender) < timeUntilNextEpoch()` at L173 is thus extremely conservative pre-genesis (requires lock to last through the entire first epoch). This is likely fine.

However, `currentEpoch()` returning 0 pre-genesis means any votes cast pre-genesis go into epoch 0. After genesis, epoch 0 starts, and these pre-genesis votes are counted in the first live epoch (votes are live for the `currentEpoch()` at cast time). This can allow early insider voting before the protocol is publicly launched.

**Recommended Fix:**  
Add a `require(block.timestamp >= genesisEpochStart, "Voting not started")` guard in `vote()`.

---

### G-17 — LOW: `lock()` error message says "Must use increaseLock" but the revert is `NoExistingLock()` — wrong guard

**Contract:** `ve4626.sol`  
**Line:** 133

**Code Snippet:**
```solidity
if (_locks[msg.sender].amount > 0) revert NoExistingLock(); // Must use increaseLock
```

**Issue:**  
The condition `_locks[msg.sender].amount > 0` means "user already has a lock." The revert should signal "AlreadyLocked" (user should call `increaseLock`), not `NoExistingLock`. The error `NoExistingLock` is semantically the opposite — it's thrown here when a lock *does* exist. This could confuse integrators.

**Recommended Fix:**  
Rename or add a new error: `error AlreadyLocked()`, and revert with it here. Reserve `NoExistingLock` for functions that require an existing lock.

---

### G-18 — LOW: No sweep path for unclaimed rewards in epochs with non-zero votes — rewards are permanently locked after grace period

**Contract:** `VoterRewardsDistributor.sol`  
**Lines:** 180–204

**Code Snippet:**
```solidity
function sweepZeroVoteEpoch(address vault, uint256 epoch) external onlyOwner nonReentrant returns (uint256 amount) {
    // ...
    if (gaugeVoting.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();
    // ...
}
```

**Issue:**  
`sweepZeroVoteEpoch` only works when `getVaultWeightAtEpoch(epoch, vault) == 0`. For epochs where voters participated but not all claimants claimed (e.g., they lost their keys, the UI was unavailable, the epoch was skipped), the unclaimed rewards are permanently trapped in the contract. There is no sweep function for non-zero-vote epochs after some timeout.

This contrasts with `BribeDepot.rolloverExpiredEpoch` which handles this case. `VoterRewardsDistributor` has no equivalent.

**Recommended Fix:**  
Add a `sweepStaleEpochRewards(address vault, uint256 epoch)` function that can be called by the owner after a longer grace period (e.g., 26 epochs / 6 months) regardless of vote weight, to avoid permanent fund lockup.

---

### G-19 — LOW: `forceDistribute` (owner-only) bypasses the distribution interval — can over-distribute

**Contract:** `CreatorGaugeController.sol`  
**Lines:** 573–576

**Code Snippet:**
```solidity
function forceDistribute() external nonReentrant onlyOwner {
    if (pendingFees == 0) revert NothingToDistribute();
    _distributeInternal();
}
```

**Issue:**  
`forceDistribute` bypasses the `distributionInterval` check and the `distributionThreshold` check. This allows the owner to trigger distributions at arbitrarily high frequency. In combination with WETH fee processing (which triggers a separate `_distributeVaultShares` internally), it is possible for two distribution events to occur within the same second if the owner calls `forceDistribute` while an auto-process is in flight.

The main risk is loss of gas efficiency, but in adversarial scenarios (compromised owner key), the owner could cause many small distributions to occur at arbitrary times, making the protocol behave unpredictably. More concerning, `_distributeVaultShares` also sets `lastDistribution = block.timestamp`, so a `forceDistribute` resets the interval clock, meaning the next permissionless `distribute()` is locked out for `distributionInterval` after the force.

**Recommended Fix:**  
This is intentional functionality for emergency scenarios. Document clearly that `forceDistribute` is an emergency-only function and should ideally be behind a timelock or multisig.

---

### G-20 — LOW: Flash-loan protection (`MIN_HOLDING_BLOCKS = 10`) is trivially defeatable in ~2 minutes

**Contract:** `ve4626BoostManager.sol`  
**Lines:** 47, 77–80

**Code Snippet:**
```solidity
uint256 public constant MIN_HOLDING_BLOCKS = 10;

function calculateBoostWithProtection(address user) public view returns (uint256 boostMultiplier) {
    if (block.number < lastBalanceUpdateBlock[user] + MIN_HOLDING_BLOCKS) {
        return baseBoost;
    }
```

**Issue:**  
`MIN_HOLDING_BLOCKS = 10` on Base L2 equates to approximately 20 seconds (2-second block times). This is not sufficient protection against MEV-sophisticated actors who can:
1. Lock tokens.
2. Wait 10 blocks (~20 seconds).
3. Call boost calculation (e.g., via lottery swap).
4. Unlock after lock expires (minimum 7 days).

While the 7-day minimum lock prevents pure flash-loan attacks (single transaction), a "slow flash loan" using 7-day capital is still highly capital-efficient for large actors. The block-delay guard adds essentially zero economic protection given the 7-day minimum lock already dominates.

**Recommended Fix:**  
If flash-loan protection is the goal, the min holding blocks should be at least 1 epoch (7 days ≈ 302,400 blocks on Base). Otherwise, remove the block delay as it provides false security assurance.

---

### G-21 — LOW: `rolloverZeroVoteEpoch` has no `rolloverGraceEpochs` check — immediately callable

**Contract:** `bribes/BribeDepot.sol`  
**Lines:** 131–152

**Code Snippet:**
```solidity
function rolloverZeroVoteEpoch(uint256 epoch, address token) external nonReentrant returns (uint256 rolled) {
    // ...
    uint256 current = gaugeVoting.currentEpoch();
    if (epoch >= current) revert EpochNotEnded();
    if (isClosed[epoch][token]) revert EpochClosed();
    // No grace period check!
    if (gaugeVoting.getVaultWeightAtEpoch(epoch, vault) != 0) revert NotZeroVoteEpoch();
```

**Issue:**  
`rolloverExpiredEpoch` correctly checks `epoch + rolloverGraceEpochs >= current` before allowing a rollover. However, `rolloverZeroVoteEpoch` has no such delay. As soon as an epoch ends (and had zero votes for this vault), anyone can immediately roll those funds forward.

This could create a front-running opportunity: if a large bribe was deposited in epoch N intending to attract voters but the epoch ended with zero votes (e.g., the vault was just whitelisted), a MEV bot can roll the bribe to the current epoch before any voter notices and potentially claim those bribes in the current epoch for themselves.

More subtly: the briber may have wanted the funds to remain in epoch N for the full grace period while they advertise and try to attract retroactive governance recovery. The immediate rollover eliminates this possibility.

**Recommended Fix:**  
Add a minimum grace period (e.g., 1 epoch) before zero-vote rollovers are permitted.

---

### G-22 — INFO: `extendLock` only mints additional ve4626 — can never reduce existing balance

**Contract:** `ve4626.sol`  
**Lines:** 180–185

**Code Snippet:**
```solidity
if (newVotingPower > oldPower) {
    uint256 diff = newVotingPower - oldPower;
    _mint(msg.sender, diff);
    _totalVotingSupply += diff;
}
// No else: if newVotingPower <= oldPower, nothing happens
```

**Issue:**  
`extendLock` recalculates `newVotingPower = _calculateVotingPower(userLock.amount, newEnd)` with the new (later) end date. Since `newEnd > userLock.end > block.timestamp`, the new duration is longer, so `newVotingPower > oldPower` is always true at the moment of the call. However, `oldPower = balanceOf(msg.sender)` is the ERC20 balance (not the live decayed power from `votingPower()`). If the user waited and their `votingPower()` has decayed below `balanceOf()`, the check is comparing against stale ERC20 balance.

This means `extendLock` could mint fewer tokens than expected if the user's ERC20 balance is still at the original locked amount while their live power has decayed significantly. The resulting mint brings the ERC20 balance up to `newVotingPower(newEnd)` which is correct. This path works.

The INFO-level concern is documentation: the behavior when `newVotingPower == oldPower` (no mint, no emit of the actual new power) is silently a no-op. This should be documented or a separate event should be emitted.

---

### G-23 — INFO: `checkpoint()` only ever checkpoints `currentEpoch() - 1` — skipped epochs are never emitted

**Contract:** `VaultGaugeVoting.sol`  
**Lines:** 249–259

**Code Snippet:**
```solidity
function checkpoint() external override {
    uint256 current = currentEpoch();
    if (current == 0) revert EpochNotEnded();

    uint256 epochToCheckpoint = current - 1;
    if (_epochCheckpointed[epochToCheckpoint]) return;

    _epochCheckpointed[epochToCheckpoint] = true;
    lastCheckpointedEpoch = epochToCheckpoint;
    emit EpochCheckpointed(epochToCheckpoint, _epochTotalVotes[epochToCheckpoint]);
}
```

**Issue:**  
`checkpoint()` checkpoints `current - 1` only. If epochs 3, 4, and 5 pass without anyone calling `checkpoint()`, and then someone calls it in epoch 6, only epoch 5 is checkpointed. Epochs 3 and 4 are never checkpointed (their `_epochCheckpointed` flags are never set). `lastCheckpointedEpoch` jumps from 2 to 5, skipping 3 and 4.

Indexers or off-chain consumers relying on sequential `EpochCheckpointed` events will have gaps in their view of the protocol's history. This doesn't affect on-chain security, but it can cause incorrect off-chain accounting.

**Recommended Fix:**  
Allow `checkpoint()` to accept an explicit epoch parameter, or loop from `lastCheckpointedEpoch + 1` to `current - 1` (with a loop cap to avoid gas exhaustion).

---

### G-24 — INFO: Fee split constants sum to 10,000 bps only when `creatorShareBps = 0`

**Contract:** `CreatorGaugeController.sol`  
**Lines:** 150–159

**Code Snippet:**
```solidity
uint256 public constant burnShareBps = 2139;    // 21.39%
uint256 public constant lotteryShareBps = 6900;  // 69%
uint256 public constant creatorShareBps = 0;     // 0%
uint256 public constant protocolShareBps = 961;  // 9.61%
// Sum: 2139 + 6900 + 0 + 961 = 10000 ✓
```

**Issue:**  
These are Solidity constants, so no runtime reconfiguration is possible. However, the `toProtocol` amount is calculated as the remainder:
```solidity
uint256 toProtocol = vaultSharesReceived - toBurn - toLottery - toCreator;
```
This "last slice gets the remainder" approach compensates for rounding, which is correct. But if in a future upgrade `creatorShareBps` were to be changed to non-zero (requiring contract redeployment), the sum would need to be rechecked. A compile-time assertion would prevent deployment with incorrect constants:

```solidity
// Missing compile-time check:
// uint256 private constant _BPS_SUM_CHECK = burnShareBps + lotteryShareBps + creatorShareBps + protocolShareBps;
// assert(_BPS_SUM_CHECK == MAX_BPS);
```

**Recommended Fix:**  
Add a constructor-time assertion: `require(burnShareBps + lotteryShareBps + creatorShareBps + protocolShareBps == MAX_BPS, "BPS mismatch")`. This will fail at deployment if constants are ever incorrectly set in a future version.

---

## Cross-Contract Interaction Analysis

### Malicious Vault/Registry Attacks

**VoterRewardsDistributor** trusts `registry.getTokenForVault()` and `registry.getGaugeControllerForToken()` to authorize callers. If the registry is upgradeable or the admin updates a vault's registered gauge controller to an attacker-controlled address, the attacker can call `notifyRewards()` legitimately (the registry confirms them), deposit worthless tokens, and redirect all future claims to a worthless token (after `vaultRewardToken` is set for that vault).

**BribeDepot** accepts any token for bribing. A malicious briber can deposit a reentrant ERC-20 that calls back into `claim()` during the `safeTransferFrom`. However, `nonReentrant` guards on both `bribe()` and `claim()` prevent same-contract reentrancy. Cross-contract reentrancy (through the gauge voting contract's external calls) is not an issue as those calls are all `view`.

### VaultGaugeVoting Whitelist Race

When `setVaultWhitelist(vault, false)` is called:
1. Active votes for that vault remain in `_epochVaultVotes` and `_epochTotalVotes`.
2. The vault is removed from `_whitelistedVaults`, so `getVaultGaugeProbabilityBoostPPM` returns 0 for it.
3. But `_epochVaultVotes[epoch][vault]` is still non-zero.
4. `getVaultWeightBps` still returns a non-zero share (it doesn't check whitelist).
5. Voters for the de-listed vault can still claim `VoterRewardsDistributor` rewards (it doesn't check whitelist at claim time).
6. `BribeDepot.claim()` still allows claiming based on the stale vote weight.

This means de-listing a vault mid-epoch does not cleanly terminate its influence on the reward system.

---

## Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 8 |
| LOW | 6 |
| INFO | 3 |
| **Total** | **24** |

---

## Prioritized Remediation

1. **(G-01, G-02)** Redesign ve4626 voting power to not rely on ERC20 balance as proxy for governance weight. Implement a `burnExpiredLock` mechanism or replace ERC20Votes inheritance with a pure view-based system.
2. **(G-06)** Fix `emergencyResetAllVotes` to clear per-user records before resetting aggregates, or add a generation counter.
3. **(G-05)** Restrict `rolloverExpiredEpoch` to epochs with zero votes, or provide an alternative non-destructive stale-claim mechanism.
4. **(G-07)** Decouple ERC20Votes checkpoints from ve voting power, or override `getPastVotes` to return time-weighted power.
5. **(G-10)** Store reward token per `(epoch, vault)` to prevent token remapping from affecting historical claims.
6. **(G-15)** Update `jackpotReserve` in `emergencyWithdraw` when vault shares are withdrawn.
7. **(G-03)** Snapshot voting power at epoch end or use slope/bias checkpoints to handle decaying power correctly.
