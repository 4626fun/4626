# 🔐 Security Review — CreatorShareOFT + CreatorOVaultWrapper (job 481)

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Client target**                 | "Audit 4626 CreatorShareOFT + Wrapper" — resubmit of stuck job 463 |
| **Source of truth**               | `github.com/4626fun/4626` @ tag `audit/oda-2026-07-22` |
| **Commit pinned**                 | `423e0e3a607884de6e60bccd06f722a8aba770ee` |
| **Files reviewed**                | `contracts/creator/vault/CreatorShareOFT.sol` (LayerZero V2 OFT, 1395 lines)<br>`contracts/creator/vault/CreatorOVaultWrapper.sol` (wrap/deposit convenience layer, 852 lines) |
| **Explicitly out of scope**       | `CreatorOVault.sol` (referenced only via `IOVault4626`/`IERC4626`/`IQueueAwareVault` — this is job 480's target, audited separately in a prior independent engagement this session), `CreatorGaugeController` (`ITradeFeeCollector4626`), `LotteryManager` (`ILotteryManager4626`), `Registry` (`IRegistry4626`), the optional Uniswap V4 `ISimpleSellTaxHook`, LayerZero's `OFT`/`OApp`/`OFTCore` base contracts (not vendored in this checkout — trusted per documented behavior) |
| **Methodology**                   | Three-phase: Phase 0 context (protocol map + access-control inventory + threat catalog, opus) → Phase 1 breadth (7 domain checklists, opus) → Phase 2 depth (12 attacker-mindset agents, opus, blind to Phase-1 findings) → Phase 3 hybrid reconciliation |
| **Confidence threshold reported** | 50 (findings below this line are listed as Leads, not Findings) |

**Note on scope relationship to job 480.** This engagement audits the LayerZero omnichain wrapper token (■TOKEN) and its deposit/wrap convenience layer for the same protocol whose core ERC4626 vault was audited independently in a separate job this session. Per this engagement's methodology, every finding below was derived fresh from this job's own three-phase run against only the two files listed above — no finding was imported from the other job's report, though where a defect's exploitability depends on the (separately-audited, out-of-scope-here) vault's behavior, that dependency is called out explicitly.

---

## Reconciliation Summary

- **Phase 1** (7 domain agents): 4 Medium, 14 Low, extensive Info confirmations.
- **Phase 2** (12 attacker-mindset agents, blind): produced overwhelming independent convergence on one root cause (11 of 12 agents, plus 2 phase-1 agents — 13 total instances across the engagement) and one new, distinct finding not surfaced in Phase 1 (2 independent Phase-2 instances).
- **Overlap**: the wrapper's flash-loan cooldown bypass was found by phase-1's `general`/`flashloans` agents and independently re-derived by 11 of the 12 phase-2 agents (4 rated FINDING, 7 rated LEAD, varying only in confidence about downstream profitability) — the single highest-convergence result across this entire audit.
- **Phase-1-only**: async-redemption/large-withdrawal splitting bypass, owner mint-exclusion bypass + no-op remote backing check, hardcoded wire-authority default, and all Low/Info items.
- **Phase-2-only**: the `_lzReceive` message-type-confusion / lottery-entry-forward collision (2 independent instances — `boundary` and `invariant` agents).
- **Re-examined leads kept**: all Phase-1 Medium findings independently re-confirmed by targeted re-read during reconciliation. **Demoted**: none — no disputed claims arose in this engagement (contrast with job 480, where one widely-repeated claim was disproven; no analogous false-positive appeared here).
- **Coverage holes closed this pass**: 0 (both phases already reached full coverage of the access-control inventory and threat catalog).

---

## Findings

### [1] Wrapper's per-user flash-loan cooldown is defeated by routing a fresh deposit through any pre-funded recipient address

`CreatorOVaultWrapper.propagateCooldownOnTransfer()` / `_requireWrapperCooldown()` · **Severity: Medium** · **Confidence: 85** · Origin: `[both]` — Phase 1 `general`/`flashloans`; Phase 2 `asymmetry`, `first-principles`, `access-control`, `execution-trace`, `trust-gap`, `boundary`, `numerical-gap`, `periphery`, `flow-gap`, `invariant` (11 of 12 agents independently converged — the single highest-convergence finding of this entire audit)

**Description**

`deposit()`/`deposit(uint256)`/`depositFor()` each record `lastWrapperDepositBlock[msg.sender] = block.number` after minting (CreatorOVaultWrapper.sol:299, 316, 343). `withdraw()`/`unwrap()` gate on `_requireWrapperCooldown()`:

```solidity
function _requireWrapperCooldown(address user) internal view {
    if (isWhitelisted[user] || isBeneficiaryOperator[user]) return;
    uint256 requiredBlock = lastWrapperDepositBlock[user] + wrapperWithdrawDelayBlocks;
    if (block.number < requiredBlock) revert WrapperWithdrawTooSoon(block.number, requiredBlock);
}
```
(CreatorOVaultWrapper.sol:789-793, `wrapperWithdrawDelayBlocks` defaults to 1)

To stop a user from depositing, transferring the freshly-minted ■TOKEN to a fresh address, and withdrawing from that address in the same block, `CreatorShareOFT._update` calls back into `propagateCooldownOnTransfer` on every transfer (documented purpose at CreatorOVaultWrapper.sol:796-801: *"so a user cannot deposit, transfer the resulting ShareOFT to a fresh address, and withdraw in the same block"*). But the propagation hook contains an anti-grief carve-out that is broader than intended:

```solidity
function propagateCooldownOnTransfer(address from, address to, uint256 amount) external {
    if (msg.sender != address(shareOFT)) revert CooldownHookUnauthorizedCaller(msg.sender);
    if (from == address(0) || to == address(0)) return;
    if (from == to) return;
    if (amount == 0) return;

    uint256 fromBlock = lastWrapperDepositBlock[from];
    if (fromBlock == 0) return;

    // ODA-428-F3: only propagate onto genuinely fresh recipients. Hook runs
    // after ShareOFT balance mutation, so prior balance is `balanceOf(to) - amount`.
    uint256 toBalance = IERC20(address(shareOFT)).balanceOf(to);
    if (toBalance > amount) return;                                    // <-- line 827

    uint256 toBlock = lastWrapperDepositBlock[to];
    if (fromBlock > toBlock) {
        lastWrapperDepositBlock[to] = fromBlock;
        emit CooldownPropagated(from, to, fromBlock);
    }
}
```
(CreatorOVaultWrapper.sol:812-834)

The hook runs *after* `super._update` in `CreatorShareOFT._update`, so `toBalance = priorBalance(to) + amount` at the time of the check. The guard `toBalance > amount` is therefore mathematically equivalent to `priorBalance(to) > 0` — **any** recipient holding even 1 wei of ■TOKEN before the transfer is treated as "established" and the cooldown propagation is skipped entirely, leaving that recipient's own `lastWrapperDepositBlock` untouched (0, if they never deposited via the wrapper themselves).

**Proof of Concept**

1. In an earlier block, attacker sends 1 wei of ■TOKEN to a second address B they control (via a plain transfer or a DEX purchase — neither sets `lastWrapperDepositBlock[B]`, which stays 0).
2. In the attack block: address A calls `deposit(amount)` → mints ■TOKEN to A, sets `lastWrapperDepositBlock[A] = N`.
3. A calls `shareOFT.transfer(B, shareOFTOut)`. Inside `_update`, `propagateCooldownOnTransfer(A, B, shareOFTOut)` computes `toBalance = 1 + shareOFTOut > shareOFTOut` → returns early. `lastWrapperDepositBlock[B]` stays 0.
4. B calls `withdraw(shareOFTOut)`. `_requireWrapperCooldown(B)`: `requiredBlock = 0 + 1 = 1`, and `block.number (N) >= 1` → passes. B redeems in the same block A deposited.

The round-trip through the wrapper itself is not directly profitable in isolation (deposit and redeem at the same vault price-per-share nets to roughly the same value minus any wrap/unwrap fee). **What could not be demonstrated in this scope** — and is why every one of the 11 phase-2 agents that found this rated it a LEAD rather than an unconditional FINDING, with only `asymmetry`, `first-principles`, `boundary`, `numerical-gap`, and `periphery` promoting it to FINDING on the strength of the fully-proven control-bypass alone — is a concrete profitable extraction, since that depends on whether the (separately-scoped) vault's price-per-share is manipulable within a single block by some other action bundled into the same transaction (e.g. a large donation, another user's trade, or a keeper `report()` call). The defect is nonetheless real and definitively proven: **a documented, named security control (M-01/M-08, referenced repeatedly in code comments as a specific prior-audit fix) is fully bypassable with a trivial, cheap, repeatable precondition.**

**Recommendation**

Drop the `toBalance > amount` early-return, or restrict it to only skip when it would *lower* an existing cooldown. The hook already uses a monotonic-max rule (`if (fromBlock > toBlock)`, line 830) — since this rule can never *decrease* a recipient's effective cooldown, propagating onto "established" holders too cannot introduce a new grief vector (an established holder's cooldown can only ever be raised, never reset backward), so the carve-out is unnecessary for the anti-grief goal it was designed for.

```diff
  uint256 fromBlock = lastWrapperDepositBlock[from];
  if (fromBlock == 0) return;

- // ODA-428-F3: only propagate onto genuinely fresh recipients. Hook runs
- // after ShareOFT balance mutation, so prior balance is `balanceOf(to) - amount`.
- uint256 toBalance = IERC20(address(shareOFT)).balanceOf(to);
- if (toBalance > amount) return;
-
  uint256 toBlock = lastWrapperDepositBlock[to];
  if (fromBlock > toBlock) {
      lastWrapperDepositBlock[to] = fromBlock;
      emit CooldownPropagated(from, to, fromBlock);
  }
```

---

### [2] Standard cross-chain OFT messages can be misclassified as internal lottery-entry-forward messages, letting any user inject an attacker-controlled payload into the LotteryManager at near-zero cost

`CreatorShareOFT._lzReceive()` / `_isRemoteLotteryEntryMessage()` · **Severity: Medium** · **Confidence: 55** (capped — the exploit mechanism depends on the exact byte layout of LayerZero's `OFTMsgCodec` packed message format, which is not vendored in this checkout and could not be mechanically verified against source; it rests on the agents' documented knowledge of the public LayerZero V2 OFT specification) · Origin: `[phase2 only]` — `boundary`, `invariant` (2 independent instances)

**Description**

On the hub, `_lzReceive` dispatches inbound LayerZero messages by inspecting their raw bytes:

```solidity
function _lzReceive(Origin calldata _origin, bytes32 _guid, bytes calldata _message, address _executor, bytes calldata _extraData) internal virtual override {
    if (isHub && _isRemoteLotteryEntryMessage(_message)) {
        address mgr = address(uint160(uint256(hubLotteryPeer)));
        if (mgr == address(0)) revert HubNotConfigured();
        ILotteryManager4626(mgr).receiveRemoteLotteryEntry(_origin.srcEid, _origin.sender, _message);
        return;
    }
    if (_isWinnerCallbackMessage(_origin, _message)) { ... }
    super._lzReceive(_origin, _guid, _message, _executor, _extraData);
}
```
(CreatorShareOFT.sol:1011-1045)

```solidity
function _isRemoteLotteryEntryMessage(bytes calldata message) internal pure returns (bool) {
    if (message.length != 160 && message.length != 192 && message.length != 224) return false;
    uint256 word0;
    assembly { word0 := calldataload(message.offset) }
    if (word0 >> 16 != 0) return false;
    return uint16(word0) == MSG_TYPE_LOTTERY_ENTRY;   // MSG_TYPE_LOTTERY_ENTRY = 3
}
```
(CreatorShareOFT.sol:1091-1099)

This classifier checks **only** message length and the top 16 bits of the first word — nothing else. The legitimate lottery-entry payload built by this contract is `abi.encode(MSG_TYPE_LOTTERY_ENTRY, buyer, tokenIn, amount, sourceChainId, coverageBalance)` (CreatorShareOFT.sol:917-929), which is exactly 192 bytes (6 × 32-byte words). Per the reviewing agents' documented knowledge of LayerZero's `OFTMsgCodec` wire format, a standard `send()`/`sendAndCall()` payload is packed as `sendTo(32 bytes) + amountSD(8 bytes) [+ composeFrom(32) + composeMsg(N)]` — i.e. any caller of the OFT's own public `send()` function fully controls both the `to` field (which becomes word0) and, for a compose-enabled send, the `composeMsg` bytes and length. Setting `SendParam.to = bytes32(uint256(3))` makes word0 equal exactly `MSG_TYPE_LOTTERY_ENTRY`, and choosing a `composeMsg` length of 88, 120, or 152 bytes makes the total packed message exactly 160, 192, or 224 bytes — colliding with all three lengths this classifier accepts.

Crucially, this message is **fully permissionless and legitimately peer-authenticated**: it is a normal, unmodified cross-chain OFT transfer sent by any end-user from any registered spoke chain, so it passes the standard LayerZero peer-authentication check (`_origin.sender == peers[srcEid]`) that runs before `_lzReceive` is ever invoked — that check verifies the message really came from the correct spoke *contract*, not that any particular payload within it was sanctioned. The `_isRemoteLotteryEntryMessage` branch itself performs **no additional sender check** (contrast the sibling `_isWinnerCallbackMessage` branch, which — per an explicit `M-7` fix comment at CreatorShareOFT.sol:1058-1062 — was hardened with a full 4-word structural validation specifically to prevent this exact class of collision; the lottery-entry-forward branch was never given the same treatment).

**Proof of Concept**

1. Attacker calls the public `send()` on any spoke-chain ShareOFT with `SendParam.to = bytes32(uint256(3))`, `amountLD = 0` (or any small amount — `_removeDust(0) = 0` and burning 0 from the sender succeeds under standard ERC20 semantics), and a `composeMsg` crafted to 88 bytes so the total wire payload is 160 bytes.
2. The message is peer-authenticated by the base OApp layer (it genuinely originates from the registered spoke ShareOFT) and delivered to the hub.
3. `_isRemoteLotteryEntryMessage` sees length 160 and `word0 == 3` → matches. The hub forwards the *entire attacker-crafted byte string* — including whatever the attacker packed into the `composeMsg` portion, which lands in the fields the real lottery-entry format expects for `buyer`/`tokenIn`/`amount`/`sourceChainId`/`coverageBalance` — to `LotteryManager.receiveRemoteLotteryEntry(...)`, bypassing entirely the honest `_queuePendingLotteryEntry` mechanism (which normally snapshots a real buyer's real block-start balance for coverage).
4. The function `return`s before `super._lzReceive` runs, so no OFT credit occurs for this message — if `amountLD` was set to a nonzero value, that amount is burned on the source chain and never credited anywhere (a self-inflicted loss for a user who legitimately used `to = address(3)`, vanishingly unlikely but theoretically possible); with `amountLD = 0`, the attacker's cost is only the LayerZero messaging gas.

**Recommendation**

Apply the same hardening already used for `_isWinnerCallbackMessage`: require the message to match the *exact* canonical ABI-encoded lottery-entry shape (not just length), decode and validate every field's structural shape (address fields' upper 96 bits zero, sane bounds on `sourceChainId`), and consider routing lottery-entry forwards through a dedicated, separately-authenticated channel rather than sharing the same peer-trust boundary as ordinary token transfers.

```diff
  function _isRemoteLotteryEntryMessage(bytes calldata message) internal pure returns (bool) {
      if (message.length != 160 && message.length != 192 && message.length != 224) return false;
      uint256 word0;
      assembly { word0 := calldataload(message.offset) }
      if (word0 >> 16 != 0) return false;
-     return uint16(word0) == MSG_TYPE_LOTTERY_ENTRY;
+     if (uint16(word0) != MSG_TYPE_LOTTERY_ENTRY) return false;
+     // Mirror the M-7 hardening applied to _isWinnerCallbackMessage: validate
+     // every field's ABI shape so a packed OFT send/compose payload cannot collide.
+     // (decode remaining words per the real 6-field lottery-entry layout and
+     // bounds-check address / chainId fields here)
+     return true;
  }
```

**Note on confidence.** This finding's mechanism rests on the reviewing agents' documented knowledge of LayerZero V2's public `OFTMsgCodec` wire format, since the LayerZero library is not vendored in this repository checkout and could not be mechanically diffed against source (the same category of limitation noted for OpenZeppelin's storage layout in the companion vault audit). Two independent agent instances converged on the identical byte-level collision analysis. Confirming this against the actual `@layerzerolabs/oft-evm` dependency version pinned in this repo's build is recommended before treating this as fully closed either way.

---

### [3] Wrapper's own async-redemption gate is stateless and trivially bypassed by splitting a large exit across multiple calls

`CreatorOVaultWrapper._requireSynchronousRedemption()` · **Severity: Medium** · **Confidence: 75** · Origin: `[phase1 only]` `erc4626`

**Description**

```solidity
function _requireSynchronousRedemption(uint256 vaultShareAmount) internal view { ... }
```
(CreatorOVaultWrapper.sol, `withdraw`/`withdrawFor` call site) staticcalls the (out-of-scope) vault's `largeWithdrawalThreshold()` and reverts `AsyncRedemptionRequired` when `vault.previewRedeem(vaultShareAmount) >= threshold`. This check is entirely stateless and per-call — there is no aggregation across multiple calls within a transaction or across a block/window. Any holder past the deposit cooldown can call `withdraw()` repeatedly, each time redeeming just under the threshold, and drain an arbitrarily large position synchronously — precisely what the vault's own large-withdrawal queue mechanism (in the companion vault contract) exists to force into an async, delayed path. The gate is also self-defeating for honest large withdrawers, who get a hard revert with no async alternative offered by the wrapper (only `unwrap()` to raw vault shares skips the check entirely, since it never calls `vault.redeem`).

**Proof of Concept**

Vault sets `largeWithdrawalThreshold() = 100_000e18`. A holder with a position worth 1,000,000 (in the underlying asset) calls `withdraw(amountᵢ)` 11 times within a single transaction, each with `previewRedeem` just under 100,000. Every individual call passes the per-call check and executes `vault.redeem` synchronously, draining the full position in one transaction — the exact large, synchronous, un-delayed exit the vault's threshold mechanism was designed to prevent.

**Recommendation**

Enforce cumulatively: track redeemed value per address within a rolling window (matching the vault's own delay window) and revert once the running sum crosses the threshold. Alternatively, if the vault itself independently enforces the threshold per call regardless of caller, remove the wrapper-side check as redundant and misleading (it currently blocks legitimate single large withdrawals with no offered alternative).

---

### [4] Owner-exclusion on `mint()` is trivially bypassable via `setMinter`, and the mint-backing invariant is a complete no-op on every non-hub chain

`CreatorShareOFT.mint()` / `setMinter()` / `_assertMintBacking()` · **Severity: Medium** · **Confidence: 85** · Origin: `[phase1 only]` `access-control`

**Description**

```solidity
function mint(address _to, uint256 _amount) external {
    if (msg.sender != vault && !isMinter[msg.sender]) {
        revert OnlyVaultOrMinter();
    }
    _mint(_to, _amount);
    _assertMintBacking();
    emit SharesMinted(_to, _amount);
}
```
(CreatorShareOFT.sol:482-489, NatSpec at :474 documents *"owner is not a free minter"*). `mint`'s guard checks only `vault` or `isMinter[msg.sender]` — deliberately **not** `owner()`. But `setMinter` (CreatorShareOFT.sol:444-448) is a plain `onlyOwner` function with no self-exclusion, so the stated protection is bypassed in one extra transaction: `setMinter(owner(), true)` then `mint(...)` freely.

The only backstop is `_assertMintBacking`:
```solidity
function _assertMintBacking() internal view {
    if (wrapper == address(0) || vault == address(0)) return;    // <-- line 494
    uint256 supply = totalSupply();
    ...
    uint256 held = IERC20(vault).balanceOf(wrapper);
    if (held < required) revert UnbackedShareMint(held, required);
}
```
(CreatorShareOFT.sol:492-501). This early-returns whenever `vault == address(0)` — which is true, **by design**, on every non-hub/remote deployment (only the hub deployment has a local vault and wrapper bound). So on any remote chain, an owner who grants itself minter status can mint arbitrary ■TOKEN supply with **zero on-chain backing check whatsoever**.

**Proof of Concept**

On an Arbitrum (remote) ShareOFT deployment: owner calls `setMinter(owner(), true)`, then `mint(owner(), 1_000_000e18)`. `_assertMintBacking()` immediately returns at line 494 since `vault == address(0)` on that chain. 1,000,000 fully unbacked ■TOKEN now exist and can be sold/bridged, diluting or defrauding legitimate holders. This requires the owner key (a trusted role), so it is rated Medium (owner-only / trust-model violation) rather than an externally-exploitable High.

**Recommendation**

Either exclude `owner()` inside `setMinter` itself (so the owner cannot grant itself minter status), or hub-gate `mint()` entirely (`require(isHub)`), documenting that remote-chain supply should only ever arrive via LayerZero `_credit`, never via a local mint.

---

### [5] A hardcoded default address holds live LayerZero peer/hub-wiring co-authority on every remote deployment from the moment of construction, with no owner opt-in

`CreatorShareOFT.remoteProtocolWireAuthority` / `onlyOwnerOrRemoteProtocolWire` · **Severity: Medium** · **Confidence: 70** · Origin: `[phase1 only]` `access-control`

**Description**

```solidity
address public remoteProtocolWireAuthority = 0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3;
```
(CreatorShareOFT.sol:340) gates `setPeer`, `setHubConfig`, and `setHubLotteryPeer` via `onlyOwnerOrRemoteProtocolWire`, which grants this address co-authority whenever `block.chainid != 8453` (i.e. everywhere except Base). The chainid gate itself is sound (non-spoofable, and the authority branch is correctly unreachable on Base). The concern is that this specific hardcoded address is a **live**, active co-authority on every remote deployment from the instant of construction — no owner action is required to activate it — and it is revocable only after the fact via `setRemoteProtocolWireAuthority(0)`.

**Proof of Concept**

Not third-party exploitable without control of that specific private key. If that key were ever compromised (a single address hardcoded across every creator's remote ShareOFT deployments), the holder could call `setPeer` on any fresh remote deployment to wire an attacker-controlled peer, then trigger a cross-chain credit that mints arbitrary ■TOKEN on that chain via the standard (unmodified) OFT `_credit` path — with zero owner participation required, since the authority was live from deployment.

**Recommendation**

Do not hardcode a live default. Initialize `remoteProtocolWireAuthority = address(0)` and require the deploying owner to explicitly opt in per deployment. If this address is a deliberate deploy-automation convenience (e.g. a known multisig), document the entity and its key-management practices explicitly.

---

## Low Severity

- **[L-1] Dust-attribution asymmetry in `depositFor`/`withdrawFor`** (converged from Phase 1 `general`/`erc4626`/`precision-math` and Phase 2 `asymmetry`/`first-principles`/`execution-trace`/`trust-gap`/`numerical-gap` — 8 total instances, all rated LEAD/supporting): `depositFor`/`withdrawFor` attribute rounding dust (`userDustShares`) to the named `beneficiary` while minting/burning ■TOKEN against `msg.sender` (the operator). This has two symptoms — dust seeded via `depositFor` can be stranded (the beneficiary never receives tokens to trigger a reclaiming unwrap), and dust accumulated by a beneficiary's own prior self-deposits can be swept into an operator's own redemption via `withdrawFor` (bounded to <1000 vault-share units, i.e. <1 ■TOKEN, per occurrence). Requires the owner-granted, trusted `isBeneficiaryOperator` role — not exploitable by an untrusted third party. Fix: key dust off the same principal that receives/burns the ■TOKEN (`mintTo`/`burnFrom`), not the accounting beneficiary.
- **[L-2] Hub's remote-lottery-entry-forward branch is not wrapped in try/catch**, unlike every other lottery/fee external call in the contract (`_triggerLotteryLocal`, `_sendFeesToGauge` both use try/catch). A reverting `LotteryManager.receiveRemoteLotteryEntry` stalls that specific inbound LZ message (retryable, not permanent; unrelated token-transfer messages are unaffected).
- **[L-3] `flushFees` dust stranding + `quoteFlushFees` downcast**: `flushFees` zeroes `pendingFees` for the full amount, but LayerZero's shared-decimals dust-trimming (`_removeDust`) sends slightly less — the trimmed remainder becomes untracked ■TOKEN balance with no sweep path, compounding per flush. Separately, `quoteFlushFees` truncates `pendingFees` to `uint64` in its quote encoding, producing an inaccurate (advisory-only) fee estimate once accumulated fees exceed ~18 tokens.
- **[L-4] Buy fee floors to zero for sub-~14-wei transfers** (18-decimal token, economically irrelevant) and rounds fee collection down rather than up (favors the buyer by <1 wei) — not profitably exploitable.
- **[L-5] Constructor and `refreshApproval()` use raw `IERC20.approve()` on Creator Coin** instead of `SafeERC20.forceApprove` — breaks wrapper deployment entirely for no-bool-return tokens (legacy USDT-style), and would revert on re-approval for approve-race-sensitive tokens.
- **[L-6] Fee-on-transfer/deflationary Creator Coin causes `deposit()` to hard-revert** (wrapper passes the pre-transfer `amount` to `vault.deposit` rather than the measured received delta) — DoS only, transaction reverts atomically with no accounting corruption.
- **[L-7] Creator Coin pause/blocklist causes deposit/withdraw-via-vault DoS**, but users retain an `unwrap()`-to-raw-vault-shares escape hatch that never touches Creator Coin — no principal loss.
- **[L-8] Wrapper's `deposit()` trusts `vault.deposit`'s *returned* share count** for `totalLocked` with no independent balance-delta re-check (asymmetric with the wrapper's own careful delta-checking on its ■TOKEN mint/burn calls). Bounded by the OFT-side `_assertMintBacking` backstop on the hub; the asymmetry is a defense-in-depth gap, not a demonstrated exploit.
- **[L-9] One-shot bindings (`setVault`, `setWrapper`, `setShareOFT`) are correctly un-bypassable by third parties**, but permanently lock a wrong-but-valid address with no recovery path if the owner mis-configures at setup.
- **[L-10] No `Ownable2Step` on either contract; `renounceOwnership()` is inherited and callable.** Owner is load-bearing for ongoing liveness (peer wiring on Base, minter grants, fee/venue tagging). Loss of the owner key bricks administration, not fund custody.
- **[L-11] Owner can tag an arbitrary (non-venue) address `SwapOnly`**, imposing the buy-fee tax on that specific address's outbound transfers, or tag any address `NoFees` to exempt it — an unexpected power beyond the nominal "trading venue" registration purpose. Owner-gated only; no self-registration surface exists for attackers.
- **[L-12] Custom-message type-tag disambiguation could theoretically self-misroute a standard OFT payload** whose recipient address happens to collide with the winner-callback type tag (128-byte case) — same class of issue as Finding [2] but on the winner-callback branch, which is event-only (no funds move) and `_guid`-deduped, so impact is limited to a self-inflicted dropped credit for a nonsensical recipient choice, not third-party exploitable.
- **[L-13] `flushThreshold` is declared, settable, and emits events, but is never read anywhere** — a pure documentation/code mismatch implying a non-existent auto-flush behavior.
- **[L-14] `convertToAssets` silently clamps oversized input instead of reverting** — view-only, no on-chain consumer in scope, informational for off-chain integrators only.

## Info (confirmations / non-issues, kept for completeness gate)

- **[Precision-math verified-safe set]**: 1000x wrap/unwrap dust conservation is exactly conservative (algebraically verified — no rounding lets a user extract more vault-shares than deposited); mint-backing invariant cannot spuriously revert on the tight dust-decrease case; no division-before-multiplication issues; remaining explicit casts are safe.
- **[Flashloan verified-safe set]**: lottery coverage snapshot (H-02) is airtight against same-block flash-borrowed ■TOKEN (block-start balance frozen on first touch); buy-fee/lottery triggering via flash loan costs a real, non-reversible fee — no free-trigger path; wrap/unwrap round-trip is value-neutral with no cross-user dust-pool drain.
- **[Bridges/LayerZero verified-safe set]**: the winner-callback branch's authentication + `_guid` dedup is airtight and correctly required (unlike the lottery-entry-forward branch, per Finding [2]); `_payNative`/native-fee handling verified safe (no drain, correct overpay refund); `setRegistry` cannot redirect LZ message routing (endpoint immutably bound at construction).
- **[ERC20 verified-safe set]**: buy-fee bypass vectors explicitly probed and closed — no approve/transferFrom inconsistency, no `NoFees`/`SwapOnly` laundering (owner-only tagging, no self-registration), zero-amount transfers handled correctly, cooldown-hook try/catch never blocks a legitimate transfer under normal gas.
- **`_assertMintBacking`'s `vault.balanceOf(wrapper)` read is donation-inflatable but only in the direction that weakens (never defeats) the check** — a donation can only make backing look more sufficient, never less.
- Various additional Info-level confirmations: exact-transfer Creator Coin assumption consistent (delegated to the vault, not independently re-verified by the wrapper); wrapper preview functions inherit vault revert behavior (no strict ERC4626 compliance requirement since the wrapper is not itself a vault); standard ERC20 approve-race on ■TOKEN allowance (no protocol-specific amplification); `wrap()`'s vault-share intake lacks a balance-delta check (asymmetric with mint/burn checks, not exploitable given vault shares aren't fee-on-transfer/rebasing).

---

## Access-Control Inventory (summary — full detail in Phase 0 protocol map)

| Role | Grant/Transfer | Key entrypoints unlocked |
|---|---|---|
| **owner** (both contracts) | 1-step `Ownable.transferOwnership` (no 2-step) | Nearly all admin setters on both contracts; `mint` exclusion is bypassable via `setMinter` (Finding [4]) |
| **remoteProtocolWireAuthority** | Hardcoded live default (Finding [5]); revocable | Off-Base-only: `setPeer`, `setHubConfig`, `setHubLotteryPeer` |
| **vault** / **isMinter** (OFT) | `setVault` (one-shot), `setMinter` (repeatable, `onlyOwner`, no self-exclusion) | `mint`, allowance-free `burn` (vault only) |
| **wrapper** (OFT) | `setWrapper` (one-shot) | Registered minter + `NoFees` + cooldown-hook target; backing-check anchor |
| **gaugeController / hubGaugeReceiver / hubLotteryPeer / hubEid / isHub** | `setGaugeController`/`setHubConfig`/`setHubLotteryPeer` (owner or off-Base wire authority) | Fee routing, lottery routing, LZ callback authentication |
| **isLotteryResolver** allowlist | `setLotteryResolver`, `onlyOwner` | Trusted `ILotteryBeneficiary` redirect targets |
| **addressType** (`SwapOnly`/`NoFees`) | `setAddressType(s)`, `onlyOwner`, no self-registration | Buy-fee taxation classification (Low L-11 for misuse potential) |
| **shareOFT / vault / creatorCoin** (Wrapper) | `setShareOFT` (one-shot), `vault`/`creatorCoin` immutable | Mint/burn target, deposit/redeem target |
| **isWhitelisted / isBeneficiaryOperator** (Wrapper) | `setWhitelist`/`setBeneficiaryOperator`, `onlyOwner` | Fee/cooldown exemption; `depositFor`/`withdrawFor` attribution (Low L-1) |

**Permissionless entrypoints**: `transfer`/`transferFrom` (fee/lottery-triggering), `flushPendingFeesToGauge`/`flushFees` (hub/remote respectively), `submitPendingLotteryEntry` (self-only), `lzReceive` (endpoint+peer-authenticated, with Finding [2]'s gap in the custom lottery-entry branch); wrapper `deposit`/`depositFor`/`withdraw`/`withdrawFor`/`wrap`/`unwrap` (all open, `*For` variants restrict only accounting attribution).

---

## Threat Model (summary)

| Actor | Reachable | Invariant / Disposition |
|---|---|---|
| Arbitrary buyer/seller | transfer/transferFrom (fee/lottery path) | Fee-bypass vectors explicitly probed and closed; no issue |
| Arbitrary caller, no role | flushFees, flushPendingFeesToGauge, deposit/withdraw/wrap/unwrap | **Addressed by Findings [1], [3]** |
| Arbitrary spoke-chain user | `send()`/`sendAndCall()` crafted payloads to the hub | **Addressed by Finding [2]** |
| Hostile/compromised gaugeController, LotteryManager, Registry | receiveFees, processSwapLottery, receiveRemoteLotteryEntry, getLotteryManager | Try/catch fallbacks hold where present (L-2 notes one gap); registry-liveness-gates-buys is a documented dependency |
| Owner | addressType tagging, minter grants, hub/peer config, fee bps | **Addressed by Findings [4], [5]**; otherwise trusted-role behavior consistent with the stated model |
| Trusted `isBeneficiaryOperator` | depositFor/withdrawFor | **Addressed by L-1** (bounded, sub-token impact) |
| Compromised `remoteProtocolWireAuthority` key | setPeer/setHubConfig on any remote chain | **Addressed by Finding [5]** |

---

## Coverage Gate

- **Entrypoints**: ~50 external/public functions across both in-scope files (per Phase-0 inventory); every privileged and permissionless state-changing entrypoint is either the subject of a finding above, addressed by a Low/Info item, or was explicitly examined and cleared (documented per-agent: CEI ordering on all external calls, mint-backing invariant algebra, dust-conservation algebra, LayerZero native-fee handling, buy-fee bypass sweep).
- **Threat-catalog rows**: all 7 rows from the Phase-0 threat catalog are answered above (Threat Model table).
- **Coverage holes closed this pass**: 0 — both hunting phases independently reached full coverage of the inventory and catalog; no entrypoint was left unexamined by either phase.
- **Out-of-scope dependencies affecting finding confidence**: `CreatorOVault.sol` (the actual ERC4626 vault, audited separately) — Finding [1]'s downstream profitability and Finding [3]'s exact enforcement semantics both depend on vault-side behavior not re-verified in this job. `CreatorGaugeController`/`LotteryManager`/`Registry` — not present in this checkout; several Low findings and Finding [2]'s ultimate impact depend on their behavior. LayerZero's `OFT`/`OApp`/`OFTCore` base contracts and the `OFTMsgCodec` wire format — not vendored anywhere on this machine; Finding [2] rests on documented public specification rather than a direct source diff, and its confidence is capped accordingly.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit system (context-building → breadth checklist review → depth attacker-mindset review → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug-bounty program, and on-chain monitoring are strongly recommended before or alongside any mainnet deployment, especially given the unresolved out-of-scope dependencies noted above (the companion vault contract, gauge/lottery/registry contracts, and the unvendored LayerZero OFT library).
