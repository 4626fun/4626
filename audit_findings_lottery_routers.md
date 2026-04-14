# Security Audit: Lottery + Routers + Vesting
**Contracts:** CreatorLotteryManager, ChainlinkVRFIntegratorV2_5, CreatorVRFConsumerV2_5, PayoutRouter, VaultShareBurnStream, CreatorCoinPolicyController, CreatorLinearVesting  
**Scope:** `/home/user/workspace/audit_contracts/contracts/utilities/`  
**Auditor:** Automated Security Review  
**Date:** 2025

---

## Summary Table

| ID | Contract | Severity | Title |
|----|----------|----------|-------|
| CLM-01 | CreatorLotteryManager | HIGH | Overloaded `receiveRandomWords` — VRF type/source confusion |
| CLM-02 | CreatorLotteryManager | HIGH | Late VRF result accepted after timeout without replay guard |
| CLM-03 | CreatorLotteryManager | HIGH | Winner callback silently dropped — jackpot paid but user not notified on winning chain |
| CLM-04 | CreatorLotteryManager | HIGH | `_processWin` → `_payoutLocalJackpot` custom reentrancy guard unsafe with `payoutLock = 0` on exception |
| CLM-05 | CreatorLotteryManager | MEDIUM | Sponsorship rate-limit incremented after VRF call — TOCTOU window allows over-spend |
| CLM-06 | CreatorLotteryManager | MEDIUM | `processSwapLottery` reverts on `callerFeeValue != nativeFee` — griefable via fee front-running |
| CLM-07 | CreatorLotteryManager | MEDIUM | Oracle deviation guard only active within `deviationWindow`; first entry after window re-opens is unprotected |
| CLM-08 | CreatorLotteryManager | MEDIUM | Deferred VRF results (`pendingRandomWord`) processed by anyone — replay via repeated unpause/pause cycle |
| CLM-09 | CreatorLotteryManager | MEDIUM | `_handleLotteryEntry` reverts on payload ≠ 160 or 192 bytes — unexpected length bricks the LZ inbound lane |
| CLM-10 | CreatorLotteryManager | LOW | VRF request stored under `uint256(sequence)` from cross-chain path but may collide with local VRF IDs |
| CLM-11 | CreatorLotteryManager | LOW | Win-chance calculation uses integer division — effective probability loses precision at mid-range USD values |
| CLM-12 | CreatorLotteryManager | LOW | `emergencyWithdraw` callable while lottery is active — admin can drain contract balance (ETH) silently |
| CLM-13 | CreatorLotteryManager | INFO | `setVRFIntegrator` unconditionally adds new integrator to `trustedVrfIntegrators` but does not remove old one |
| VRF-01 | ChainlinkVRFIntegratorV2_5 | HIGH | `cleanupExpiredRequests` does not set `request.exists = false` — re-fulfillment accepted after cleanup |
| VRF-02 | ChainlinkVRFIntegratorV2_5 | HIGH | Late random words accepted unconditionally — manipulator can delay fulfillment to cherry-pick outcomes |
| VRF-03 | ChainlinkVRFIntegratorV2_5 | MEDIUM | `requestRandomWordsPayable(uint32)` bypasses authorization check in `_requestRandomWords` signature mismatch |
| VRF-04 | ChainlinkVRFIntegratorV2_5 | MEDIUM | `requestCounter` as global sequence — cross-chain sequence collision possible if multiple hub peers |
| VRF-05 | ChainlinkVRFIntegratorV2_5 | MEDIUM | Price piggybacking accepts `aggregatedPrice > 0` from hub without upper-bound validation |
| VRF-06 | ChainlinkVRFIntegratorV2_5 | LOW | `setRequestTimeout(0)` allowed — sets effectively no timeout, negating expiry mechanism |
| VRFC-01 | CreatorVRFConsumerV2_5 | HIGH | `rawFulfillRandomWords` accepts any Chainlink VRF coordinator ID, no on-chain subscription whitelist |
| VRFC-02 | CreatorVRFConsumerV2_5 | MEDIUM | `_handleCrossChainResponse` quotes fee at fulfillment but relay uses a separate fresh quote — fee mismatch can DoS relay |
| VRFC-03 | CreatorVRFConsumerV2_5 | MEDIUM | `getAggregatedCreatorPrice` uses remote-reported `timestamp` for staleness — stale/replayed price can pass as fresh |
| VRFC-04 | CreatorVRFConsumerV2_5 | MEDIUM | `relayPendingResponse` requires exact `msg.value == fee.nativeFee` — fee fluctuations lock responses permanently |
| VRFC-05 | CreatorVRFConsumerV2_5 | LOW | `priceReportingChains` array grows unboundedly — no chain removal path; gas DoS at large chain count |
| VRFC-06 | CreatorVRFConsumerV2_5 | LOW | `rateLimitWindowSeconds` can be set to 1 second by owner — effectively disables rate limiting |
| PR-01 | PayoutRouter | HIGH | External swap `swapCallData` is opaque and fully arbitrary — approved swap target can drain router balance |
| PR-02 | PayoutRouter | MEDIUM | `deadline: block.timestamp` in Uniswap V3 swap — expired tx can still execute in same block at unfavorable price |
| PR-03 | PayoutRouter | MEDIUM | `_convertViaExternalAndQueue` overspend check has off-by-one: `tokenInAfter + amountIn < tokenInBefore` |
| PR-04 | PayoutRouter | MEDIUM | `claimProtocolRewards` claims ETH into contract which is wrapped to WETH by `receive()` — no re-entrancy guard on `receive()` side |
| PR-05 | PayoutRouter | LOW | `keeper` can be set to `address(0)` — allows anyone to call `onlyOwnerOrKeeper` functions |
| PR-06 | PayoutRouter | LOW | `emergencyWithdraw` callable by owner at any time — can drain WETH held for processing |
| PR-07 | PayoutRouter | INFO | Infinite approval to vault and swap router in constructor/`setSwapPath` — compromised vault or router drains all tokens |
| BS-01 | VaultShareBurnStream | HIGH | `queueShares` is permissionless — anyone can call it and trigger `PendingEpochMismatch` revert to DoS the stream |
| BS-02 | VaultShareBurnStream | MEDIUM | Epoch boundary: shares queued at end of epoch can be attributed to wrong epoch when `pendingEpochStart != scheduled` |
| BS-03 | VaultShareBurnStream | MEDIUM | No check that `vault` actually holds the `burnSharesForPriceIncrease` role — silent failure on burn |
| BS-04 | VaultShareBurnStream | LOW | `_drip` completed check: `elapsed == EPOCH_DURATION && burnedActive == activeShares` may never be true due to rounding |
| CPC-01 | CreatorCoinPolicyController | MEDIUM | `transferCreatorCoinOwnership` has no two-step pattern — accidental transfer to wrong address is irreversible |
| CLV-01 | CreatorLinearVesting | MEDIUM | `vestedAmount` uses live `token.balanceOf(address(this)) + released` — extra tokens sent to contract inflate vesting schedule |
| CLV-02 | CreatorLinearVesting | LOW | No `release(address)` function — if `beneficiary` is a contract that cannot receive ERC20, tokens are permanently locked |
| CLV-03 | CreatorLinearVesting | INFO | No event emitted on `release` — off-chain monitoring cannot track vesting activity |

---

## Critical Findings

*(None at Critical severity — highest confirmed findings are HIGH.)*

---

## HIGH Findings

### CLM-01 — Overloaded `receiveRandomWords`: VRF type/source confusion

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~540–555

```solidity
// Local VRF callback
function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external nonReentrant {
    if (msg.sender != address(localVRFConsumer)) revert Unauthorized();
    _processVRFResult(requestId, randomWords);
}

// Cross-chain VRF callback
function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external nonReentrant {
    if (msg.sender != address(vrfIntegrator)) revert Unauthorized();
    _processVRFResult(sequence, randomWords);
}
```

**Issue:** The cross-chain `vrfIntegrator` callback stores the VRF request under `uint256(sequence)` (a `uint64` cast), while the local VRF path stores it under the Chainlink VRF `requestId` (a large pseudo-random `uint256`). If `sequence` is small (e.g., 1, 2, 3 ...) it could collide with an existing local VRF `requestId` in the shared `vrfRequests` mapping. Both callbacks share the same mapping `vrfRequests[uint256]`.

**Attack Scenario:**  
1. Local VRF request is issued; Chainlink returns `requestId = 1`.  
2. A cross-chain VRF request arrives with `sequence = 1`.  
3. Whichever callback fires second overwrites the pending `VRFRequest` entry or processes a result for the wrong entry, potentially triggering a win for a different user/creatorCoin than intended.

**Recommended Fix:**  
Use a namespace prefix: store local requests under `keccak256(abi.encode("LOCAL", requestId))` and cross-chain under `keccak256(abi.encode("CC", sequence))`, or maintain separate mappings for each type.

---

### CLM-02 — Late VRF result accepted after timeout without replay guard

**File:** `lottery/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 154–162

```solidity
// Treat lateness as informational only: accept late randomness ...
if (block.timestamp > request.timestamp + requestTimeout) {
    emit RandomWordsReceivedLate(...);
}

request.fulfilled = true;
request.randomWord = randomWord;
```

**Issue:** Expired requests are accepted and the callback is still fired. The comment says "accept late randomness so inbound ordered delivery never bricks", but there is no mechanism for the consumer (CreatorLotteryManager) to detect or reject a stale request. An adversary who can delay message delivery (e.g., a malicious relayer) can withhold the VRF response until block conditions are favorable, then deliver the randomness.

**Attack Scenario:**  
1. VRF request made; randomness is generated by Chainlink.  
2. Adversary (with relayer access or MEV) inspects the `randomWord` — if the result does not win the lottery, they delay delivery.  
3. They wait for a different VRF request from a genuine winner (or a new user with a winning `winChancePPM`), then deliver both results in an order that replaces the losing result timing.  
4. Since there is no expiry enforcement, the delayed response still processes.

**Recommended Fix:**  
In `_lzReceive`, after the `requestTimeout` check, revert or silently discard rather than continue processing. Have `CreatorLotteryManager` track request timestamps and refuse results that arrive after a grace period.

---

### CLM-03 — Winner callback silently dropped when callback sponsorship is disabled or rate-limited

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1040–1095 (`_sendWinnerCallback`)

```solidity
if (!_consumeSponsorship(callbackSponsorshipPolicy, WINNER_CALLBACK_CONTEXT, nativeFee, 0, false)) return;
_lzSend(dstEid, payload, options, fee, payable(address(this)));
```

**Issue:** The jackpot is paid out unconditionally in `_processWin`, but the winner callback to the source chain can be silently skipped if:  
- Callback sponsorship is disabled (`policy.enabled == false`),  
- The per-epoch budget is exhausted,  
- The per-buyer or per-origin rate limit is hit.  

The user wins vault shares but receives no on-chain notification on the chain where they traded. This is a UX failure. More critically, the jackpot is already sent out before the callback is attempted — there is no rollback.

**Recommended Fix:**  
Separate the callback from the jackpot payout path, and require the caller to provide the callback fee via `msg.value`, or emit a reliable on-chain event even if the cross-chain message fails. Document clearly that callback delivery is best-effort.

---

### CLM-04 — Custom `_payoutLock` reentrancy guard leaves `_payoutLock = 1` on exception

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1130–1175 (`_payoutLocalJackpot`)

```solidity
function _payoutLocalJackpot(...) internal returns (uint256) {
    if (_payoutLock == 1) revert ReentrancyGuardReentrantCall();
    _payoutLock = 1;
    ...
    // loop over creators, calling external contracts
    try gaugeController.payJackpot(winner, rewardShares) { ... } catch { ... }
    ...
    _payoutLock = 0;
    return totalPaidOut;
}
```

**Issue:** The custom `_payoutLock` guard is not in a `try/catch` or wrapped with cleanup. If `registry.getAllCreatorCoins()` or any of the subsequent external calls inside the loop causes a **revert** (not caught by the inner `try/catch`), `_payoutLock` remains `1` permanently, permanently locking the payout function.

Specifically, `registry.getAllCreatorCoins()` and `registry.isCreatorCoinActive()` etc. are NOT wrapped in `try/catch` — they can revert. If they do, `_payoutLock` is never reset to `0`.

**Recommended Fix:**  
Use OpenZeppelin `ReentrancyGuard`'s `nonReentrant` modifier instead of a hand-rolled lock. All external calls inside the loop should be wrapped with `try/catch`. If the registry calls must not be in `try/catch`, ensure the lock is always reset in a `finally`-equivalent pattern using assembly or restructure logic.

```solidity
// Pattern fix
_payoutLock = 1;
// ... code ...
_payoutLock = 0; // must always execute
```

This requires that all external calls that are NOT in `try/catch` cannot revert. As written, they can.

---

### VRF-01 — `cleanupExpiredRequests` does not mark requests as non-existent

**File:** `lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 328–339

```solidity
function cleanupExpiredRequests(uint64[] calldata requestIds) external {
    for (uint256 i = 0; i < requestIds.length; i++) {
        uint64 requestId = requestIds[i];
        RequestStatus storage request = s_requests[requestId];

        if (request.exists && !request.fulfilled && block.timestamp > request.timestamp + requestTimeout) {
            address provider = request.provider;
            delete randomWordsProviders[requestId];
            emit RequestExpired(requestId, provider);
            // BUG: request.exists is NOT set to false, request.fulfilled is NOT set
        }
    }
}
```

**Issue:** After cleanup, `request.exists` remains `true` and `request.fulfilled` remains `false`. If a late VRF response arrives after cleanup (which is accepted per CLM-02), the request will still pass the `!request.exists` and `!request.fulfilled` checks in `_lzReceive`, and the callback will fire on a "cleaned up" request. The `provider` is still recorded in `s_requests[requestId].provider` even after `randomWordsProviders[requestId]` is deleted, so the callback can still be fired to `provider`.

**Attack Scenario:** User submits a VRF request; it expires; admin calls `cleanupExpiredRequests`. A late response arrives; the contract processes it and calls back the provider with potentially stale/cherry-picked randomness.

**Recommended Fix:** Set `request.fulfilled = true` and `request.exists = false` in `cleanupExpiredRequests` (or mark a new `expired` boolean) to prevent late responses from triggering callbacks.

---

### VRF-02 — Late random words accepted unconditionally; enables selective delivery attack

**File:** `lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 154–177

```solidity
if (block.timestamp > request.timestamp + requestTimeout) {
    emit RandomWordsReceivedLate(...);
    // continues execution — no return, no revert
}
request.fulfilled = true;
request.randomWord = randomWord;
...
try IRandomWordsCallbackV2_5(provider).receiveRandomWords(randomWords, uint256(sequence)) {
```

**Issue:** An adversary who controls or can influence message delivery timing can hold back the VRF response. If the response contains a non-winning randomWord, they delay it past the timeout. Since the contract emits `RequestExpired` (allowing the consumer to assume the entry failed) but still processes a late response, a second attempt by the user may have already been registered. The attacker then delivers the original late response, potentially executing callbacks out of order.

**Recommended Fix:** After `requestTimeout`, discard the response with a silent return (or emit and return), never processing the callback.

---

### PR-01 — External swap calldata is opaque — approved target can drain router

**File:** `routers/PayoutRouter.sol`  
**Lines:** 411–448 (`_convertViaExternalAndQueue`)

```solidity
inToken.forceApprove(spender, amountIn);
(bool ok, bytes memory returnData) = swapTarget.call(swapCallData);
inToken.forceApprove(spender, 0);
```

**Issue:** `swapCallData` is entirely controlled by the caller (owner or keeper). The `approvedExternalSwapTargets` and `approvedExternalSwapSpenders` lists only guard against unapproved contracts; they do not constrain what function is called or what parameters are passed. An approved swap target could encode a call to `transfer()` or `transferFrom()` to move tokens to an attacker. After the swap, the slippage check (`creatorOut < minCreatorOut`) verifies only that `creatorCoin` balance increased, but says nothing about how much `tokenIn` was consumed or where other tokens went.

**Attack Scenario:**  
1. Owner approves `universalRouter` as a swap target.  
2. Keeper or compromised owner supplies `swapCallData` encoding `transfer(attacker, balance)` rather than a legitimate swap.  
3. `tokenIn` tokens are drained; `creatorOut = 0` fails `minCreatorOut` check only if `minCreatorOut > 0`, but a zero minimum slippage setting bypasses this.

**Recommended Fix:**  
- Require `minCreatorOut > 0` to be validated.  
- Verify that `tokenIn` balance decreased by no more than `amountIn` (the current check is directionally correct but weak — see PR-03).  
- Consider encoding the swap function selector explicitly and validate it against an allowlist.

---

### VRFC-01 — `rawFulfillRandomWords` trusts `vrfCoordinator` address set by owner

**File:** `lottery/vrf/CreatorVRFConsumerV2_5.sol`  
**Lines:** 443–460

```solidity
function rawFulfillRandomWords(uint256 requestId, uint256[] calldata randomWords) external {
    require(msg.sender == address(vrfCoordinator), "Only VRF Coordinator");
    ...
    request.fulfilled = true;
    request.randomWord = randomWords[0];
```

**Issue:** `vrfCoordinator` is a mutable address set by `onlyOwner`. If the owner is compromised, they can point `vrfCoordinator` to an attacker-controlled contract that calls `rawFulfillRandomWords` with arbitrary random words, choosing winning outcomes at will. Since the Chainlink VRF subscription is also owner-controlled (`setVRFConfig`), the entire randomness source can be replaced.

**Attack Scenario:** Owner (or attacker with owner key) calls `setVRFCoordinator(attackerContract)`, then calls `attackerContract.fulfillWithWinningRandomness()` which calls `rawFulfillRandomWords(pendingRequestId, [0])` — `0 % 1_000_000 = 0 < winChancePPM` for any winChancePPM, guaranteed win.

**Recommended Fix:**  
- Make `vrfCoordinator` immutable after deployment, or require a timelock before changes take effect.  
- Alternatively, implement a registry-based check against known Chainlink VRF coordinator addresses.

---

## MEDIUM Findings

### CLM-05 — Sponsorship rate-limit incremented post-VRF — TOCTOU window

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~975–1000

```solidity
try vrfIntegrator.requestRandomWordsPayable{value: nativeFee}(targetEid) returns (...) {
    if (!useCallerFunds && nativeFee > 0) {
        // BUG: incremented AFTER the external call succeeds
        vrfSponsoredCountByBuyer[buyer] = buyerCount + 1;
    }
```

**Issue:** The rate-limit counters are read before the VRF request (`_syncSponsoredCountByBuyer` returns current count), but incremented only after the external VRF call succeeds. In a single block, multiple transactions from the same buyer can each read the same `buyerCount = 0`, pass the rate check `0 < vrfMaxSponsoredPerBuyerPerEpoch`, and each issue a sponsored VRF request before any of them increment the counter. This allows a buyer to exceed the per-epoch sponsored limit within a single block.

**Recommended Fix:** Increment the counters before the external call (optimistic increment), then roll back on failure. Or use a per-buyer nonce stored in storage that is incremented before the external call.

---

### CLM-06 — Exact fee match required causes griefing via fee front-running

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~935

```solidity
if (useCallerFunds && callerFeeValue != nativeFee) {
    revert CallerFeeMismatch(callerFeeValue, nativeFee);
}
```

**Issue:** When a user calls `processSwapLottery` with ETH for the VRF fee, the contract requires an exact match to the quoted fee. LayerZero fees are dynamic and can change between the user quoting the fee off-chain and the transaction being mined. A 1-wei difference reverts the transaction.

**Attack Scenario:**  
1. User queries `vrfIntegrator.quoteFee()` off-chain.  
2. Fee changes by 1 wei before the tx mines.  
3. Transaction reverts; user loses gas.  
4. A griefing bot can spam the LZ endpoint to repeatedly change fees, preventing any user from successfully entering the lottery.

**Recommended Fix:** Accept `msg.value >= nativeFee` and refund excess. Change the check to: `if (useCallerFunds && callerFeeValue < nativeFee) revert CallerFeeMismatch(...)`.

---

### CLM-07 — Oracle deviation guard inactive after `deviationWindow` expires

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~615–635

```solidity
if (maxDeviationBps > 0 && deviationWindow > 0 && lastPrice > 0 && lastTs > 0) {
    if (block.timestamp - lastTs <= deviationWindow) {
        // deviation check only runs if within window
        uint256 deviationBps = FullMath.mulDiv(diff, BASIS_POINTS, lastPrice);
        if (deviationBps > maxDeviationBps) return (0, 0, 0);
    }
}
```

**Issue:** After `deviationWindow` (default 30 minutes) without a new lottery entry for a given creator coin, the reference price expires. The very first new entry after that gap bypasses the deviation check entirely (because `block.timestamp - lastTs > deviationWindow`). An attacker can manipulate the oracle price during that gap, then be the first to enter the lottery at a manipulated price.

**Recommended Fix:** Apply the deviation check unconditionally whenever a valid `lastPrice` exists — do not gate it on `deviationWindow`. The window concept should prevent the reference from being considered stale, not bypass the check.

---

### CLM-08 — Deferred VRF results can be processed multiple times via unpause/pause

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~557–580

```solidity
function processPendingVrfResult(uint256 requestId) external whenNotPaused nonReentrant {
    if (!hasPendingRandomWord[requestId]) revert NoPendingVrfResult(requestId);
    uint256 word = pendingRandomWord[requestId];
    delete pendingRandomWord[requestId];
    delete hasPendingRandomWord[requestId];
    ...
    _processVRFResult(requestId, randomWords);
```

**Issue:** Inside `_processVRFResult`, if the contract is paused (which it cannot be at this point due to `whenNotPaused`), the result is re-deferred. However, if the VRF callback fires again during a subsequent pause cycle (e.g., the cross-chain integrator re-delivers), a fresh `pendingRandomWord` entry is created for the same `requestId`. Since `vrfRequests[requestId]` is deleted only after successful processing but the deferred state is stored separately, there is a narrow window where the same `requestId` could be processed twice if `vrfRequests` is repopulated.

More directly: `processPendingVrfResult` is callable by anyone. An adversarial actor can call it immediately when the contract unpauses, processing all pending results before legitimate users can react.

**Recommended Fix:** Access-control `processPendingVrfResult` to owner/keeper, or process all pending results atomically on unpause.

---

### CLM-09 — `_handleLotteryEntry` reverts on unexpected payload length — bricks LZ inbound lane

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~815–840

```solidity
function _handleLotteryEntry(uint32 srcEid, bytes32 originSender, bytes calldata _payload) internal {
    ...
    if (_payload.length == 192) {
        ...
    } else if (_payload.length == 160) {
        ...
    } else {
        revert InvalidAmount(); // <-- REVERTS
    }
```

**Issue:** Unlike the VRF contracts which explicitly avoid reverting in `_lzReceive` to prevent bricking the ordered delivery lane, `_handleLotteryEntry` reverts on an unrecognized payload length. If a remote OFT sends a message with a different encoding (e.g., a future v3 payload format, or padding), the entire inbound lane from that chain is permanently blocked.

**Recommended Fix:** Replace the `revert` with a silent `return` (and emit an `InvalidPayload` event for monitoring), consistent with the LZ best-practice pattern used in the VRF contracts.

---

### CLM-10 — VRF request ID namespace collision between local and cross-chain paths

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1010 and ~850 (two separate `vrfRequests[id] = ...` assignments)

**Issue:** Both paths write to `vrfRequests[uint256]`. Local VRF returns a large random `requestId` from Chainlink (e.g., `12345678901234567890`). Cross-chain VRF uses `uint64(sequence)` which starts at 1 and increments by 1 per request. While a collision is unlikely in practice, the first ~18 quintillion local Chainlink IDs overlap the 0–2^64 range of sequence numbers. More relevantly, if `useLocalVRF` is toggled mid-operation, outstanding requests from one mode can be silently overwritten by new requests in the other mode.

**Recommended Fix:** Use separate mappings or key namespacing as described in CLM-01.

---

### VRF-03 — `requestRandomWordsPayable(uint32)` bypasses authorization check

**File:** `lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 236–249, 251–260

```solidity
function requestRandomWordsPayable(uint32 targetEid)
    external
    payable
    returns (MessagingReceipt memory receipt, uint64 requestId)
{
    return _requestRandomWords(targetEid, true);
}

function _requestRandomWords(uint32 dstEid, bool payable_)
    internal
    returns (...)
{
    // Permission the *entire* request surface ...
    if (!authorizedSponsoredCallers[msg.sender]) revert UnauthorizedSponsoredCaller();
```

**Issue:** The comment on line 255 says "Permission the *entire* request surface (including payable variants)", but the authorization check is inside `_requestRandomWords`, which is called by `requestRandomWordsPayable`. This is **correct**. However, the no-argument `requestRandomWordsPayable()` (line 247) also calls `_requestRandomWords(hubEid, true)`, which also checks authorization. Both checks correctly fire.

**Note:** Upon close review, the authorization is in `_requestRandomWords` and applies to all variants. The risk here is lower than initially flagged. However, there is still an issue: `requestRandomWordsPayable(uint32 targetEid)` accepts any `targetEid` input, then `_requestRandomWords` validates `require(dstEid == hubEid)`. This means the external function appears to support multi-hub routing but the require immediately reverts anything that isn't the configured hub — confusing API that may cause integrators to try to route to a different hub without proper configuration.

**Recommended Fix:** Remove the `targetEid` parameter from the public payable function if it is always forced to `hubEid`, or document the constraint explicitly.

---

### VRF-04 — Global `requestCounter` creates sequence collision risk

**File:** `lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 264–278

```solidity
requestCounter++;
requestId = requestCounter;
...
s_requests[requestId] = RequestStatus({ ... });
randomWordsProviders[requestId] = msg.sender;
```

**Issue:** `requestCounter` is a single global `uint64` monotonically incrementing counter. The mapping key in `sequenceToRequestId` on the hub (`CreatorVRFConsumerV2_5`) is `(srcEid, sequence)`. If two different remote spoke chains use the same `ChainlinkVRFIntegratorV2_5` contract (which is per-chain), they each have their own counter starting at 1. The hub correctly namespaces by `(srcEid, sequence)`. However, within a single spoke, if the spoke contract is re-deployed and the counter resets, old requests at sequences 1, 2, 3... are overwritten by new requests with the same sequence numbers in `s_requests[requestId]`.

**Recommended Fix:** Use a nonce that encodes the deployment timestamp or block number to prevent sequence resets from causing collisions.

---

### VRF-05 — Aggregated price accepts remote-reported `timestamp` without upper-bound validation

**File:** `lottery/vrf/CreatorVRFConsumerV2_5.sol`  
**Lines:** 324–328

```solidity
if (
    remotePriceReportingEnabled && reportedPrice > 0 && priceTimestamp > 0
        && priceTimestamp <= block.timestamp  // only checks it's not in the future
) {
    _updateChainPrice(_origin.srcEid, reportedPrice, priceTimestamp);
}
```

**Issue:** The timestamp used for staleness checks in `getAggregatedCreatorPrice` is the remote-chain-reported `priceTimestamp`, not the local receipt time (`block.timestamp`). A remote chain can report a `priceTimestamp` that is 1 second ago (within staleness window), even if the actual price observation was much older — the spoke chain simply lies about the timestamp. This means a stale price passes as fresh.

**Recommended Fix:** Use `block.timestamp` as the observed-at timestamp (stored in `lastUpdated`) rather than the remote-reported timestamp for staleness calculations. The `priceTimestamp` can be stored for informational purposes but should not gate freshness.

---

### VRFC-02 — Relay fee quoted at fulfillment differs from relay execution quote — can permanently lock response

**File:** `lottery/vrf/CreatorVRFConsumerV2_5.sol`  
**Lines:** 479–483, 498–499

```solidity
function _handleCrossChainResponse(uint256 requestId, VRFRequest storage request, uint256[] calldata) internal {
    (MessagingFee memory fee,) = _quoteResponseFee(request);
    // fee is just emitted as a hint, not stored
    emit ResponseQueuedForRelay(request.sequence, requestId, request.sourceChainEid, fee.nativeFee);
}

function relayPendingResponse(uint32 srcEid, uint64 sequence) external payable nonReentrant {
    (MessagingFee memory fee,) = _quoteResponseFee(request);
    if (msg.value != fee.nativeFee) revert RelayFeeMismatch(msg.value, fee.nativeFee);
```

**Issue:** `_quoteResponseFee` includes `getAggregatedCreatorPrice()` in the payload, and LayerZero fees depend on payload size and network conditions. The fee emitted in `ResponseQueuedForRelay` (at fulfillment time) is a snapshot. When a relayer calls `relayPendingResponse`, the fee is re-quoted including a fresh `aggregatedPrice` and `block.timestamp`. If these change the payload's ABI-encoded size (they don't — both are `int256` and `uint256`), or if LZ fee rates change, the relayer will supply the wrong amount and the `RelayFeeMismatch` error fires. Since the check requires exact equality (`msg.value != fee.nativeFee`), even a 1-wei change permanently locks the response.

**Recommended Fix:** Accept `msg.value >= fee.nativeFee` and refund excess, as is standard practice for LZ fee patterns.

---

### VRFC-03 — Remote-reported `timestamp` used for staleness — replay attack possible

(See VRF-05 above — same root cause in `CreatorVRFConsumerV2_5`.)

---

### VRFC-04 — `relayPendingResponse` exact fee check permanently locks unfulfillable responses

(Covered in VRFC-02 above.)

---

### PR-02 — `deadline: block.timestamp` allows sandwiching

**File:** `routers/PayoutRouter.sol`  
**Lines:** 397–404

```solidity
creatorOut = ISwapRouterV3(swapRouter).exactInput(
    ISwapRouterV3.ExactInputParams({
        path: path,
        recipient: address(this),
        deadline: block.timestamp,  // <-- always current block
        amountIn: amountIn,
        amountOutMinimum: minCreatorOut
    })
);
```

**Issue:** Setting `deadline: block.timestamp` makes the deadline effectively useless — the transaction always executes in the current block, which is when `block.timestamp` is set. The purpose of the deadline is to prevent a transaction from being held in the mempool and executed much later at a worse price. Using `block.timestamp` means a keeper transaction queued in the mempool can be delayed indefinitely (held by the node) until it mines at an arbitrarily future time, with no deadline protection.

**Recommended Fix:** Use `block.timestamp + acceptableDelay` (e.g., `block.timestamp + 15 minutes`) as the deadline. This is configurable per keeper deployment.

---

### PR-03 — External swap overspend check has logic error

**File:** `routers/PayoutRouter.sol`  
**Lines:** 438–441

```solidity
uint256 tokenInAfter = inToken.balanceOf(address(this));
if (tokenInAfter + amountIn < tokenInBefore) {
    revert ExternalSwapOverspent(tokenIn, tokenInBefore - tokenInAfter, amountIn);
}
```

**Issue:** The check `tokenInAfter + amountIn < tokenInBefore` allows the swap to consume up to `amountIn` of `tokenIn`, which is the correct intent. However, the logic should be:
```
tokenInBefore - tokenInAfter > amountIn
```
which is equivalent to `tokenInAfter < tokenInBefore - amountIn` or `tokenInAfter + amountIn < tokenInBefore`. This is **mathematically correct** (if `tokenInAfter + amountIn < tokenInBefore`, the swap consumed more than `amountIn`).

However, there is a subtle issue: the check uses regular arithmetic. If `tokenInAfter` is very large and `amountIn` is also large, `tokenInAfter + amountIn` could overflow `uint256`. In Solidity 0.8+ this reverts rather than wrapping, which would cause a false positive "overflowed" revert rather than the intended overSpend check.

In practice, ERC20 balances fit within `uint256` without overflow, but the check should be rewritten for clarity:
```solidity
if (tokenInBefore - tokenInAfter > amountIn) revert ExternalSwapOverspent(...);
```
which avoids any addition overflow risk.

**Recommended Fix:** Rewrite as `if (tokenInBefore - tokenInAfter > amountIn)`.

---

### PR-04 — `claimProtocolRewards` claims ETH → `receive()` wraps → no reentrancy guard on `receive()`

**File:** `routers/PayoutRouter.sol`  
**Lines:** 476–485, 186–191

```solidity
function _claimProtocolRewards(uint256 amount) internal {
    (bool ok,) = PROTOCOL_REWARDS.call(abi.encodeWithSelector(bytes4(0xf3fef3a3), address(this), amount));
    // ETH arrives via receive()
```

```solidity
receive() external payable {
    if (msg.value > 0) {
        IWETH(weth).deposit{value: msg.value}();
    }
}
```

**Issue:** When `claimProtocolRewards` is called (which has `nonReentrant`), the ETH flows into `receive()` which calls `IWETH(weth).deposit{value: msg.value}()`. The `receive()` function does NOT have the `nonReentrant` modifier. If `WETH.deposit` were to re-enter the router (unlikely for standard WETH but possible for exotic WETH implementations), the reentrancy guard in the calling function is already locked but `receive()` is not guarded. More practically, any ETH sent directly to the router triggers `receive()` and wraps it automatically — this is a design that conflates the "hold" and "process" states of ETH.

**Recommended Fix:** Add documentation noting `receive()` is intentionally state-modifying. If WETH is guaranteed to be a trusted contract (standard WETH), this is acceptable risk. Otherwise, hold raw ETH in receive() and wrap lazily in the processing functions.

---

### BS-01 — `queueShares` is permissionless — DoS via `PendingEpochMismatch`

**File:** `routers/VaultShareBurnStream.sol`  
**Lines:** 108–125, 138–140

```solidity
function queueShares(uint256 shares) public nonReentrant {
    _queueSharesInternal(shares);
}

function _queueSharesAfterRollover(uint256 shares) internal {
    ...
    uint256 scheduled = nextEpochStart(block.timestamp);
    if (pendingShares == 0) {
        pendingEpochStart = scheduled;
    } else if (pendingEpochStart != scheduled) {
        revert PendingEpochMismatch(pendingEpochStart, scheduled);
    }
    pendingShares += shares;
}
```

**Issue:** `queueShares` is `public` with no access control. Anyone can call it with `shares = 0`... wait, that would revert on `ZeroAmount`. However, consider this: vault shares can be directly sent to this contract by anyone (standard ERC20 transfer). If an attacker sends vault shares directly and calls `syncUnaccounted()` or `queueShares(1)` at an epoch boundary (one epoch for `pendingEpochStart` being epoch N, then next epoch N+1 starts), they can trigger the `PendingEpochMismatch` revert permanently.

More critically, the legitimate `PayoutRouter.queueShares(sharesQueued)` call can be front-run. If an attacker calls `queueShares(1)` (after sending 1 vault share to the contract) just before an epoch boundary, and the legitimate router tries to queue shares after the epoch rolls over, the `pendingEpochStart` mismatch revert fires.

**Recommended Fix:** Add access control to `queueShares` (only callable by authorized routers), or remove the `PendingEpochMismatch` revert and instead auto-advance to the correct epoch.

---

### BS-02 — Epoch boundary: shares arriving at epoch N can silently delay to epoch N+2

**File:** `routers/VaultShareBurnStream.sol`  
**Lines:** 113–121

```solidity
uint256 scheduled = nextEpochStart(block.timestamp);
if (pendingShares == 0) {
    pendingEpochStart = scheduled;
} else if (pendingEpochStart != scheduled) {
    revert PendingEpochMismatch(pendingEpochStart, scheduled);
}
```

**Issue:** If `pendingShares > 0` from epoch N, and a new epoch N+1 begins, and `_rolloverIfNeeded` has NOT been called to activate the pending bucket (e.g., `activeShares > 0` so `_startPendingInternal` is skipped), then a new `queueShares` call during epoch N+1 tries to use `nextEpochStart(block.timestamp)` = epoch N+2, which mismatches `pendingEpochStart = epoch N+1`. This reverts and blocks all future queuing until `checkpoint()` is called.

This is a normal operational requirement, but the error message says "investigate misconfiguration" — yet it's actually expected behavior when the keeper misses a checkpoint. This should be better documented and the resolution path automated.

**Recommended Fix:** In `_queueSharesAfterRollover`, if `pendingEpochStart != scheduled` and `activeShares == 0`, auto-start the pending shares and re-queue rather than reverting.

---

### BS-03 — No validation that vault supports `burnSharesForPriceIncrease`

**File:** `routers/VaultShareBurnStream.sol`  
**Lines:** 217

```solidity
ICreatorOVaultBurn(vault).burnSharesForPriceIncrease(burnedNow);
```

**Issue:** `_drip` calls `vault.burnSharesForPriceIncrease(burnedNow)` without a `try/catch`. If the vault has revoked the burn stream's permission, or if the vault is paused, or if the vault address is stale (contract upgraded), `_drip` reverts. Since `_drip` is called inside `nonReentrant` functions and can be called by anyone, a failing vault causes `drip()`, `checkpoint()`, `start()`, and `queueShares()` (via `_rolloverIfNeeded`) to all revert permanently.

**Recommended Fix:** Wrap the `burnSharesForPriceIncrease` call in a `try/catch`. On failure, emit an event and allow the stream state to advance (recording the failed burn amount separately for manual recovery).

---

### CPC-01 — `transferCreatorCoinOwnership` has no two-step ownership transfer

**File:** `routers/CreatorCoinPolicyController.sol`  
**Lines:** 47–51

```solidity
function transferCreatorCoinOwnership(address newOwner) external onlyOwner {
    if (newOwner == address(0)) revert ZeroAddress();
    ICreatorCoinAdmin(creatorCoin).transferOwnership(newOwner);
    emit CreatorCoinOwnershipTransferred(creatorCoin, newOwner);
}
```

**Issue:** Ownership of `creatorCoin` is transferred in a single step. A typo or incorrect address passed as `newOwner` permanently transfers ownership to the wrong address. The `CreatorCoin` contract's `transferOwnership` is the underlying OZ function which also does single-step transfer (unless it implements Ownable2Step). There is no accept/confirm step.

**Recommended Fix:** Use a two-step pattern (propose + accept) or at minimum add a confirmation parameter (e.g., require `newOwner` as both argument and in a separate call within the same block). If the underlying `CreatorCoin` uses `Ownable2Step`, this concern is partially mitigated.

---

### CLV-01 — `vestedAmount` uses live balance — extra tokens inflate vesting

**File:** `vesting/CreatorLinearVesting.sol`  
**Lines:** 34–42

```solidity
function vestedAmount(uint64 timestamp) public view returns (uint256) {
    uint256 total = token.balanceOf(address(this)) + released;
    ...
    return (total * elapsed) / uint256(durationSeconds);
}
```

**Issue:** `total` is computed as the current token balance plus already-released tokens. If anyone sends extra tokens to the vesting contract (e.g., an accidental transfer or dust), those tokens immediately inflate `total` and thus inflate the `vestedAmount` at every point in the schedule. This means the beneficiary can claim tokens that were not originally allocated to them.

**Attack Scenario:**  
1. Vesting contract holds 1000 tokens over 1 year.  
2. Attacker sends 1000 extra tokens to the contract.  
3. `total = 2000`; beneficiary can now claim 2x their entitlement.

**Recommended Fix:** Record `totalAllocation` at construction time (or at first deposit via a `seed()` function) and use that fixed amount rather than the live balance.

```solidity
uint256 public totalAllocation; // set in constructor or via seed()
function vestedAmount(uint64 timestamp) public view returns (uint256) {
    uint256 total = totalAllocation;
    ...
}
```

---

## LOW Findings

### CLM-11 — Win chance integer division loses precision at mid-range USD values

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~640–660

```solidity
uint256 chanceRange = lotteryConfig.maxWinChance - lotteryConfig.baseWinChance;
winChancePPM = lotteryConfig.baseWinChance + (scaledAmount * chanceRange / maxScale);
```

**Issue:** `scaledAmount * chanceRange` is divided by `maxScale = 9_999_000_000`. For small `scaledAmount` values (e.g., a $2 trade: `scaledAmount = 1_000_000`), the numerator is `1_000_000 * (150_000 - 40) = ~149_960_000_000`, divided by `9_999_000_000 ≈ 14`. The result loses the fractional part. While this is typical for integer math, the actual win probability has a step-function shape rather than a smooth curve. This is an informational note rather than a security vulnerability.

**Recommended Fix:** Use fixed-point arithmetic (multiply by `1e18` before dividing) if smooth probability scaling is desired.

---

### CLM-12 — `emergencyWithdraw` drains ETH while lottery is active

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1490–1500

```solidity
function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
    if (token == address(0)) {
        (bool ok,) = payable(owner()).call{value: amount}("");
```

**Issue:** The owner can withdraw ETH even when the lottery is not paused. The ETH balance is used to fund sponsored VRF requests and winner callbacks. If the owner drains ETH while the lottery is active, VRF requests will fail (insufficient balance) in a non-obvious way — entries appear to be submitted but no VRF request is sent.

**Recommended Fix:** Add `whenPaused` modifier to `emergencyWithdraw`, or limit the withdrawable amount to `balance - minimumOperatingBalance`.

---

### CLM-13 — Old `vrfIntegrator` remains trusted after being replaced

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1345–1355

```solidity
function setVRFIntegrator(address _integrator) external onlyOwner {
    vrfIntegrator = IChainlinkVRFIntegrator(_integrator);
    if (_integrator != address(0)) {
        trustedVrfIntegrators[_integrator] = true;
    }
    // Old integrator is NOT removed from trustedVrfIntegrators
}
```

**Issue:** When `vrfIntegrator` is updated, the old integrator address remains in `trustedVrfIntegrators`. The cross-chain VRF callback `receiveRandomWords(uint256[] memory randomWords, uint256 sequence)` checks `msg.sender != address(vrfIntegrator)` — so only the current integrator can call it. This is correct. However, any contract that queries `trustedVrfIntegrators` directly (or future logic that iterates over trusted integrators) would include the stale entry.

**Recommended Fix:** Remove the old integrator from `trustedVrfIntegrators` in `setVRFIntegrator`: `trustedVrfIntegrators[address(vrfIntegrator)] = false` before updating the reference.

---

### VRF-06 — `setRequestTimeout(0)` disables timeout entirely

**File:** `lottery/vrf/ChainlinkVRFIntegratorV2_5.sol`  
**Lines:** 310–312

```solidity
function setRequestTimeout(uint256 _timeout) external onlyOwner {
    requestTimeout = _timeout;
}
```

**Issue:** If owner sets `requestTimeout = 0`, then `block.timestamp > request.timestamp + 0` is always true after the first block. This means every request is considered expired immediately upon creation, but still processed (since expiry is only informational). Combined with VRF-01/02, this completely disables expiry semantics.

**Recommended Fix:** Enforce a minimum timeout value: `require(_timeout >= 1 minutes, "Timeout too short")`.

---

### VRFC-05 — `priceReportingChains` array grows unboundedly

**File:** `lottery/vrf/CreatorVRFConsumerV2_5.sol`  
**Lines:** 574–583

```solidity
function _updateChainPrice(uint32 chainEid, int256 price, uint256 timestamp) internal {
    if (!hasPriceReported[chainEid]) {
        priceReportingChains.push(chainEid);
        hasPriceReported[chainEid] = true;
    }
    ...
}
```

**Issue:** Once a chain reports a price, it is permanently added to `priceReportingChains`. There is no way to remove a chain from this array. `getAggregatedCreatorPrice` iterates over all reporting chains on every price aggregation call. If many chains become defunct or are removed from `supportedChains`, they still loop and consume gas. At large scale, this becomes a gas DoS on price queries and VRF response relay.

**Recommended Fix:** Add a `removeChain` function that also removes the chain from `priceReportingChains`, or use an enumerable set.

---

### VRFC-06 — `rateLimitWindowSeconds` can be set to 1 second

**File:** `lottery/vrf/CreatorVRFConsumerV2_5.sol`  
**Lines:** 662–668

```solidity
function setRateLimitDefaults(uint64 windowSeconds, uint64 maxRequestsPerWindow, bool enabled) external onlyOwner {
    if (windowSeconds == 0) revert InvalidRateLimitConfig();
    rateLimitWindowSeconds = windowSeconds;
```

**Issue:** Only `windowSeconds == 0` is rejected. Setting `windowSeconds = 1` (1 second) effectively resets the window every second, allowing `defaultMaxRequestsPerWindow` (default: 10) requests per second per chain — 600 per minute, defeating the rate limit intent.

**Recommended Fix:** Enforce `windowSeconds >= 60`.

---

### PR-05 — `keeper = address(0)` allows anyone to call `onlyOwnerOrKeeper`

**File:** `routers/PayoutRouter.sol`  
**Lines:** 148–151

```solidity
modifier onlyOwnerOrKeeper() {
    if (msg.sender != owner() && msg.sender != keeper) revert NotAuthorized();
    _;
}
```

**Issue:** `keeper` defaults to `address(0)`. If `setKeeper` is called with `address(0)` to "remove" the keeper, `msg.sender != address(0)` is always true (no actual Ethereum account has address(0)), so `onlyOwnerOrKeeper` effectively becomes `onlyOwner`. This is safe behavior but confusing.

More importantly, if the constructor set `keeper = address(0)` initially and the owner never sets a keeper, the modifier works correctly. However, if the contract is used in a system where `keeper` is intentionally set to zero to represent "no keeper" (clear-keeper pattern), and code is later added that checks `keeper != address(0)` before doing certain operations, this could be misread.

**Recommended Fix:** Add `require(newKeeper != address(0), "Use removeKeeper()")` in `setKeeper`, and add a separate `removeKeeper()` function that documents the intent.

---

### PR-06 — `emergencyWithdraw` can drain WETH held for pending processing

**File:** `routers/PayoutRouter.sol`  
**Lines:** 328–341

**Issue:** `emergencyWithdraw` is callable by the owner at any time and can transfer any token including WETH. WETH held in the router is accumulating from wrapped ETH (from `receive()`) pending the next keeper call. Draining WETH leaves revenue that was already earned unprocessed, violating the "not trust me bro" enforceability goal described in the NatSpec.

**Recommended Fix:** This is an intended design for genuine emergencies, but the NatSpec should explicitly state this is an admin override that breaks enforceability. Alternatively, restrict `emergencyWithdraw` to non-WETH and non-creatorCoin tokens.

---

### BS-04 — Stream completion condition may never be true due to rounding

**File:** `routers/VaultShareBurnStream.sol`  
**Lines:** 210–228

```solidity
uint256 burnableTotal = (activeShares * elapsed) / EPOCH_DURATION;
if (burnableTotal <= burnedActive) return 0;

burnedNow = burnableTotal - burnedActive;
burnedActive = burnableTotal;
...
if (elapsed == EPOCH_DURATION && burnedActive == activeShares) {
    emit StreamCompleted(...);
    activeShares = 0;
```

**Issue:** `burnableTotal = (activeShares * elapsed) / EPOCH_DURATION` uses integer division. When `elapsed == EPOCH_DURATION`, `burnableTotal = activeShares` exactly (since `elapsed / EPOCH_DURATION = 1`). So `burnedActive` becomes `activeShares` and the completion condition fires correctly.

However, if `activeShares` is very large and `EPOCH_DURATION = 604800`, then `(activeShares * 604800) / 604800 = activeShares` which is exact integer math. This appears safe.

The real edge case: if `_drip` is called with `elapsed = EPOCH_DURATION - 1` (one second before epoch end), `burnableTotal = (activeShares * (EPOCH_DURATION - 1)) / EPOCH_DURATION` which via integer division is `activeShares - 1` (approximately). Then at `elapsed = EPOCH_DURATION`, `burnableTotal = activeShares`, `burnedNow = 1`, and completion fires. This is correct but results in a 1-share final drip rather than true linear distribution.

The actual risk: `burnedActive < activeShares` at epoch end if `drip()` is called at `elapsed == EPOCH_DURATION` but `burnableTotal` (due to rounding in prior drip calls) accumulated to `activeShares - k` for small `k`. In that case `burnedActive != activeShares` and the completion event does not emit, leaving `activeShares` non-zero permanently.

**Recommended Fix:** When `elapsed >= EPOCH_DURATION`, force `burnedNow = activeShares - burnedActive` (burn remainder) and always emit completion.

---

### CLV-02 — `beneficiary` is immutable — tokens locked if beneficiary cannot receive ERC20

**File:** `vesting/CreatorLinearVesting.sol`  
**Lines:** 49–54

```solidity
function release() external returns (uint256 amount) {
    amount = releasable();
    if (amount == 0) return 0;
    released += amount;
    token.safeTransfer(beneficiary, amount);
}
```

**Issue:** `beneficiary` is `immutable`. If the beneficiary address is a contract that does not implement an ERC20 receive handler (e.g., a multisig that was self-destructed, a contract without a token receiver), the `safeTransfer` will either succeed (ERC20 transfers don't require a receiver hook) or the tokens will be permanently locked in the beneficiary contract with no recovery path.

More practically, there is no `release(address to)` override. If the beneficiary wants tokens directed to a different address (e.g., DeFi deposit in same tx), they cannot do so.

**Recommended Fix:** Add `release(address to)` that allows the beneficiary to redirect tokens, callable only by `beneficiary`.

---

### CLV-03 — No event emitted on `release`

**File:** `vesting/CreatorLinearVesting.sol`  
**Lines:** 49–54

**Issue:** The `release()` function transfers tokens without emitting an event. This makes off-chain monitoring of vesting activity impossible without parsing internal ERC20 Transfer events and correlating them with the vesting contract address.

**Recommended Fix:** Emit `event Released(address indexed beneficiary, uint256 amount)` in `release()`.

---

## INFO Findings

### CLM-I1 — `LotteryWon` event emits `0` for `entryId` and `tokenValue` in multi-vault payout

**File:** `lottery/CreatorLotteryManager.sol`  
**Lines:** ~1163

```solidity
emit LotteryWon(creatorCoin, 0, winner, rewardShares, 0);
```

The `entryId` and `tokenValue` are hardcoded to `0` inside `_payoutLocalJackpot`, losing traceability from prize payout back to the original VRF request.

---

### PR-I1 — Hardcoded `PROTOCOL_REWARDS` address

**File:** `routers/PayoutRouter.sol`  
**Lines:** 87

```solidity
address public constant PROTOCOL_REWARDS = 0x7777777F279eba3d3Ad8F4E708545291A6fDBA8B;
```

This is hardcoded as a constant. If Zora ever migrates or the contract is deployed on a chain where this address differs, the `claimProtocolRewards` function will silently fail or interact with the wrong contract. Consider using a constructor parameter.

---

## Gas Optimization Notes

1. **CreatorLotteryManager** `_payoutLocalJackpot` calls `registry.getAllCreatorCoins()` which returns an unbounded array. As the creator ecosystem grows, this loop's gas cost grows linearly. At ~100 creator coins, the loop may exceed block gas limits. **Consider paginated payouts or a max-vault cap.**

2. **CreatorVRFConsumerV2_5** `getAggregatedCreatorPrice` iterates over `priceReportingChains` on every VRF response relay quote. This is called inside `_handleCrossChainResponse` which runs in the VRF callback. High chain counts increase gas usage in the VRF callback, potentially causing OOG failures.

3. **VaultShareBurnStream** `_rolloverIfNeeded` calls `_drip()` which calls external `vault.burnSharesForPriceIncrease` and `vault.pricePerShare`. These external calls run inside `queueShares` and `checkpoint`, meaning even simple share-queuing operations incur vault interaction costs.

---

## Findings by Severity Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 7 |
| MEDIUM | 15 |
| LOW | 10 |
| INFO | 4 |
| **Total** | **36** |

---

## Priority Remediation Order

1. **CLM-04** — Fix custom payout lock that can permanently freeze jackpot payouts (custom reentrancy guard missing try/catch)  
2. **VRF-01** — Fix `cleanupExpiredRequests` to mark requests as fulfilled/nonexistent  
3. **CLM-01 / CLM-10** — Separate local vs cross-chain VRF request ID namespaces  
4. **VRF-02 / CLM-02** — Enforce timeout: discard late VRF responses  
5. **VRFC-01** — Consider immutable VRF coordinator address to prevent oracle manipulation  
6. **PR-01** — Tighten external swap calldata validation (require `minCreatorOut > 0`)  
7. **BS-01** — Add access control to `queueShares`  
8. **CLV-01** — Fix vesting total allocation to use fixed amount, not live balance  
9. **CLM-09** — Replace revert with emit+return in `_handleLotteryEntry` for unknown payload lengths  
10. **CLM-06** — Accept `msg.value >= nativeFee` in `processSwapLottery` and refund excess  
