# Job 496

## ODA-496-1 (conf 90)
**Owner-only `adminModuleCall` reaches `payoutLocalJackpot`, which has no independent access guard — drains gauge jackpot reserves with no VRF win, no pause, no timelock**
### Fix
```diff
  function adminModuleCall(bytes calldata data) external onlyOwner {
+     bytes4 selector = bytes4(data);
+     if (selector == LotteryManager4626AdminModule.payoutLocalJackpot.selector) revert ForbiddenSelector();
      (bool ok, bytes memory ret) = _adminModule.delegatecall(data);
      ...
  }
```
Or, preferably, gate `payoutLocalJackpot` itself on a transient flag set only by the internal `_payoutLocalJackpot` path immediately before delegating and cleared after, so the function is verifiably reachable only from a genuine VRF win regardless of how `adminModuleCall` evolves.


## ODA-496-2 (conf 85)
**Jackpot payout as a fixed percentage of the live pooled reserve — combined with win-chance scaling only on the entrant's own notional — gives every entrant positive expected value once the reserve is non-trivial, enabling systematic reserve extraction via repeated small entries**
### Fix
This is a structural economic-design issue rather than a single-line guard fix. Recommended directions: fund each entry's potential prize from that entry's own fee contribution (pari-mutuel-style) rather than a shared standing pool; scale `payoutBps` inversely with the entrant's `winChancePPM` so `p × payout` is bounded per unit of fee paid; or cap total payout per unit time relative to reserve *inflow* rather than as a flat percentage of standing balance. Recommend a dedicated design review before mainnet launch.


## ODA-496-3 (conf 75)
**A permissioned relayer can read the VRF outcome before deciding whether to relay it cross-chain, and can selectively withhold delivery of winning results until they are discarded as stale**
### Fix
Consider making result relay permissionless (the caller already funds and is refunded the LZ fee), removing the relayer's unilateral power to choose which outcomes get delivered.


## ODA-496-4 (conf 70)
**Hub VRF grace period (30 min) is shorter than the spoke's request keep-alive (1 hour) — an honest but slow cross-chain relay silently voids a legitimate win**
### Fix
Align the hub's `vrfResultGracePeriod` with (or make it configurably ≥) the spoke's `requestTimeout`, closing the window where an honest slow relay is silently treated as stale.


## ODA-496-5 (conf 55)
**AMOE router's optional legacy `consumer.recordAmoeEntry` callback is unisolated — a misconfigured consumer bricks the entire ZK AMOE entry path**
### Fix
```diff
  if (address(consumer) != address(0)) {
-     consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId);
+     try consumer.recordAmoeEntry(buyer, creatorCoin, epoch, entryId) {} catch {}
  }
```


## ODA-496-6 (conf 50)
**Oracle deviation circuit-breaker is silently disabled once the reference price for a lane goes stale (bootstrap/re-bootstrap gap)**
### Fix
Apply the deviation check against the last reference regardless of its age (widening the allowed band as elapsed time grows) instead of disabling it outright past the window; refresh the reference on the AMOE path as well (currently only the paid path does).

# Job 497

## ODA-497-1 (conf 80)
**`claimImpairmentRecovery` pays pro-rata entitlement from a live external balance while tracking "already claimed" per address — double-claimable if the claim token is transferable**
### Fix
```diff
-        uint256 claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
-        uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
-        uint256 already = impairmentAmountClaimed[epochId][msg.sender];
-        if (gross <= already) revert NothingToClaim(epochId, msg.sender);
-        amountOut = gross - already;
-        impairmentAmountClaimed[epochId][msg.sender] = gross;
+        // Burn (or otherwise consume) the claim units atomically with payout so a transferred
+        // unit cannot be re-claimed by its new holder. E.g. have the claims contract expose a
+        // burn-and-report-amount call, or move to per-unit (not per-address) claimed tracking
+        // inside OVaultImpairmentClaims itself.
+        uint256 claimUnits = IOVaultImpairmentClaims(impairmentClaims).balanceOf(msg.sender, epochId);
+        uint256 gross = (epoch.totalRecovered * claimUnits) / epoch.totalClaimSupply;
+        uint256 already = impairmentAmountClaimed[epochId][msg.sender];
+        if (gross <= already) revert NothingToClaim(epochId, msg.sender);
+        amountOut = gross - already;
+        impairmentAmountClaimed[epochId][msg.sender] = gross;
+        // At minimum: assert/require the claims contract enforces non-transferability.
```
Simplest robust fix: require `OVaultImpairmentClaims` to be non-transferable (soulbound) and add that as an explicit invariant check at wiring time, or refactor to burn claim units on payout instead of tracking claimed-amount by address.


## ODA-497-2 (conf 75)
**Impairment root's finalize-eligible time is not ordered against the permissionless stale-clear deadline — a legitimate, near-finalized claim can be wiped**
### Fix
```diff
     function proposeImpairmentRoot(
         uint256 epochId,
         bytes32 snapshotRoot,
         uint256 totalClaimSupply,
         address recoveryAsset
     ) external onlyDelegateCall {
         if (snapshotRoot == bytes32(0)) revert InvalidAmount();
         if (recoveryAsset == address(0)) revert ZeroAddress();
         if (impairmentChallengeWindow == 0) revert ChallengeWindowNotConfigured();
         if (epochId == 0 || epochId != activeImpairmentEpoch) revert InvalidImpairmentEpoch(epochId);
 
         ImpairmentEpoch storage epoch = impairmentEpochs[epochId];
         if (epoch.status != ImpairmentEpochStatus.Tripped) revert InvalidImpairmentTransition(epochId);
         if (epoch.snapshotRoot != bytes32(0)) revert ImpairmentRootAlreadyFinalized(epochId);
         if (totalClaimSupply == 0) totalClaimSupply = epoch.totalSharesAtTrip;
 
         epoch.snapshotRoot = snapshotRoot;
         epoch.totalClaimSupply = totalClaimSupply;
         epoch.recoveryAsset = recoveryAsset;
         uint64 unlock = uint64(block.timestamp) + impairmentChallengeWindow;
+        uint64 staleAt = epoch.trippedAt + maxImpairmentTripDuration;
+        if (unlock >= staleAt) revert ImpairmentRootWouldExceedStaleDeadline(unlock, staleAt);
         impairmentRootUnlockTime[epochId] = unlock;
         emit ImpairmentRootProposed(epochId, snapshotRoot, unlock);
     }
```
Alternative: once `snapshotRoot != 0`, have `clearStaleImpairmentTrip` refuse to run (require an authorized `clearImpairmentRootAfterChallenge`/`rejectImpairmentChallenge` path instead once a root exists).


## ODA-497-3 (conf 70)
**`report()` recognizes phantom profit and overcharges performance fees by cycling a strategy through `tripImpairment` → `report()` → `clearImpairmentTrip` → `report()`**
### Fix
```diff
     function report() external onlyDelegateCall returns (uint256 profit, uint256 loss) {
+        if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
         _processProfitUnlock();
         _processValuationHealth();
         _requireStrategyValuationsReady(true);
```
Also add a high-water mark (track the highest `totalAssetsAtLastReport`-equivalent NAV-per-share seen, and only charge performance fee on NAV above that mark) so recovering a previously-booked loss is never re-taxed.


## ODA-497-4 (conf 70)
**Report baseline is decremented by a withdrawal's market value instead of its cost basis, causing phantom-profit fee overcharging on ordinary withdrawals**
### Fix
```diff
-    function _decreaseReportBaselineForPrincipalOutflow(uint256 assetsOut) internal {
-        uint256 baseline = totalAssetsAtLastReport;
-        totalAssetsAtLastReport = assetsOut >= baseline ? 0 : baseline - assetsOut;
-    }
+    function _decreaseReportBaselineForPrincipalOutflow(uint256 sharesBurned, uint256 supplyBeforeBurn) internal {
+        uint256 baseline = totalAssetsAtLastReport;
+        uint256 basisOut = supplyBeforeBurn == 0 ? 0 : (baseline * sharesBurned) / supplyBeforeBurn;
+        totalAssetsAtLastReport = basisOut >= baseline ? 0 : baseline - basisOut;
+    }
```
(Call sites need `sharesBurned`/`supplyBeforeBurn` threaded through instead of `assetsOut`.) This is the same underlying accounting-basis-vs-market-value mismatch that also affects the `notifyImpairmentRecovery` baseline decrement (see Lead below) — fixing the helper's signature fixes both call sites.


## ODA-497-5 (conf 65)
**`queueWithdrawal`/`claimQueuedWithdrawal` omit the `paused` guard that `redeem`/`withdraw` carry — the emergency pause is bypassable for large holders**
### Fix
```diff
     function queueWithdrawal(uint256 shares, address receiver) external onlyDelegateCall {
         _enforceOperatorPermIfGranted(OP_WITHDRAW);
+        if (paused) revert Paused();
         if (shares == 0) revert ZeroShares();
```
```diff
     function claimQueuedWithdrawal() external onlyDelegateCall returns (uint256 assets) {
         if (vaultMode != VaultMode.Normal) revert VaultNotNormal();
+        if (paused) revert Paused();
         _processProfitUnlock();
```

# Job 498

## ODA-498-1 (conf 75)
**Cooldown-propagation hook can be weaponized to force a withdrawal cooldown onto an unwilling victim, enabling sustained low-cost targeted censorship**
### Fix
```diff
     function propagateCooldownOnTransfer(address from, address to, uint256 amount) external {
         if (msg.sender != address(shareOFT)) revert CooldownHookUnauthorizedCaller(msg.sender);
         if (from == address(0) || to == address(0)) return;
         if (from == to) return;
         if (amount == 0) return;

         uint256 fromBlock = lastWrapperDepositBlock[from];
         if (fromBlock == 0) return;

-        uint256 toBlock = lastWrapperDepositBlock[to];
-        if (fromBlock > toBlock) {
-            lastWrapperDepositBlock[to] = fromBlock;
-            emit CooldownPropagated(from, to, fromBlock);
-        }
+        // Only propagate onto a recipient who does not already have an
+        // independent deposit history, and only track the transferred lot's
+        // cooldown rather than stamping the recipient's entire balance —
+        // e.g. maintain a separate "cooled amount" ceiling per address that
+        // caps how much of a *recent* inbound transfer is withdraw-blocked,
+        // instead of overwriting lastWrapperDepositBlock wholesale.
```
Simplest robust fix: track cooldown per *received lot* (amount + block) rather than a single per-address timestamp overwritten by any inbound transfer, so an attacker's dust transfer cannot block a victim's unrelated, already-cooled balance.


## ODA-498-2 (conf 55)
**`flushFees` accepts an unvalidated `composeMsg`/`extraOptions` from a permissionless caller — potential confused-deputy into the hub gauge**
### Fix
```diff
     function flushFees(SendParam calldata _sendParam, MessagingFee calldata _fee) external payable nonReentrant {
         ...
         require(_sendParam.dstEid == hubEid, "Invalid dstEid");
         require(_sendParam.to == bytes32(uint256(uint160(hubGaugeReceiver))), "Invalid receiver");
         require(_sendParam.amountLD == amount, "Amount mismatch");
+        require(_sendParam.composeMsg.length == 0, "No compose allowed");
```
Better: ignore the caller's `SendParam` entirely and reconstruct it internally via `buildFlushSendParam()`, accepting only the `MessagingFee`.


## ODA-498-3 (conf 85)
**Beneficiary operator can siphon a beneficiary's accumulated wrap/unwrap dust via `depositFor`/`withdrawFor`**
### Fix
```diff
-        uint256 vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR + userDustShares[accountingUser];
+        // When accountingUser != the party receiving output (msg.sender), do not fold
+        // accountingUser's dust into msg.sender's payout — either require accountingUser
+        // == msg.sender for dust reclamation, or credit the reclaimed dust back to
+        // accountingUser as a separate balance rather than paying it to the operator.
```


## ODA-498-4 (conf 65)
**`unwrap()` omits the large-withdrawal async-redemption gate the three `withdraw*` paths enforce**
### Fix
```diff
     function unwrap(uint256 amount) external nonReentrant returns (uint256 amountOut) {
         if (amount == 0) revert ZeroAmount();
         if (address(shareOFT) == address(0)) revert ShareOFTNotSet();
         _requireWrapperCooldown(msg.sender);

         amountOut = _unwrapInternal(amount, msg.sender, msg.sender);
+        _requireSynchronousRedemption(amountOut);

         IERC20(address(vault)).safeTransfer(msg.sender, amountOut);
     }
```

