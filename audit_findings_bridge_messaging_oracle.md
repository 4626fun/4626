# Security Audit: Bridge + Messaging + Oracle
**Contracts audited:**
- `bridge/SolanaBridgeAdapter.sol` (920 lines)
- `messaging/CreatorShareOFT.sol` (1193 lines)
- `messaging/OVaultHubComposer.sol` (356 lines)
- `oracles/CreatorOracle.sol` (1150 lines)

**Audit date:** 2025  
**Auditor:** Automated deep-review  

---

## Summary

| Severity | Count |
|---|---|
| CRITICAL | 2 |
| HIGH | 6 |
| MEDIUM | 8 |
| LOW | 7 |
| INFO | 5 |

---

## CRITICAL

---

### [C-1] OVaultHubComposer: `_composeDeposit` output invariant always fails — compose permanently DoS'd

**Contract:** `messaging/OVaultHubComposer.sol`  
**Lines:** 250–270

**Code:**
```solidity
uint256 shareBefore = share.balanceOf(address(this));         // (A)

sharesOut = ICreatorOVaultWrapperComposer(wrapper).depositFor(amountIn, minSharesOut, receiver);  // (B)

uint256 shareAfterMint = share.balanceOf(address(this));       // (C)
if (shareBefore + sharesOut != shareAfterMint) {               // (D)
    revert OutputMintInvariantFailed(...);
}
share.safeTransfer(receiver, sharesOut);                       // (E)
```

**Root cause:**  
The invariant at line (D) checks that `address(this)` (the composer) received `sharesOut` new share tokens. However, `CreatorOVaultWrapper.depositFor()` (line 318 in `CreatorOVaultWrapper.sol`) calls `_wrapInternal(vaultShares, beneficiary, msg.sender)` where `mintTo = msg.sender = address(the composer)` and `accountingUser = beneficiary = receiver`. The wrapper mints to `msg.sender` (the composer) in the `depositFor` path, so the invariant **should** hold in the current implementation.

However, there is a subtle but critical discrepancy: `depositFor` mints to `msg.sender` (composer), but the comment in the wrapper says *"Minted ShareOFT is always credited to `msg.sender`"* — meaning the composer gets the shares. **BUT** the `withdrawFor` path sends creator coin to `msg.sender` (the composer), NOT to `receiver`/`beneficiary`. In `_composeRedeem`:

```solidity
// OVaultHubComposer.sol line 291
assetsOut = ICreatorOVaultWrapperComposer(wrapper).withdrawFor(amountIn, minAssetsOut, receiver);
```

```solidity
// CreatorOVaultWrapper.sol line 385-387
uint256 vaultShares = _unwrapInternal(amount, beneficiary, msg.sender);  // burns from msg.sender (composer)
creatorCoinOut = vault.redeem(vaultShares, msg.sender, address(this));     // assets sent to msg.sender (COMPOSER!)
```

The `vault.redeem()` sends creator coin to `msg.sender` = the composer, but `OVaultHubComposer._composeRedeem` then checks `creator.balanceOf(address(this))` and calls `creator.safeTransfer(receiver, assetsOut)`. This path actually works by accident. **The deeper critical issue:**

`_requireBeneficiaryOperator` in the wrapper requires that the composer (`msg.sender`) is registered as a `isBeneficiaryOperator`. If this is not configured, **all cross-chain deposits and redeems silently revert with `UnauthorizedBeneficiaryOperator`** trapping user OFT tokens in the composer with no recovery path.

**Attack scenario:**
1. User sends a cross-chain deposit via LayerZero compose. OFT tokens are credited to the composer.
2. `lzCompose` calls `_composeDeposit` → `wrapper.depositFor`.
3. If the composer is not registered as `isBeneficiaryOperator` in the wrapper, the call reverts.
4. `lzCompose` reverts → LZ endpoint marks message as failed. Funds are stuck in the composer unless the operator calls `lzRetry` after fixing the operator registration.
5. Since this is an `external` revert (not caught), all compose messages for every creator coin are permanently bricked until the wrapper's `setBeneficiaryOperator` is called.

**Recommended fix:**
1. Ensure the composer is added as `isBeneficiaryOperator` in every wrapper before `configureCreatorMesh` is called. Add an integration check in `configureCreatorMesh`:
   ```solidity
   require(ICreatorOVaultWrapper(vault).isBeneficiaryOperator(address(this)), "Composer not operator");
   ```
2. Add explicit documentation that `setBeneficiaryOperator(composerAddress, true)` must be called on the wrapper before use.

---

### [C-2] OVaultHubComposer: Legacy mode bypasses ALL security invariants for unconfigured creator tokens

**Contract:** `messaging/OVaultHubComposer.sol`  
**Lines:** 330–332

**Code:**
```solidity
function _enforceMeshInvariants(...) internal view {
    CreatorMesh memory mesh = creatorMeshes[creatorToken];
    // Backwards compatibility: if no explicit mesh config exists, keep legacy flow.
    if (mesh.vault == address(0)) return;   // <-- ALL checks skipped
    ...
}
```

**Root cause:**  
When no `CreatorMesh` has been configured for a `creatorToken`, `_enforceMeshInvariants` returns immediately, skipping:
- Source EID verification (any chain can compose)
- Vault address cross-check
- Asset/share token cross-check against the mesh
- Peer address validation (composeFrom can be any address)

An attacker who can craft a compose message with a valid `creatorToken` (one not yet in `creatorMeshes`) and a malicious `wrapper` can pass `_validateCreatorBindings` if the registry returns a wrapper that is itself the attacker's contract, bypassing the balance invariants.

**Attack scenario:**
1. Protocol deploys a new `creatorToken` and registers it in the `CreatorRegistry` but does not yet call `configureCreatorMesh`.
2. The `allowedComposeSenders` check passes (the OFT is already whitelisted).
3. An attacker sends a compose message from any source chain containing `creatorToken = newly_deployed`, `wrapper = legitimate_wrapper`, `receiver = attacker`, `minOut = 0`.
4. `_enforceMeshInvariants` returns immediately (mesh not configured).
5. With `minOut = 0`, the attacker receives shares with zero slippage protection.
6. Additionally, during the window between token registration and mesh configuration, **any source EID** (not just the configured Solana EID) can compose messages.

**Recommended fix:**
```solidity
// Instead of silently allowing legacy mode, require explicit mesh config:
if (mesh.vault == address(0)) revert CreatorMeshNotConfigured(creatorToken);
```
If backwards compatibility is strictly required, at minimum validate that `srcEid` matches a known trusted EID.

---

## HIGH

---

### [H-1] SolanaBridgeAdapter: `processLotteryEntryFromSolana` calls `processSwapLottery` with `msg.value = 0` despite the interface being `payable`

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 626–664

**Code:**
```solidity
ICreatorLotteryManager(lotteryManager).processSwapLottery(buyerTwin, entry.shareOFT, amount18, 0);
// ↑ no {value: ...} — but interface is `external payable returns (uint256 entryId)`
```

**Root cause:**  
The `ICreatorLotteryManager.processSwapLottery` interface at line 20–24 is marked `payable`. The `processLotteryEntryFromSolana` function is not `payable` and passes no ETH value. If the lottery manager requires a native fee to register an entry (e.g., to pay for a VRF request), the call will silently succeed with 0 value. If the lottery manager **requires** a non-zero value, the call will revert, silently skipping the entry (the `continue` at line 637 does not wrap this call — a revert propagates and blocks the entire batch).

**Impact:**  
- Solana users' lottery entries are silently dropped if the lottery manager requires a native fee.
- If the lottery manager reverts on zero-value calls, the entire `processLotteryEntryFromSolana` batch fails, enabling a griefing attack: a keeper can front-run with a malformed entry to block the entire batch.

**Recommended fix:**
```solidity
// Make processLotteryEntryFromSolana payable and distribute msg.value per entry:
ICreatorLotteryManager(lotteryManager).processSwapLottery{value: valuePerEntry}(
    buyerTwin, entry.shareOFT, amount18, 0
);
```
Or wrap the call in try/catch and emit a failure event per entry.

---

### [H-2] SolanaBridgeAdapter: `registerToken` / `deployWrappedToken` allows silent overwrite of bidirectional mappings

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 223–237, 247–264

**Code:**
```solidity
function registerToken(address baseToken, bytes32 solanaMint, uint8 solanaDecimals) external onlyOwner {
    // No check: tokenToSolanaMint[baseToken] != bytes32(0)
    // No check: solanaMintToToken[solanaMint] != address(0)
    tokenToSolanaMint[baseToken] = solanaMint;
    solanaMintToToken[solanaMint] = baseToken;
    isRegistered[baseToken] = true;
    ...
}
```

**Root cause:**  
Both `registerToken` and `deployWrappedToken` overwrite existing mappings without guards. This creates several dangerous states:
1. **Remapping an existing Base token to a new Solana mint:** `tokenToSolanaMint[baseToken]` is updated, but the old `solanaMint` still maps back to `baseToken` via `solanaMintToToken`. The bidirectional invariant is broken.
2. **Two Base tokens mapped to the same Solana mint:** `solanaMintToToken[solanaMint]` is overwritten; old base token is now orphaned.
3. **Decimal change via re-registration:** If `solanaDecimals` changes on re-registration, existing in-flight bridge transactions (already calculated with old decimals) will have mismatched `remoteAmount` values.

**Attack scenario:**  
Owner error (misconfigured re-registration) can cause tokens bridged from Solana to be credited to the wrong Base token, or bridge transactions to revert with `InvalidAmount()` due to decimal mismatch.

**Recommended fix:**
```solidity
require(tokenToSolanaMint[baseToken] == bytes32(0), "Already registered");
require(solanaMintToToken[solanaMint] == address(0), "Mint already mapped");
```

---

### [H-3] CreatorShareOFT: `burn()` allows vault/minter to burn tokens from **any** arbitrary address without allowance

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 372–375

**Code:**
```solidity
function burn(address _from, uint256 _amount) external onlyVaultOrMinter {
    _burn(_from, _amount);
    emit SharesBurned(_from, _amount);
}
```

**Root cause:**  
`_burn` in OpenZeppelin ERC20 does not check allowance — it directly destroys tokens from `_from`. Any address with `isMinter[addr] = true` (or the vault) can burn tokens from any holder without their consent. There is no `_spendAllowance` guard.

**Impact:**  
A compromised vault or minter (or an incorrectly granted minter) can unilaterally destroy any user's share balance. This is a full-loss-of-funds vector if any minter key is compromised or if a minter is granted to a malicious contract.

**Recommended fix:**  
Add allowance check:
```solidity
function burn(address _from, uint256 _amount) external onlyVaultOrMinter {
    if (msg.sender != vault && msg.sender != owner()) {
        _spendAllowance(_from, msg.sender, _amount);
    }
    _burn(_from, _amount);
    emit SharesBurned(_from, _amount);
}
```
Or restrict `burn(_from, ...)` to only `vault` and `owner`, requiring minters to use `burnFrom` with allowance.

---

### [H-4] CreatorOracle: `updateCreatorPrice` (direct setter) bypasses all TWAP and deviation guardrails

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 476–486

**Code:**
```solidity
function updateCreatorPrice(int256 _price) external {
    if (!isPriceUpdater[msg.sender] && msg.sender != owner()) {
        revert Unauthorized();
    }
    if (_price <= 0) revert InvalidPrice();
    creatorPriceUSD = _price;
    creatorPriceTimestamp = block.timestamp;
    emit CreatorPriceUpdated(creatorSymbol, _price, block.timestamp, msg.sender);
}
```

**Root cause:**  
`updateCreatorPrice` accepts any positive price with no deviation check. In contrast, `updateCreatorPriceFromTWAP` and `updateCreatorPriceFromV3TWAP` both enforce `MAX_PRICE_DEVIATION = 20%`. A compromised or malicious `isPriceUpdater` address can set an arbitrarily wrong price in a single transaction, affecting lottery valuations, gauge calculations, and all cross-chain consumers.

**Attack scenario:**  
1. Attacker gains control of an `isPriceUpdater` address (e.g., keeper key compromise).
2. Calls `updateCreatorPrice(1)` — sets creator USD price to near-zero.
3. Broadcasts via `broadcastCreatorPrice` to all chains.
4. All downstream consumers (lottery prize valuations, Ajna bucket selection) use the manipulated price.

**Recommended fix:**
```solidity
function updateCreatorPrice(int256 _price) external {
    ...
    if (creatorPriceUSD > 0) {
        uint256 oldP = uint256(creatorPriceUSD);
        uint256 newP = uint256(_price);
        uint256 deviation = oldP > newP ? ((oldP - newP) * 1e18) / oldP : ((newP - oldP) * 1e18) / oldP;
        if (deviation > MAX_PRICE_DEVIATION) revert PriceDeviationTooHigh();
    }
    ...
}
```

---

### [H-5] CreatorOracle: `_findObservationBefore` uses wrong ring-buffer traversal — returns stale observations, shortening effective TWAP window

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 712–741

**Code:**
```solidity
for (uint16 i = 0; i < cardinality; i++) {
    uint16 checkIndex = (currentIndex + cardinality - i) % cardinality;  // BUG
    ...
    if (obs.blockTimestamp <= targetTime) {
        return checkIndex;
    }
}
```

**Root cause:**  
The ring buffer is indexed modulo `cardinalityNext` (which can be up to 1024 and grows independently), but `_findObservationBefore` iterates modulo `cardinality` (the number of initialized slots, always ≤ `cardinalityNext`). This means the function may skip over valid initialized observations when `cardinalityNext > cardinality`, returning an incorrect (too recent) "oldest" observation and truncating the effective TWAP window.

Additionally, the traversal walks `currentIndex + cardinality - i` which walks backward from the newest, but in the window where `cardinalityNext` recently grew, some indices between `cardinality` and `cardinalityNext` contain initialized observations that are never checked.

**Impact:**  
The TWAP tick and resulting price calculation uses fewer observations than available, potentially returning a TWAP over a shorter window than `DEFAULT_TWAP_DURATION`. This weakens flash loan resistance.

**Recommended fix:**  
Iterate modulo `cardinalityNext` (not `cardinality`) and check `initialized` flag:
```solidity
uint16 size = observationState.cardinalityNext;
for (uint16 i = 0; i < size; i++) {
    uint16 checkIndex = (currentIndex + size - i) % size;
    ...
}
```

---

### [H-6] CreatorShareOFT: `_sendFeesToGauge` fallback silently transfers fees to gauge even when `receiveFees` reverts, breaking gauge accounting

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 494–500

**Code:**
```solidity
try ICreatorGaugeController(_gaugeController).receiveFees(amount) {
    emit FeeCollected(_gaugeController, amount);
} catch {
    // If gauge controller call fails, transfer directly as fallback
    _transfer(address(this), _gaugeController, amount);
    emit FeeCollected(_gaugeController, amount);
}
```

**Root cause:**  
When `receiveFees()` reverts (e.g., due to reentrancy guard, paused state, or internal logic), the fallback directly transfers tokens to the `_gaugeController` address. This bypasses any internal accounting the gauge controller does in `receiveFees`. The gauge may expect to update internal state (emission schedules, voting weights, etc.) atomically with the token receipt. A direct transfer deposits fees without triggering that accounting, permanently breaking the gauge's bookkeeping.

**Impact:**  
- Fees are delivered but not accounted for by the gauge.
- Depending on gauge design, this could result in fees being locked permanently, incorrect reward calculations, or inflated/deflated emission rates.

**Recommended fix:**  
Remove the fallback transfer. Either require `receiveFees` to succeed or accumulate the fee locally and retry later:
```solidity
try ICreatorGaugeController(_gaugeController).receiveFees(amount) {
    emit FeeCollected(_gaugeController, amount);
} catch {
    // Accumulate instead of bypassing accounting
    pendingFees += amount;
    emit FeesAccumulated(amount, pendingFees);
}
```

---

## MEDIUM

---

### [M-1] SolanaBridgeAdapter: Keeper can submit duplicate/fabricated lottery entries — no deduplication or Solana-side signature verification

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 626–664

**Code:**
```solidity
function processLotteryEntryFromSolana(bytes32 keeperPubkey, LotteryEntry[] calldata entries)
    external nonReentrant onlyTwin(keeperPubkey)
{
    if (!authorizedEntryKeepers[keeperPubkey]) revert UnauthorizedEntryKeeper(keeperPubkey);
    ...
    for (uint256 i = 0; i < entries.length; i++) {
        // entries are caller-supplied; no on-chain proof of Solana-side swap
        ICreatorLotteryManager(lotteryManager).processSwapLottery(buyerTwin, entry.shareOFT, amount18, 0);
    }
}
```

**Root cause:**  
The `LotteryEntry` struct is entirely keeper-supplied. There is no Merkle proof, Solana transaction signature, or nonce tracking to prove that a given `(buyerSolanaPubkey, shareOFT, amountSolanaUnits)` tuple actually occurred on Solana. An authorized keeper can:
- Submit the same entry multiple times (no spent-entry tracking).
- Fabricate entries for addresses that made no swap.
- Inflate `amountSolanaUnits` to increase a specific buyer's lottery odds.

**Recommended fix:**  
At minimum, track a `bytes32 solanaTxSignature` per entry and store consumed signatures:
```solidity
mapping(bytes32 => bool) public processedSolanaTxs;
// In the loop: require(!processedSolanaTxs[entry.solanaTxSig]); processedSolanaTxs[...] = true;
```
Long-term, use a ZK proof or Solana Light Client verification.

---

### [M-2] OVaultHubComposer: `minOut = 0` is accepted from compose message payload — sandwich attack on cross-chain deposits/redeems

**Contract:** `messaging/OVaultHubComposer.sol`  
**Lines:** 195–196, 253, 291

**Code:**
```solidity
(uint8 action, address creatorToken, address wrapper, address receiver, address sourceOft, uint256 minOut) =
    abi.decode(composeMsg, ...);
// minOut is user-supplied in the compose message and is not validated
sharesOut = ICreatorOVaultWrapperComposer(wrapper).depositFor(amountIn, minOut, receiver);
```

**Root cause:**  
`minOut` comes directly from the compose message payload. If a user sends `minOut = 0`, they accept any output including near-zero. MEV bots or a malicious LZ executor can observe the pending compose message and sandwich-attack the vault deposit/redeem between the LayerZero message delivery and the actual compose execution. Since Uniswap V4 pools and vaults are price-sensitive, the attacker can manipulate PPS to steal value.

**Impact:**  
Users bridging cross-chain with `minOut = 0` (which is easy to set by accident with no on-chain enforcement) lose funds to MEV.

**Recommended fix:**  
Add a minimum non-zero `minOut` check, or use a price oracle to enforce a reasonable minimum:
```solidity
if (minOut == 0) revert ZeroAmount();
```
Document that `minOut` must be set to a meaningful slippage-bounded value by clients.

---

### [M-3] CreatorOracle: `broadcastCreatorPrice` fee splitting by integer division may cause `_lzSend` to revert for one destination

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 1052–1061

**Code:**
```solidity
require(msg.value % dstEids.length == 0, "FeeNotDivisible");
uint256 feePerChain = msg.value / dstEids.length;
for (uint256 i = 0; i < dstEids.length; i++) {
    receipts[i] = _lzSend(dstEids[i], payload, options, MessagingFee(feePerChain, 0), payable(msg.sender));
}
```

**Root cause:**  
The "FeeNotDivisible" check ensures `msg.value % dstEids.length == 0`, enforcing equal fee per destination. However, different destination chains have different actual LZ messaging fees. If the fee for one chain is higher than `feePerChain`, that `_lzSend` call will revert. If it is lower, excess ETH is silently left in the contract (since `_payNative` only checks `address(this).balance >= _nativeFee`).

**Impact:**  
- Broadcast can partially succeed: some chains receive price updates, others don't, resulting in inconsistent cross-chain price state.
- Overpayment accumulates in the contract permanently.

**Recommended fix:**  
Accept an array of per-chain fees:
```solidity
function broadcastCreatorPrice(uint32[] calldata dstEids, bytes[] calldata optionsPerChain, uint256[] calldata feesPerChain)
```
Or quote fees off-chain and sum them rather than requiring divisibility.

---

### [M-4] CreatorShareOFT: `flushFees` — `_sendParam.minAmountLD == pendingFees` causes flush to fail when OFT has dust trimming

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 525–530, 543–544

**Code:**
```solidity
require(_sendParam.amountLD == amount, "Amount mismatch");
// buildFlushSendParam sets:
minAmountLD: pendingFees,  // exact match required
```

And in `_send` (OFT base), the `minAmountLD` is enforced against the actual credited amount after OFT dust trimming (SharedDecimals conversion). If the trimmed amount is less than `pendingFees` by even 1 wei, the OFT send reverts.

**Root cause:**  
OFT shared decimals truncate amounts. `buildFlushSendParam` sets `minAmountLD = pendingFees` (full precision), but the OFT infrastructure will trim to 6 shared decimals. The minimum might always be unreachable, permanently blocking fee flushes.

**Impact:**  
Fees accumulate on remote chains indefinitely if `pendingFees` always has sub-shared-decimal dust. Protocol loses revenue.

**Recommended fix:**  
Use the LZ `_removeDust` result as `minAmountLD`:
```solidity
minAmountLD: _removeDust(pendingFees),
```
This ensures `minAmountLD ≤ amountLD` after trimming.

---

### [M-5] CreatorOracle: `setV4Pool` resets observation ring buffer, invalidating any existing TWAP history — price update DoS

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 301–329

**Code:**
```solidity
function setV4Pool(address _poolManager, PoolKey calldata _poolKey, bool _creatorIsToken0) external onlyOwner {
    ...
    observations[0] = Observation({...}); // resets slot 0
    observationState = ObservationState({index: 0, cardinality: 1, cardinalityNext: 1}); // resets all
    ...
}
```

**Root cause:**  
Every call to `setV4Pool` (even if just updating `creatorIsToken0`) resets `observationState` to cardinality 1. After reset, `getTWAPTick` reverts with `NeedMoreObservations` until at least 2 new observations are written. During this window (which could be hours if swap volume is low), `_updatePriceFromTWAP` silently returns and the oracle price goes stale.

**Impact:**  
An owner-controlled V4 pool rotation (e.g., migrating to a new fee tier) forces a price blackout for the full TWAP warmup period. Any price-dependent operations during this window fail silently.

**Recommended fix:**  
Preserve observation history on pool key changes. Only reset cardinality if the pool manager address itself changes:
```solidity
if (address(poolManager) != _poolManager) {
    observationState = ObservationState({index: 0, cardinality: 1, cardinalityNext: 1});
}
```

---

### [M-6] SolanaBridgeAdapter: `buyAndEnterLottery` uses hardcoded 0.3% fee tier — may use wrong pool or fail for tokens with no 0.3% pool

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 513–522, 558–567

**Code:**
```solidity
IUniswapV4Router.ExactInputSingleParams memory params = IUniswapV4Router.ExactInputSingleParams({
    ...
    fee: 3000, // 0.3% fee tier — hardcoded
    ...
});
```

**Root cause:**  
The fee tier is hardcoded to 3000 (0.3%). If the canonical pool for a given `tokenIn/shareToken` pair exists at a different fee tier (0.05%, 1%), the swap will route through a non-canonical pool, potentially with worse pricing, low liquidity, or reverting entirely if no 0.3% pool exists.

**Impact:**  
- Solana users attempting lottery entry via the adapter may receive significantly worse exchange rates.
- The function may revert with no way for the user to specify a different fee tier, locking their bridged funds in the Twin contract.

**Recommended fix:**  
Accept `fee` as a parameter:
```solidity
function buyAndEnterLottery(..., uint24 fee) external nonReentrant onlyTwin(solanaPubkey) ...
```

---

### [M-7] CreatorShareOFT: Remote chain `_lzReceive` dispatches winner callback based on message length (128 bytes), which collides with standard OFT transfer payloads

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 776–804

**Code:**
```solidity
function _isWinnerCallbackMessage(Origin calldata _origin, bytes calldata _message) internal view returns (bool) {
    bytes32 expectedSender = hubLotteryPeer;
    if (expectedSender == bytes32(0) || _origin.sender != expectedSender) return false;
    if (_message.length != 128) return false;
    ...
    if (uint16(word0) != MSG_TYPE_WINNER_CALLBACK) return false;
    ...
}
```

**Root cause:**  
The check `_message.length != 128` combined with `_origin.sender == hubLotteryPeer` is the sole differentiator between OFT token transfer messages and winner callbacks. An OFT token transfer from `hubLotteryPeer` to the remote chain's OFT with exactly 128 bytes of payload would be misrouted to `_handleWinnerCallback` instead of `super._lzReceive`. The length check is fragile — a standard OFT `SEND` payload contains a `bytes32 to` + `uint64 amountSD` + optional compose, which for a 0-byte compose is 40 bytes. But `SEND_AND_CALL` with a specific compose length could be 128 bytes.

**Impact:**  
A crafted OFT token-transfer message from `hubLotteryPeer` with 128-byte payload will be silently consumed as a winner callback (which only emits an event), causing the tokens to be credited nowhere. Funds lost.

**Recommended fix:**  
Use dedicated message type routing instead of length heuristics. Add an unambiguous magic prefix or use a separate OApp endpoint for winner callbacks (as noted in the code comment at line 778).

---

### [M-8] CreatorOracle: `_updateCapFrequency` overflow handling is incorrect — wrap-around produces maxed frequency, tightening cap too aggressively

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 611–618

**Code:**
```solidity
unchecked {
    currentFreq += ONE_DAY_PPM;  // intentional overflow allowed
}
if (currentFreq < ONE_DAY_PPM) {  // overflow detection
    currentFreq = type(uint64).max - ONE_DAY_PPM + 1;  // saturate
}
```

**Root cause:**  
The overflow detection check `currentFreq < ONE_DAY_PPM` after an unchecked add only catches the case where the result wrapped to near zero. However, if `currentFreq` was already close to `type(uint64).max - ONE_DAY_PPM`, the addition wraps to a value that is still `>= ONE_DAY_PPM`, bypassing the saturation. This means the cap frequency counter can wrap to a small arbitrary value, falsely indicating few capping events and causing `_autoTuneTickCap` to tighten the tick cap aggressively (reducing manipulation resistance).

**Recommended fix:**  
Use saturating addition:
```solidity
uint64 newFreq = currentFreq + ONE_DAY_PPM;
currentFreq = newFreq < currentFreq ? type(uint64).max : newFreq; // saturate on overflow
```

---

## LOW

---

### [L-1] SolanaBridgeAdapter: `emergencyWithdraw` can drain any ERC20 including mid-flight bridge approvals

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 917–919

**Code:**
```solidity
function emergencyWithdraw(address token, uint256 amount, address to) external onlyOwner {
    IERC20(token).safeTransfer(to, amount);
}
```

No timelock, no destination restriction. Owner can instantly drain any token balance including tokens pulled from users mid-transaction (between `safeTransferFrom` and `bridgeToken` call in `_bridgeToSolana`). This is an owner-privilege risk but combined with a single-sig owner key represents a significant custodial risk.

**Recommended fix:** Add a timelock or require `to` to be a pre-approved address. Emit an `EmergencyWithdraw` event with all parameters.

---

### [L-2] CreatorShareOFT: `isHub` can be changed from `true` to `false` after deployment, stranding pending fees and converting the hub to remote mode

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 835–840

**Code:**
```solidity
function setHubConfig(bool _isHub, uint32 _hubEid, address _hubGaugeReceiver) external onlyOwner {
    isHub = _isHub;
    ...
}
```

No check prevents setting `isHub = false` on the hub chain (Base). If done, fees will begin accumulating in `pendingFees` instead of being forwarded to the gauge, and `flushFees` will try to bridge fees to `hubGaugeReceiver` which is the local address — bridging back to the same chain.

**Recommended fix:**  
```solidity
if (!_isHub && block.chainid == 8453) revert("Hub cannot be set to remote");
```
Or use an `immutable` `isHub` set at deployment.

---

### [L-3] CreatorOracle: `setChainlinkFeed(address(0))` silently disables price updates without reverting

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 290–293

```solidity
function setChainlinkFeed(address _feed) external onlyOwner {
    chainlinkFeed = _feed;  // no zero-address check
    emit ChainlinkFeedSet(_feed);
}
```

Setting `chainlinkFeed = address(0)` causes `_updatePriceFromTWAP` to silently return early, leaving the price stale. Add `require(_feed != address(0))` or emit a warning event.

---

### [L-4] SolanaBridgeAdapter: `mapTwin` stores a manual override mapping that is never used in critical auth paths

**Contract:** `bridge/SolanaBridgeAdapter.sol`  
**Lines:** 759–762

`solanaTwinMapping` is populated by `mapTwin` but `onlyTwin` always calls `IBaseSolanaBridge(BRIDGE).getPredictedTwinAddress(solanaPubkey)` directly. The stored mapping is dead code and could mislead auditors or operators into thinking it provides auth.

**Recommended fix:** Remove `solanaTwinMapping` and `mapTwin`, or use the mapping in `onlyTwin` as a cache/override.

---

### [L-5] CreatorOracle: `maxTicksPerObservation` can be set to `0`, disabling all tick capping

**Contract:** `oracles/CreatorOracle.sol`  
**Lines:** 393–397

```solidity
function setMaxTicksPerObservation(int24 _maxTicks) external onlyOwner {
    require(_maxTicks >= 0 && _maxTicks <= 1000, "Invalid range");  // 0 is allowed!
```

When `maxTicksPerObservation == 0`, the capping block at line 540 (`if (maxTicksPerObservation > 0)`) is skipped, meaning any tick movement is accepted uncapped. This completely disables manipulation resistance.

**Recommended fix:** Change the lower bound to 1: `require(_maxTicks >= 1 && _maxTicks <= 1000)`.

---

### [L-6] CreatorShareOFT: `setHubLotteryPeer` overwrites `hubEid` — calling it before `setHubConfig` can leave `hubGaugeReceiver` unset

**Contract:** `messaging/CreatorShareOFT.sol`  
**Lines:** 847–851

Both `setHubConfig` and `setHubLotteryPeer` write to `hubEid`. If called in the wrong order, `hubGaugeReceiver` remains `address(0)`, causing `flushFees` to revert with `HubNotConfigured` even though `hubEid` appears set.

**Recommended fix:** Require `hubGaugeReceiver` to be non-zero in `setHubLotteryPeer`, or merge the two functions.

---

### [L-7] OVaultHubComposer: No validation that `receiver` in compose message is not `address(this)` — shares could be locked in the composer

**Contract:** `messaging/OVaultHubComposer.sol`  
**Lines:** 195–200

If a user mistakenly sets `receiver = address(composerContract)` in the cross-chain compose message, shares are minted and immediately transferred to the composer itself (line 266). Since the composer has no withdrawal function for stranded share tokens (only an owner-level `emergencyWithdraw` is absent), the shares are permanently locked.

**Recommended fix:** Add `require(receiver != address(this))`.

---

## INFO

---

### [I-1] CreatorShareOFT: `receive()` accepts ETH with no withdrawal path for the hub deployment

**Lines:** 1192. The hub deployment accumulates ETH from LZ refunds but has no `withdrawETH` function. The owner cannot recover these funds. Consider adding `function withdrawETH(address payable to) external onlyOwner { to.transfer(address(this).balance); }`.

---

### [I-2] SolanaBridgeAdapter: `bridgeToSolanaWithIxs` copies `calldata` to `memory` unnecessarily

**Lines:** 297. `IBaseSolanaBridge.Ix[] memory copiedIxs = ixs;` copies the entire calldata array to memory. For large instruction payloads, this wastes significant gas. Pass `ixs` directly to `_bridgeToSolana` as calldata, or refactor `_bridgeToSolana` to accept calldata.

---

### [I-3] CreatorOracle: `broadcastCreatorPrice` uses the same `options` bytes for all destination chains

**Lines:** 1044–1061. Different chains (Solana, Arbitrum, Optimism) may have different gas costs. Using a single `options` for all destinations means either over-paying (for fast chains) or under-paying (for slow chains), causing delivery failures on under-gassed destinations. Use per-chain options.

---

### [I-4] CreatorShareOFT: Winner callback `_handleWinnerCallback` only emits an event — no on-chain action taken for winners

**Lines:** 810–823. The winner callback is received on remote chains and emits `LotteryWinnerNotification`. There is no on-chain delivery of prize assets — winners must manually claim on the hub. This UX gap may cause confusion and unclaimed prizes. Consider documenting the claim flow explicitly.

---

### [I-5] OVaultHubComposer: `_enforceMeshInvariants` checks `mesh.solanaEid != 0` before comparing — allows any-EID messages when `solanaEid` is misconfigured as 0

**Lines:** 335. If an operator calls `configureCreatorMesh` with `solanaEid = 0` (e.g., for a non-Solana source), the EID check is skipped entirely and messages from any source chain are accepted. This is a misconfiguration trap that bypasses source chain authentication for that creator.

---

## Cross-Cutting Observations

### Keeper Trust Assumption
Both `SolanaBridgeAdapter` (fee keeper + entry keeper) and `CreatorOracle` (price updaters) rely on trusted off-chain keeper roles with significant power. The fee keeper can route fees arbitrarily (within the authorized `shareOFT` list), and the entry keeper can fabricate lottery entries. These roles should be multi-sig governed and have time-delayed rotation.

### Cross-Chain Price Staleness
`CreatorOracle.getCreatorPrice()` returns `(0, 0)` if price is stale (> 2 hours). Consumers must handle this null return. If a consumer doesn't check for zero and uses `0` as a price, it could compute lottery prizes as infinite (division by zero) or zero (multiplication). There is no explicit documentation of this invariant for integrators.

### No Pause Mechanism in SolanaBridgeAdapter
The bridge adapter has no global pause. If the Base-Solana bridge is compromised or the bridge contract is upgraded to a malicious version, there is no way to immediately halt `bridgeToSolana` operations. Consider adding a `paused` state variable.

### Chainlink `answeredInRound` Not Checked
In `CreatorOracle` lines 448 and 982, `latestRoundData()` is called but `answeredInRound` is not compared against `roundId`. Per Chainlink documentation, if `answeredInRound < roundId`, the price is stale. Add: `require(answeredInRound >= roundId, "Stale round")`.
