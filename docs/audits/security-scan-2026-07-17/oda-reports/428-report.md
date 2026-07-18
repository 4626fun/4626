# 🔐 Security Review — CreatorShareOFT + CreatorOVaultWrapper

---

## Audit Target (pinned)

| | |
|---|---|
| **Client-designated source of truth** | `https://litter.catbox.moe/8guk8b.md` |
| **SHA-256 of fetched bundle** | `b4d9d7fcfdfb8ae0bef7d5f58a8c2b8f3009b8b3ea725fd801a08d71ae7527ef` |
| **Fetched** | 2026-07-18 10:10 UTC |
| **Files audited** | `contracts/creator/vault/CreatorShareOFT.sol` (1369 lines) · `contracts/creator/vault/CreatorOVaultWrapper.sol` (844 lines) |
| **Repo** | `github.com/wenakita/4626` (private) — audited via the client-supplied markdown source bundle above, per the job's explicit instruction. `github.com/wenakita/CreatorVault` (a legacy/different repo) was explicitly excluded from scope per the client's instruction and was not consulted. |
| **Methodology** | Three-phase: context mapping (protocol map + access-control inventory + threat catalog) → breadth (6 domain checklists, ethskills) → depth (12 attacker-mindset agents, pashov, blind to breadth-phase findings) → hybrid reconciliation |

No live on-chain deployment address was provided for this scope (contrast with related jobs auditing this protocol's `DeploymentBatcher`/`Registry4626`, which did include Base addresses) — this review is of the source bundle as fetched above.

---

## Scope

|                                  |                                                        |
| -------------------------------- | ------------------------------------------------------ |
| **Mode**                         | Client-specified files only (both `.sol` files in the bundle) |
| **Files reviewed**               | `CreatorShareOFT.sol` · `CreatorOVaultWrapper.sol` |
| **Client-stated focus areas**     | Mint authority, vault-backing, LZ credit, fee flush, lottery coverage snapshots |
| **Confidence threshold (1-100)** | 45 |

---

## Reconciliation Summary

**Overlap: 9 · Breadth-only: 8 · Depth-only: 1 · Re-examined leads kept: 3, demoted: 0 · Coverage holes closed: 0**

Breadth (6 domain checklists) and depth (12 blind attacker-mindset agents) converged strongly on the same core issues despite running independently with no shared findings — the two cross-chain/native-fee bugs below were each rediscovered by 5-9 of the combined 18 agents. This convergence is itself the strongest evidence in this report: neither phase anchored on the other. One depth-phase finding (the withdrawal-cooldown griefing bug) was not surfaced by the checklist-driven breadth phase at all — it required attacker-mindset hunting to find, and is the report's most severe unprivileged, no-precondition issue.

**Confidence + reporting floor.** Every finding below carries a `confidence` score (0-100). All findings Low severity and above are reported. Two items with contingent/out-of-scope dependencies and one gated by the judging protocol's admin-action rule are listed under **Leads** rather than as findings — they are plausible, code-grounded, but not independently confirmed to fire without either (a) trusting an out-of-scope contract's specific behavior, or (b) a privileged role acting against its own attributed user's interest with no unprivileged amplifier.

**Coverage gate** (against the phase-0 protocol map's Access-Control Inventory and Threat Catalog): 63 external/public state-changing entrypoints in the combined inventory (30 in `CreatorShareOFT`, 33 in `CreatorOVaultWrapper`), 63 addressed — either by an explicit finding/lead above, or examined and confirmed sound across the 18-agent combined sweep (documented in the Access-Control Inventory table below). 8 threat-catalog rows from the phase-0 map, 8 answered — 3 by confirmed findings, 5 by "invariant holds" with the supporting trace. **Holes closed this pass: 0** (both phases already achieved full coverage independently; no entrypoint or threat-catalog row required a first-time re-read at reconciliation).

---

## Findings

[90] **1. Winner-callback admission accepts the OFT peer as sender, but the handler enforces only the lottery-manager peer — cross-chain lottery-winner notifications are deterministically dropped**

`CreatorShareOFT._handleWinnerCallback` / `_isWinnerCallbackMessage` · Confidence: 90 · Severity: **Medium** · Origin: **[both]** — breadth: general, bridges; depth: execution-trace (FINDING), economic-security (FINDING), flow-gap (FINDING), + 9 more agents as corroborating leads across both phases (18/18 combined agents touched this)

**Description**
`_isWinnerCallbackMessage` (`CreatorShareOFT.sol:1027-1069`) admits a callback when `_origin.sender == hubLotteryPeer` **or** `_origin.sender == peers[hubEid]` — the second branch is explicitly commented as supporting a "forwarded callback wiring" mode where a single OFT peer relays both token transfers and lottery callbacks. `_handleWinnerCallback` (`CreatorShareOFT.sol:1085-1098`) then reverts `InvalidCallback()` unless `_origin.sender == hubLotteryPeer` strictly. Because LayerZero's inherited `OAppReceiver.lzReceive` already guarantees `_origin.sender == peers[_origin.srcEid]` before any message reaches `_lzReceive` at all, every winner callback that arrives via the documented "forwarded callback wiring" mode necessarily has `_origin.sender == peers[hubEid]` — which is admitted by the first check and then unconditionally rejected by the second. Under that wiring mode, `LotteryWinnerNotification` can never be emitted on the remote chain; every retry of the same LayerZero message fails identically (the `usedReportIds[_guid]` dedup write at `CreatorShareOFT.sol:1018` rolls back with the revert, so the message is neither consumed nor deliverable).

**Proof of Concept**
1. Operator wires per the intended pattern: `setPeer(hubEid, hubShareOFTBytes32)` (so `peers[hubEid] = hubShareOFT`) and `setHubLotteryPeer(hubEid, lotteryManagerBytes32)` (so `hubLotteryPeer = lotteryManager`, a *different* address, per the docstring at `CreatorShareOFT.sol:1124`/`1126`).
2. Hub emits a winner callback via the OFT peer lane (the "forwarded callback wiring" mode). The message can only arrive with `_origin.sender = hubShareOFT` (LayerZero's own peer enforcement).
3. `_isWinnerCallbackMessage` admits it via the `peers[hubEid]` branch; structural (128-byte, word-layout) checks pass; `usedReportIds[_guid] = true` is written.
4. `_handleWinnerCallback` compares `_origin.sender (hubShareOFT)` against `hubLotteryPeer (lotteryManager)` — mismatch, reverts `InvalidCallback()`. The entire `lzReceive` call reverts. Every subsequent retry of this exact message reverts identically.

Impact is confined to the informational remote-chain event — no funds move inside `_handleWinnerCallback`, and hub-side prize payout (out of scope for these two files) is not directly affected.

**Fix**
```diff
 function _handleWinnerCallback(Origin calldata _origin, bytes calldata _message) internal {
-    if (hubLotteryPeer == bytes32(0) || _origin.sender != hubLotteryPeer) {
+    bytes32 managerPeer = hubLotteryPeer;
+    bytes32 oftPeer = peers[hubEid];
+    bool fromAllowedPeer = (managerPeer != bytes32(0) && _origin.sender == managerPeer)
+        || (oftPeer != bytes32(0) && _origin.sender == oftPeer);
+    if (!fromAllowedPeer) {
         revert InvalidCallback();
     }
```
(Or narrow `_isWinnerCallbackMessage` to `hubLotteryPeer` only, if the OFT-peer forwarding mode is not actually the intended production wiring — the two checks must agree either way.)

---

[90] **2. Native-fee overpayment on lottery-entry submission and fee flush is silently trapped in the contract instead of being refunded, contradicting the code's own documentation**

`CreatorShareOFT._payNative` (affects `submitPendingLotteryEntry`, `flushFees`) · Confidence: 90 · Severity: **Medium** · Origin: **[both]** — breadth: general (P1-07); depth: access-control (FINDING), economic-security (FINDING), invariant (FINDING), first-principles (FINDING), boundary (FINDING), math-precision (corroborating lead) — 6 of 12 depth agents independently converged on this exact bug

**Description**
The overridden `_payNative` (`CreatorShareOFT.sol:975-978`) loosens the standard LayerZero exact-payment requirement (`msg.value == nativeFee`, which structurally prevents this bug by reverting on any overpayment) to `msg.value >= nativeFee` — but still returns only `_nativeFee`, not `msg.value`. The inherited `OAppSender._lzSend` forwards exactly this return value to the LayerZero endpoint (`endpoint.send{value: messageValue}`), so any excess `msg.value - nativeFee` never reaches the endpoint and is not part of what the endpoint could refund. It remains permanently in the ShareOFT contract's ETH balance, recoverable only by the contract owner via `withdrawETH` (`CreatorShareOFT.sol:1356`). The in-code comments at `CreatorShareOFT.sol:959` and `:974` explicitly claim "the LZ endpoint refunds excess to `_refundAddress`" — this is false for any caller who overpays, which is standard, expected practice when integrating with LayerZero (buffering against fee-quote drift between quote time and inclusion).

**Proof of Concept**
1. Off-chain caller quotes `fee.nativeFee = 0.01 ETH` via `quotePendingLotteryEntry`, then calls `submitPendingLotteryEntry{value: 0.012 ETH}(entryId)` with a defensive buffer (standard practice).
2. `msg.value (0.012) >= fee.nativeFee (0.01)` — the check at `CreatorShareOFT.sol:869` passes.
3. `_lzSend` → `_payNative(0.01 ETH)` returns exactly `0.01 ETH` (not `0.012 ETH`).
4. `endpoint.send{value: 0.01 ETH}(...)` — the endpoint receives exactly the quote and has nothing left to refund.
5. `0.002 ETH` remains stranded in the ShareOFT contract's balance, never returned to the caller; only the owner's `withdrawETH` can move it, to an owner-chosen address.

**Fix**
```diff
 function _payNative(uint256 _nativeFee) internal virtual override returns (uint256 nativeFee) {
     if (msg.value < _nativeFee) revert NotEnoughNative(msg.value);
-    return _nativeFee;
+    return msg.value;
 }
```
This lets the LayerZero endpoint receive the true `msg.value` and refund the genuine excess to `_refundAddress`, matching the code's own documented intent. (Alternative: explicitly refund `msg.value - _nativeFee` to `msg.sender` after the send.)

---

[80] **3. Unsolicited dust transfers force a victim's withdrawal cooldown forward, enabling repeatable, fully unprivileged withdrawal-censorship of a targeted holder**

`CreatorOVaultWrapper.propagateCooldownOnTransfer` (triggered via `CreatorShareOFT._update`) · Confidence: 80 · Severity: **High** (permanent DoS, no fund loss) · Origin: **[phase2 depth only]** — economic-security (FINDING), corroborated as leads by first-principles, boundary, periphery, flow-gap (5 of 12 depth agents). Not surfaced by the breadth-phase checklists; re-examined and confirmed against the actual source by the orchestrator during reconciliation (line citations verified directly).

**Description**
`propagateCooldownOnTransfer` (`CreatorOVaultWrapper.sol:812-826`) is called by `CreatorShareOFT._update` on every non-mint/non-burn ShareOFT transfer. Per its own NatSpec (`CreatorOVaultWrapper.sol:795-810`), it exists to stop a user from depositing, transferring the resulting ShareOFT to a fresh throwaway address, and withdrawing from that fresh address in the same block — a flash-loan-style cooldown bypass. It does this by force-propagating the *sender's* `lastWrapperDepositBlock` forward onto the *recipient*, whenever the sender's is more recent. This mechanism has no way to distinguish "sender laundering their own cooldown via a fresh address" from "sender griefing an unrelated, already-established victim" — both look identical on-chain. Any address can therefore reset an arbitrary victim's withdrawal cooldown by (1) depositing/wrapping a trivial amount (stamping their own `lastWrapperDepositBlock = block.number`), then (2) sending the victim even 1 wei of ShareOFT, which the victim cannot decline. The victim's next `withdraw`/`unwrap`/`withdrawFor` call reverts `WrapperWithdrawTooSoon` for that block. Repeating this every block — feasible by front-running the victim's pending withdrawal transaction — sustains an indefinite, targeted freeze on a specific victim's ability to withdraw, at only the attacker's ongoing gas cost. No approval, privilege, or precondition on the victim's side is required.

**Proof of Concept**
1. Attacker calls `wrap(1)` (or any dust `deposit`), setting `lastWrapperDepositBlock[attacker] = block.number` (`CreatorOVaultWrapper.sol:446`).
2. Attacker calls `shareOFT.transfer(victim, 1)` (1 wei of ShareOFT — an ordinary, unpermissioned ERC20 transfer the victim cannot block).
3. `CreatorShareOFT._update` fires the hook: `wrapper.propagateCooldownOnTransfer(attacker, victim)`.
4. Inside, `fromBlock (attacker's, = current block) > toBlock (victim's, likely older)` → `lastWrapperDepositBlock[victim] = block.number` (`CreatorOVaultWrapper.sol:824`).
5. Victim calls `withdraw`/`unwrap` — `_requireWrapperCooldown` (`CreatorOVaultWrapper.sol:789-793`) computes `requiredBlock = block.number + wrapperWithdrawDelayBlocks (default 1)` against the freshly-bumped `lastWrapperDepositBlock[victim]` and reverts `WrapperWithdrawTooSoon`.
6. Attacker repeats steps 1-2 every block (or specifically front-runs the victim's withdrawal transaction whenever it appears in the mempool) to sustain the freeze indefinitely. Whitelisted or beneficiary-operator addresses are exempt from the cooldown check entirely and thus immune as victims; ordinary holders are not.

**Fix**
The precise fix narrows propagation to the actual bypass scenario the hook was built for — a genuinely fresh recipient with no prior ShareOFT balance — rather than any recipient, including established holders unrelated to the sender:
```diff
 function propagateCooldownOnTransfer(address from, address to) external {
     if (msg.sender != address(shareOFT)) revert CooldownHookUnauthorizedCaller(msg.sender);
     if (from == address(0) || to == address(0)) return;
     if (from == to) return;

     uint256 fromBlock = lastWrapperDepositBlock[from];
     if (fromBlock == 0) return;

+    // Only propagate onto genuinely fresh recipients (no existing ShareOFT
+    // balance before this transfer) — the case the flash-loan bypass actually
+    // requires. An established holder receiving an unsolicited transfer must
+    // not have their own withdrawal cooldown reset by an unrelated sender.
+    if (IERC20(shareOFT).balanceOf(to) > 0) return;
+
     uint256 toBlock = lastWrapperDepositBlock[to];
     if (fromBlock > toBlock) {
         lastWrapperDepositBlock[to] = fromBlock;
         emit CooldownPropagated(from, to, fromBlock);
     }
 }
```
Note: `_update` calls this hook *after* `super._update` has already applied the balance change, so `balanceOf(to)` at hook-call time includes the incoming transfer — the check must account for that ordering (e.g. compare against the transferred `value`, which would require passing `value` through to the hook, or read the pre-transfer balance before calling `super._update`). The direction of the fix is correct; the exact balance-check wiring needs care during implementation.

---

[85] **4. Mint-backing invariant is owner-defeatable via re-pointing either `vault` or `wrapper` — the existing zero-address guard does not achieve its stated purpose**

`CreatorShareOFT.setVault` / `setWrapper` / `_assertMintBacking` · Confidence: 85 · Severity: **Medium** (owner-only impact) · Origin: **[phase1: access-control]**

**Description**
`_assertMintBacking` (`CreatorShareOFT.sol:474-483`) is the protocol's headline solvency check: after every `mint`, it requires `IERC20(vault).balanceOf(wrapper) >= totalSupply() * 1000`. Both `vault` and `wrapper` are plain owner-settable storage. `setVault` (`CreatorShareOFT.sol:407-412`) has no restriction beyond non-zero. `setWrapper` (`CreatorShareOFT.sol:441-452`) has one guard (`:444-446`) blocking only a clear-to-`address(0)` while `totalSupply() > 0` — an explicit in-code comment claims this protects the mint-backing invariant, but it does not: pointing *either* `vault` or `wrapper` at an attacker-controlled contract with a forged `balanceOf()` defeats the check just as completely as clearing to zero, and neither setter blocks that. Combined with the unrestricted `setMinter` (`CreatorShareOFT.sol:429`), a single compromised or malicious owner key can mint unlimited unbacked ShareOFT in a short sequence, at any time post-launch, with no timelock or reaction window (both contracts use single-step `Ownable`).

**Proof of Concept**
1. Owner calls `setVault(fakeVault)` (or `setWrapper(fakeWrapper)`) where the fake contract's `balanceOf(anything)` returns `type(uint256).max`. Passes every existing check.
2. Owner calls `setMinter(attacker, true)`.
3. `attacker.mint(attacker, 1e30)` — `_assertMintBacking` reads the forged balance, passes unconditionally. Unbacked ShareOFT minted, dumpable into DEX pools or bridged out.

**Fix (Option A — timelock the trust anchors)**: route `setVault`/`setWrapper`/`setMinter`/`setGaugeController` through a `TimelockController`, and adopt `Ownable2Step` on both contracts, so a compromised-key mint cannot be combined with a re-point atomically and users retain a reaction window.

**Fix (Option B — bind the backing anchor once)**: make ShareOFT's `vault` immutable (set once at construction, mirroring how the Wrapper already binds its own `vault`/`creatorCoin`), and make `setWrapper` one-shot (mirroring the Wrapper's existing one-shot `setShareOFT`) rather than perpetually re-bindable.

---

[85] **5. `REMOTE_PROTOCOL_WIRE_AUTHORITY` is an unrevocable, hardcoded co-admin with owner-equivalent cross-chain wiring power on every non-Base deployment**

`CreatorShareOFT` constant at `:336`, `onlyOwnerOrRemoteProtocolWire` modifier `:342-350`, gating `setPeer` (`:395`), `setHubConfig` (`:1110`), `setHubLotteryPeer` (`:1128`) · Confidence: 85 · Severity: **Medium** · Origin: **[phase1: access-control, bridges]**

**Description**
`0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` (documented as "Protocol treasury Safe") is a compile-time constant — not settable storage — with **no on-chain revocation, rotation, or expiry mechanism**. On every chain where `block.chainid != 8453`, it holds full co-equal authority with `owner()` over the three most security-critical cross-chain configuration points. `setPeer` sets the OFT trust anchor: whoever controls it can register an attacker-controlled peer for an EID, and a message from that peer flows through `_lzReceive` → `super._lzReceive` → OFT `_credit`, minting ShareOFT to an arbitrary recipient with no backing. `setHubConfig`'s only guard (`:1116`) blocks setting `isHub=false` on Base; off-Base, this authority can flip a spoke to `isHub=true` while `gaugeController` is unset, causing every subsequent buy to revert with `HubGaugeControllerUnset` — a self-inflicted, single-tx DoS lever with no owner override.

**Proof of Concept**
Trust-model finding, not an external-attacker chain absent key compromise. If the hardcoded key is ever compromised, on any non-Base chain the holder calls `setPeer(attackerEid, attackerPeer)` to mint unbacked OFT credit, or `setHubConfig(true, ...)` to brick that spoke's buy path — either with a single transaction and zero on-chain recourse, simultaneously across every non-Base deployment.

**Fix**: replace the compiled-in constant with owner-settable storage (`address public remoteWireAuthority`), behind the same `Ownable2Step`/timelock protection recommended in Finding 4, with an explicit revoke path. Additionally constrain `setHubConfig` so a spoke cannot be flipped to `isHub = true` unless `gaugeController` is already configured, removing the self-DoS lever independent of who holds the key.

---

[60] **6. Deposit paths trust the caller-supplied `amount` rather than the measured `creatorCoin` balance delta**

`CreatorOVaultWrapper.deposit` / `deposit(uint256)` / `depositFor` · Confidence: 60 · Severity: **Low** · Origin: **[both]** — breadth: general, erc20, erc4626 (3 independent checklist agents); depth: 8 of 12 attack agents flagged this as a lead

**Description**
All three deposit entrypoints (`CreatorOVaultWrapper.sol:283-291`, `:308-313`, `:327-338`) call `creatorCoin.safeTransferFrom(msg.sender, address(this), amount)` immediately followed by `vault.deposit(amount, address(this))`, forwarding the caller-supplied `amount` rather than measuring `creatorCoin.balanceOf(address(this))` before/after the transfer. Contrast with the wrapper's own defensiveness toward its ShareOFT mint/burn calls, which *do* use before/after balance-delta assertions (`:519-524`, `:563-568`) — the untrusted external token is the one trusted blindly. `creatorCoin` is immutable (set once at construction) with no on-chain enforcement that it is fee-free. The protocol's stated underlying (Zora Creator Coins) is a standard fee-free ERC20, so there is no live exploit against the intended deployment — every agent across both phases that examined this converged on the same conclusion: a real but currently-latent assumption.

**Proof of Concept** (counterfactual — requires a fee-on-transfer/deflationary `creatorCoin`, which the intended token is not): user calls `deposit(100)`. `safeTransferFrom` lands `100 - fee` in the wrapper (0 prior balance). `vault.deposit(100, wrapper)` attempts to pull the full 100 from the wrapper, which holds only `100 - fee` → reverts. Deposits are bricked for such a token (DoS via clean revert, not fund loss).

**Fix**
```diff
+ uint256 balBefore = creatorCoin.balanceOf(address(this));
  creatorCoin.safeTransferFrom(msg.sender, address(this), amount);
- uint256 vaultShareAmount = vault.deposit(amount, address(this));
+ uint256 received = creatorCoin.balanceOf(address(this)) - balBefore;
+ uint256 vaultShareAmount = vault.deposit(received, address(this));
```
Apply to all three deposit entrypoints; the analogous gap exists for vault shares in `wrap()`.

---

[55] **7. `flushFees` strands sub-shared-decimal dust untracked and over-counts `totalFeesFlushed`**

`CreatorShareOFT.flushFees` · Confidence: 55 · Severity: **Low** · Origin: **[both]** — breadth: general, bridges; depth: math-precision, execution-trace, asymmetry, numerical-gap, periphery, flow-gap (6 of 12 depth agents)

**Description**
`flushFees` (`CreatorShareOFT.sol:707-728`) sets `pendingFees = 0` and `totalFeesFlushed += amount` for the *full* `amount` (`:712-714`), then sends `_sendParam.amountLD == amount` via `this.send`. The underlying OFT `_debit` only bridges `_removeDust(amountLD)` (LayerZero's shared-decimals trimming, typically leaving a sub-`1e12`-wei remainder on an 18-decimal token). The untrimmed remainder stays as ShareOFT balance at `address(this)`, but `pendingFees` has already been zeroed with nothing to re-credit it — it accumulates across flushes as permanently stranded, unswept balance (there is no ShareOFT sweep function, only `withdrawETH` for native ETH), and `totalFeesFlushed` over-reports by the same amount every flush. Confirmed non-insolvent by every agent that traced it (self-held balance never drops below `pendingFees`) — this is accounting drift and dust-magnitude value lock, not theft.

**Fix**: `uint256 sent = _removeDust(amount); pendingFees = amount - sent; totalFeesFlushed += sent;` — reconcile the counter to the actually-bridged amount rather than the pre-trim request.

---

[50] **8. `flushFees`'s SendParam validation pins destination and amount but leaves `composeMsg`/`extraOptions` fully caller-controlled on a self-authenticated, permissionless send**

`CreatorShareOFT.flushFees` · Confidence: 50 · Severity: **Low** · Origin: **[both]** — breadth: bridges; depth: boundary, trust-gap

**Description**
`flushFees` is permissionless and validates only `dstEid`, `to`, and `amountLD` (`CreatorShareOFT.sol:717-719`). `composeMsg`, `extraOptions`, `oftCmd`, and `minAmountLD` are forwarded from the caller unvalidated. Because the send executes as `this.send`, the resulting message is authenticated on the hub as originating from this ShareOFT's trusted OFT peer — a caller can attach a non-empty `composeMsg`, turning a routine fee flush into a LayerZero SEND_AND_CALL delivering attacker-chosen compose data to `hubGaugeReceiver` under the trusted identity, or set `extraOptions` to under-fund delivery gas (self-griefing only, since destination/amount stay pinned). Full exploitability depends on whether `hubGaugeReceiver` (`ITradeFeeCollector4626`, out of scope) implements a trusting `lzCompose` handler — unconfirmed from these two files, but the in-scope defect (unvalidated compose/options on a fixed-purpose bridge call) is concrete regardless.

**Fix**: construct the full `SendParam` internally from `buildFlushSendParam()` rather than accepting one from the caller, and explicitly reject non-empty `composeMsg` (`require(_sendParam.composeMsg.length == 0)`).

---

[45] **9. `quoteFlushFees` downcasts `pendingFees` to `uint64`, producing an inaccurate fee-quote payload for any realistic accumulated balance**

`CreatorShareOFT.quoteFlushFees` · Confidence: 45 · Severity: **Low** · Origin: **[phase1: general, precision-math]**

**Description**: `quoteFlushFees` (`CreatorShareOFT.sol:755-773`) builds its quote message with `uint64(pendingFees)` (`:766`). `type(uint64).max ≈ 1.84e19` (≈18.4 tokens at 18 decimals) — the default `flushThreshold` alone is `100e18`, so any realistic accumulated-fee balance silently truncates in this cast. `flushFees` itself uses the untruncated `pendingFees` for the real send (`:713`, `:718`) — only this convenience quoting view is affected, and LayerZero's `nativeFee` is driven mainly by message length/options rather than payload content, so practical quote error is likely small, but the cast is a genuine unguarded downcast footgun.

**Fix**: avoid the narrowing cast — quote against `buildFlushSendParam()`'s real payload via `_quote`/`quoteSend`, or compute the true shared-decimals amount before encoding.

---

[50] **10. Raw `.approve()` on external `creatorCoin` instead of SafeERC20's `forceApprove` — inconsistent with the file's own SafeERC20 discipline**

`CreatorOVaultWrapper` constructor `:194`, `refreshApproval()` `:774` · Confidence: 50 · Severity: **Low** · Origin: **[phase1: erc20]**

**Description**: The contract uses `SafeERC20` throughout (`safeTransfer`/`safeTransferFrom`) but both approval sites use raw `.approve()`. Not live against the intended Zora Creator Coin (returns `bool`, no approve-race), but a USDT-on-Ethereum-style no-return-value token would revert the constructor outright (bricking deployment), and a USDT-style approve-race token would permanently revert `refreshApproval()`.

**Fix**: replace both with `creatorCoin.forceApprove(address(vault), type(uint256).max)` — `SafeERC20` is already imported.

---

[45] **11. `emergencyWithdraw` is uncapped for every token except the vault-share token itself**

`CreatorOVaultWrapper.emergencyWithdraw` · Confidence: 45 · Severity: **Low** · Origin: **[phase1: access-control]**

**Description**: The vault-share cap (`actualLocked - requiredLockedBacking`, `:760-765`) was traced for a bypass and confirmed sound — legitimate wrap/unwrap moves `totalLocked` and `_requiredLockedBacking()` by identical deltas, so the owner cannot inflate the sweepable "excess" first. For **any other token** (including `creatorCoin` and ShareOFT itself), `emergencyWithdraw` sends the full requested amount to an owner-chosen `to` with no cap (`:767`). Primarily a legitimate rescue mechanism (the wrapper holds near-zero non-vault-share balance in normal operation), but it is an uncapped admin transfer to an admin-controlled destination.

**Fix**: acceptable if owner is a timelock/multisig (see Finding 4/5 recommendations); document explicitly that non-vault-share tokens are fully sweepable.

---

[50] **12. Owner (and any owner-granted operator) is exempt from both the fee schedule and the flash-loan withdrawal cooldown by default**

`CreatorOVaultWrapper` constructor `:189-191`, `_requireWrapperCooldown` `:789-793` · Confidence: 50 · Severity: **Low** · Origin: **[both]** — breadth: access-control; depth: trust-gap

**Description**: The constructor seeds the owner into `isWhitelisted` and `isBeneficiaryOperator`, and `_requireWrapperCooldown` exempts both sets from the flash-loan-style same-block deposit→withdraw guard (`:790`), not merely from fees. This is a scope-widening smell: the flash-loan guard is a safety property, but its exemption set is reused from the fee-whitelist/operator sets rather than scoped to it specifically, so any owner-granted beneficiary operator (a role meant for third-party deposit *attribution*, not fee/flash exemption) silently inherits full flash-loan-guard bypass. Requires the owner-granted role; not attacker-reachable directly.

**Fix**: decouple the flash-loan cooldown exemption from `isBeneficiaryOperator`, gating it on `isWhitelisted` only (or a dedicated flag); document the constructor's default owner grants explicitly for integrators.

---

[50] **13. No `Ownable2Step` on either contract; `renounceOwnership` can permanently brick an unconfigured Wrapper**

Both contracts' `Ownable` usage; one-shot `setShareOFT()` (`CreatorOVaultWrapper.sol:205-231`) · Confidence: 50 · Severity: **Low** · Origin: **[phase1: access-control]**

**Description**: `setShareOFT`'s one-shot guard was confirmed non-bypassable (plain storage, no proxy, no reset path). Both contracts use single-step `Ownable` (`transferOwnership` typo permanently loses admin) and both inherit `renounceOwnership()`; calling it on a Wrapper before `setShareOFT` has ever been invoked permanently bricks the contract (`shareOFT` can never be set, every `deposit`/`wrap` reverts `ShareOFTNotSet` forever).

**Fix**: adopt `Ownable2Step` on both contracts; consider overriding `renounceOwnership` to revert until all one-shot bindings are confirmed set.

---

[45] **14. `previewDeposit`/`previewWithdraw` return caller-dependent quotes via per-user dust, breaking third-party composability**

`CreatorOVaultWrapper.previewDeposit` / `previewWithdraw` · Confidence: 45 · Severity: **Low** · Origin: **[phase1: erc4626]**

**Description**: These functions read `userDustShares[msg.sender]` internally. An integrator `staticcall`ing on a user's behalf (its own near-zero dust) gets a different quote than the user's actual `deposit`/`withdraw` result. Rounding direction is correct (favors the protocol); discrepancy is bounded to under 1 ■AKITA-equivalent. Quoting-accuracy gap, not a value-extraction path.

**Fix**: add explicit-user preview variants (mirroring the existing `previewWrap`/`previewUnwrap`, which already take a `user` parameter), or document these two as caller-relative.

---

[40] **15. Small deposits/wraps that normalize to zero ShareOFT revert entirely, with the minimum viable deposit size growing as vault share price rises**

`CreatorOVaultWrapper._wrapInternal` (`:503-509`, `AmountTooSmallToNormalize`) · Confidence: 40 · Severity: **Low** · Origin: **[phase1: erc4626]**

**Description**: Clean revert (no partial state), but as vault PPS appreciates, the fixed 1000x normalization means a fixed creatorCoin amount buys progressively fewer vault shares, so the minimum deposit that clears the normalization floor grows silently over time — a usability cliff rather than a security defect.

**Fix**: acceptable if documented as by-design; alternatively bank any sub-normalization deposit entirely as dust rather than reverting.

---

[40] **16. Winner-callback path does not pin `_origin.srcEid`, and `usedReportIds` dedup is keyed on LZ `_guid` rather than logical win identity**

`CreatorShareOFT._isWinnerCallbackMessage` / `_lzReceive` · Confidence: 40 · Severity: **Low** · Origin: **[phase1: bridges]**

**Description**: Admission never checks `_origin.srcEid == hubEid` — exploiting this requires the *same* address configured as a peer on two different EIDs (a misconfiguration, not default state). Separately, `usedReportIds[_guid]` dedups on the LayerZero message id, which the endpoint already makes execute-once; it does not catch the hub emitting two distinct messages (two guids) for the same logical win, since the payload's logical identity is never used as the dedup key.

**Fix**: add `require(_origin.srcEid == hubEid)` to admission; if per-win idempotency is the intent, dedup on an explicit win/report id carried in the payload instead of (or in addition to) `_guid`.

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path is gated by out-of-scope contract behavior or a privileged actor with no unprivileged amplifier. These are not false positives — they are high-signal leads for manual review._

- **Cross-user dust attribution in `depositFor`/`withdrawFor`** — `CreatorOVaultWrapper.depositFor` / `withdrawFor` — Code smells: dust is banked against `accountingUser` (the attributed beneficiary) while mint/burn/redemption flows to `msg.sender` (the operator); a beneficiary-operator can attribute deposits/withdrawals to a victim while sweeping the victim's accumulated sub-1000-vault-share dust into their own position. Raised independently by 4 of 12 depth agents (the strongest lead-level convergence in this review) plus a breadth-phase lead. Not promoted to a Finding: the harm requires the owner-granted `isBeneficiaryOperator` role acting against its own attributed user's interest, and no unprivileged amplifier was identified — magnitude is bounded to sub-1-ShareOFT-equivalent per victim regardless. Worth a design review of whether dust should instead be sourced from `burnFrom`/credited to `mintTo`.
- **Residual gauge approval / unpulled fee tokens on a successful-but-partial `receiveFees` pull** — `CreatorShareOFT._sendFeesToGauge` — Code smells: the self-approval to `gaugeController` is zeroed only on the revert branch (`:759`); a gauge that pulls less than the approved amount without reverting would leave both a stale non-zero approval and un-pulled ShareOFT untracked by `pendingFees`. Raised by breadth (general) and 3 depth agents. Entirely contingent on `ITradeFeeCollector4626` (out of scope) behaving non-standardly — a plain `transferFrom`-based pull would not trigger this.
- **OFT message-type / recipient-address collision at the custom message dispatch boundary** — `CreatorShareOFT._lzReceive` / `_isRemoteLotteryEntryMessage` / `_isWinnerCallbackMessage` — Code smells: a bridged OFT transfer to a recipient address ≤ `0xFFFF` whose low 16 bits collide with a custom `MSG_TYPE` value could be misclassified and dropped instead of credited. Raised by 1 depth agent (periphery). Bounded to self-harm on effectively-unusable recipient addresses (any real address makes the upper bits of the first ABI word nonzero, which the guard already rejects) — included for completeness, not actionable risk.

---

## Access-Control Inventory (summary)

Full function-by-function table (all ~63 external/public entrypoints across both contracts, with guard, caller, state-written, and value-moved columns) was built in phase 0 and used to drive both hunting phases; reproduced in condensed form here for the client.

**Roles**: `owner` (single-step `Ownable`, both contracts) — full admin surface (Findings 4, 5, 12, 13). `REMOTE_PROTOCOL_WIRE_AUTHORITY` (hardcoded constant, ShareOFT only) — co-equal peer-wiring authority off-Base (Finding 5). `vault` / `isMinter` mapping — trusted mint/burn callers on ShareOFT. `wrapper` — ShareOFT's registered minter (Finding 4). Wrapper's `shareOFT` — one-shot, confirmed non-bypassable (Finding 13). `isWhitelisted` / `isBeneficiaryOperator` (Wrapper, owner-granted) — fee and cooldown exemption (Finding 12), third-party deposit/withdraw attribution (Lead: dust attribution).

**Permissionless entrypoints** (no role, economic gating only): `flushPendingFeesToGauge`, `flushFees` (Findings 7, 8), `submitPendingLotteryEntry` (caller must own the entry — confirmed sound), `transfer`/`transferFrom` (buy-fee logic — confirmed sound), `deposit`/`deposit(uint256)`/`wrap` (Finding 6), `withdraw`/`unwrap` (subject to Finding 3's cooldown-griefing).

## Threat Model (summary)

| Actor | Reach | Addressed by |
|---|---|---|
| LZ peer / spoofed winner-callback sender | `_lzReceive` branch 2 admission/handling mismatch | **Finding 1** |
| Arbitrary caller (any address, no deposit) | `propagateCooldownOnTransfer` via dust transfer | **Finding 3** |
| Owner | Re-point `vault`/`wrapper`/`minter` | **Finding 4** |
| `REMOTE_PROTOCOL_WIRE_AUTHORITY` (off-Base) | `setPeer`/`setHubConfig`/`setHubLotteryPeer` | **Finding 5** |
| Any depositor | Fee-on-transfer `creatorCoin` assumption | **Finding 6** |
| Arbitrary caller | `flushFees` permissionless send | **Findings 7, 8** |
| Hub LotteryManager4626 (out of scope) | Forwarded remote lottery entries, no in-file sender check | Invariant holds — authenticated upstream by inherited `OAppReceiver.lzReceive` peer enforcement; confirmed by 6+ independent agents across both phases |
| Any user | Wrap/unwrap fee-timing "asymmetry" in `totalLocked` | Invariant holds — traced numerically by 10+ independent agents across both phases; `totalLocked == totalMinted*1000 + totalUserDustShares` holds exactly on every path, no drift found under any fee configuration |

---

> ⚠️ This review was performed by an AI-driven three-phase audit pipeline (context mapping → breadth checklist review → depth attacker-mindset review → hybrid reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human security review, a public bug bounty program, and on-chain monitoring are strongly recommended before or alongside mainnet deployment at scale, particularly given Findings 1-5 involve cross-chain trust boundaries and owner-key centralization risk.
