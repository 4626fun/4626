# Security Audit — Creator ShareOFT / Wrapper subsystem

**Scope (as requested):** the token‑accounting, fee‑logic, and lottery‑hook surface of the
omnichain share subsystem. Files reviewed in depth:

- `CreatorShareOFT.sol` — the LayerZero OFT receipt token (buy fee, fee routing, lottery hook, cross‑chain messaging).
- `CreatorOVaultWrapper.sol` — Creator Coin ↔ ShareOFT wrapper (normalization/dust accounting, wrapper cooldown hook).
- `CreatorOVault.sol` / `modules/CreatorOVaultCoreModule.sol` — reviewed only at the interaction points that touch the above (mint/burn authority, `receiveFees`, decimals offset, share‑transfer cooldown). The full vault/strategy/impairment engine was treated as a separate subsystem and not audited here.

The reviewed sources already carry many prior‑audit fix markers (H‑*, M‑*, L‑*). The findings below are issues that are **still present** in the current code.

Severity uses standard impact×likelihood. "Exploit path" is concrete; "Remediation" is the minimal fix.

---

## HIGH

### H‑1 — `flushFees()` burns the caller's tokens, not the accumulated fees; orphans protocol fees and corrupts accounting

**Location:** `CreatorShareOFT.sol :: flushFees(SendParam, MessagingFee)` (the permissionless remote fee‑bridge path).

**Root cause.** On a remote chain the buy fee is physically moved to the token contract itself in `_processBuy`:

```solidity
_transfer(from, address(this), feeAmount);   // fee tokens now held at address(this)
...
_routeFees(feeAmount);                        // remote: pendingFees += feeAmount
```

`flushFees` is then supposed to bridge those held tokens to the hub. But it bridges via the OFT machinery:

```solidity
uint256 amount = pendingFees;
pendingFees = 0;
totalFeesFlushed += amount;
require(_sendParam.amountLD == amount, "Amount mismatch");
_send(_sendParam, _fee, payable(msg.sender));   // OFTCore._send → _debit(msg.sender, amount, ...)
```

LayerZero's `OFTCore._send` debits **`msg.sender`**, not `address(this)`. `flushFees` is documented and coded as *permissionless* ("anyone can trigger this (keeper, user, protocol)"), so `msg.sender` is an arbitrary external caller. The function therefore burns/bridges the **caller's** ShareOFT while the actual accumulated fee tokens sitting at `address(this)` are never touched — yet `pendingFees` is zeroed and `totalFeesFlushed` is incremented.

Only the hub‑commanded path works by accident: `_handleRemoteFeeFlushCommand()` invokes `this.flushFees{value:…}(…)` as an **external self‑call**, so there `msg.sender == address(this)` and `_debit(address(this), …)` correctly spends the held fees.

**Exploit / failure path.**
1. Buy fees accumulate on a remote spoke: `pendingFees = N`, and `N` ShareOFT sit at `address(this)`.
2. Anyone holding ≥ `N` ShareOFT calls `flushFees(buildFlushSendParam(), quote)` directly (not via the hub command).
3. `_debit` burns `N` from the caller and bridges it to `hubGaugeReceiver`; `pendingFees` is set to `0`, `totalFeesFlushed += N`.
4. The `N` real fee tokens remain stranded at `address(this)` with **no accounting pointer** (`pendingFees == 0`), so the working hub‑command path now skips them (`pendingFees < flushThreshold`). There is no ShareOFT sweep function (only `withdrawETH`), so those tokens are effectively orphaned.

Impact: a permissionless, documented entry point corrupts fee accounting and permanently strands the accumulated protocol fees on every remote chain. A naive keeper calling the advertised function also silently loses its own tokens. (It is not directly *profitable* theft — the attacker's burned tokens do reach the gauge — but it is a griefing + fund‑stranding + accounting‑integrity break with 1:1 attacker cost.)

**Remediation.** The remote fee flush must always debit the contract's own balance. Options:
- Make `flushFees` internal and expose only a wrapper that self‑calls (`this.flushFees{...}`), or
- Override so the debit source is `address(this)` (e.g. a dedicated `_debitFrom(address(this), …)` path), or
- Have `flushFees` `_transfer(address(this), msg.sender, amount)` immediately before `_send` so the OFT `_debit(msg.sender)` consumes the just‑moved fee tokens (and refund on revert). 

Also add a guarded ShareOFT sweep/reconcile function so any already‑orphaned balance can be recovered, and reconcile `pendingFees` against `balanceOf(address(this))`.

---

## MEDIUM

### M‑1 — Remote winner‑callback path is unreachable due to a LayerZero peer conflict (H‑14 dedup is dead code)

**Location:** `CreatorShareOFT.sol :: _lzReceive`, `_isWinnerCallbackMessage`, `_handleWinnerCallback`, `setHubLotteryPeer`.

LayerZero's `OAppReceiver.lzReceive` enforces `_origin.sender == peers[_origin.srcEid]` **before** dispatching to `_lzReceive`. On a remote spoke:

- `peers[hubEid]` **must** be the hub **ShareOFT** — it is required for inbound OFT token transfers from the hub and is explicitly asserted for the flush command (`_isRemoteFeeFlushCommand` requires `_origin.sender == peers[hubEid]`).
- A winner callback, however, is emitted by the hub **LotteryManager**, and `_isWinnerCallbackMessage`/`_handleWinnerCallback` require `_origin.sender == hubLotteryPeer` (the LotteryManager, as it must be — on the hub the same `hubLotteryPeer` is used as the `mgr` for `receiveRemoteLotteryEntry`).

A single `srcEid` can have exactly one peer. So either `peers[hubEid]` = hub ShareOFT (OFT/flush work, **winner callbacks are rejected at the OApp peer check**) or `peers[hubEid]` = LotteryManager (winner callbacks pass but OFT token transfers and flush commands from the hub break). In any correct multi‑purpose configuration the winner‑callback branch — including the H‑14 `usedReportIds[_guid]` dedup — is unreachable, so cross‑chain winner **notifications never fire**.

**Exploit / failure path.** Users who win the lottery from a remote chain never receive `LotteryWinnerNotification` on their chain; any indexer/UX depending on it silently breaks. No direct fund loss, but a core advertised feature is non‑functional and the dedup mitigation gives false assurance.

**Remediation.** Route custom lottery messages through a dedicated OApp receiver separate from the OFT (the code comment already contemplates this), or have the hub relay winner callbacks *through the hub ShareOFT* (so `_origin.sender == peers[hubEid]`) and compare against that peer rather than `hubLotteryPeer` on the receiving side.

### M‑2 — Wrapper cooldown hook lets an attacker grief a victim's withdrawals via dust transfers

**Location:** `CreatorOVaultWrapper.sol :: propagateCooldownOnTransfer`, `_requireWrapperCooldown`; `CreatorShareOFT.sol :: _update`.

`propagateCooldownOnTransfer` pushes `lastWrapperDepositBlock[from]` forward onto `to` on every ShareOFT transfer (max‑propagator). `_requireWrapperCooldown` blocks `withdraw`/`unwrap` while `block.number < lastWrapperDepositBlock[user] + wrapperWithdrawDelayBlocks`.

**Exploit path.**
1. Attacker deposits into the wrapper in block `B` → `lastWrapperDepositBlock[attacker] = B`.
2. In block `B` the attacker sends 1 wei of ShareOFT to the victim. The `_update` hook propagates `B` onto the victim → `lastWrapperDepositBlock[victim] = B`.
3. The victim now cannot `withdraw`/`unwrap` until block `B + wrapperWithdrawDelayBlocks`.
4. Repeating each block (attacker re‑deposits to refresh its own block, then dusts the victim) sustains a targeted denial of the victim's wrapper withdrawals. The attacker's deposits are recoverable, so the sustained cost is essentially gas.

`wrapperWithdrawDelayBlocks` is fixed at `1` (no setter), which bounds the per‑hit window, but the griefing is repeatable and cheap against a chosen target. Whitelisted / beneficiary‑operator users are exempt.

**Remediation.** Do not let an *inbound* transfer raise the recipient's cooldown from an arbitrary sender. Prefer recording the cooldown only on the actual wrapper deposit/withdraw of the acting account (as the vault's own `_update` deliberately does — it explicitly does **not** inherit cooldown on transfer "to prevent griefing via dust transfers"). If forward propagation is required for the flash‑loan property, gate it so only transfers *from the wrapper itself* (or above a meaningful threshold) propagate, mirroring the vault's stance.

### M‑3 — Remote lottery entry uses `balanceOf(buyer)` at submit time, allowing coverage inflation between queue and submit

**Location:** `CreatorShareOFT.sol :: _prepareLotteryEntryMessage` / `submitPendingLotteryEntry`.

A remote buy queues `PendingLotteryEntry{buyer, amount}`. When the buyer later calls `submitPendingLotteryEntry`, the outbound payload recomputes `buyerCurrentShareBalance = balanceOf(buyer)` (the "coverage input on the hub lottery manager"). The buyer fully controls the gap between queue and submit and can inflate their ShareOFT balance (buy more, or receive transfers) right before submitting to maximize the coverage value reported to the hub `LotteryManager4626`.

**Exploit path.** Buyer buys once (queues entry with small `amount`), acquires a large transient ShareOFT balance, submits the entry so the hub sees a large `buyerCurrentShareBalance`, then disposes of the balance. Whether this yields extra prize coverage/entries depends on `LotteryManager4626` logic (outside this subsystem), so severity is capped here, but the input is attacker‑timed and should be treated as untrusted.

**Remediation.** Snapshot the coverage‑relevant balance at *queue* time (store it in `PendingLotteryEntry`) and send that immutable value, rather than reading live balance at submit time; and/or have the hub manager derive coverage from authenticated state rather than a caller‑supplied number.

---

## LOW / INFORMATIONAL

### L‑1 — Hub lottery‑entry forwarding is not wrapped in try/catch (LZ lane stall)
`_lzReceive` forwards remote lottery entries with `ILotteryManager4626(mgr).receiveRemoteLotteryEntry(...)` and no try/catch. If the manager reverts (paused, bad state), the entire `lzReceive` reverts and that lane's message is stuck/blocked until retried, unlike the hub‑local path which deliberately swallows lottery failures ("Lottery failure should not block the transfer"). Consider wrapping the forward in try/catch and emitting a failure event so a misbehaving manager cannot wedge the OFT receive lane.

### L‑2 — Buy fee can be bypassed by routing through a `NoFees` address (config surface)
`_transferWithFees` charges only on `SwapOnly → non‑SwapOnly` and short‑circuits whenever either side is `NoFees`. Any hop `SwapOnly → NoFees → user` pays no fee. This is correct for vault/wrapper/gauge, but if an aggregator/router is ever mis‑classified as `NoFees` (instead of `SwapOnly`), all buys routed through it escape the 6.9% fee. Treat `NoFees` as a highly privileged classification; document that routers/aggregators must be `SwapOnly`, and consider an event‑monitored allowlist review.

### L‑3 — `withdrawFor` consumes the beneficiary's dust but pays the operator
`_unwrapInternal(amount, beneficiary, msg.sender)` clears `userDustShares[beneficiary]` and includes it in `vaultSharesBeforeFee`, but the redeemed Creator Coin goes to `msg.sender` (the operator). An operator thus captures up to <1 normalized share of the beneficiary's accumulated dust per call. `isBeneficiaryOperator` is owner‑gated (trusted), so impact is low, but the credit/debit asymmetry (`depositFor` credits the beneficiary, `withdrawFor` spends the beneficiary but pays the operator) is worth correcting for accounting hygiene.

### L‑4 — Stale gauge/self‑approval and NoFees flag on `setGaugeController` replacement
`setGaugeController`/`setVault` set the new address to `NoFees` but never revoke the previous controller's `NoFees` classification, and `_sendFeesToGauge` does not zero a residual self‑approval on the *success* path (only on the catch path, per M‑03). A replaced/decommissioned controller retains fee exemption and any leftover allowance. Clear the old classification and reset allowances on rotation.

### I‑1 — `quoteFlushFees` quotes an approximate payload
`quoteFlushFees` builds a stand‑in payload (`bytes32(receiver) ++ uint64(pendingFees)`) purely for fee estimation. It is not the exact message shape sent by `_send`, so the quote can be slightly off; `_handleRemoteFeeFlushCommand` relies on it to size the native drop. Ensure the executor native drop carries adequate buffer (it appears to), and prefer quoting the real `SendParam`.

---

## Notes on things checked and found OK
- `_processBuy` uses OZ internal `_transfer` for both fee and net legs (no recursive fee), follows CEI, and is `nonReentrant`.
- `burn` now requires allowance for non‑vault callers (H‑3/L‑1 fixes present and correct).
- Winner‑callback and remote‑lottery message discriminators (`_isWinnerCallbackMessage`, `_isRemoteLotteryEntryMessage`) are well‑guarded against colliding with packed OFT payloads (length + high‑bit checks); a normal transfer's first word is the recipient address, whose `>> 16` is non‑zero, so misclassification is infeasible.
- Wrapper `_wrapInternal`/`_unwrapInternal` dust bookkeeping preserves the `totalLocked == totalMinted*1000 + totalUserDustShares` invariant across the flows tested; `emergencyWithdraw` only releases balance above required backing.
- The `_update` wrapper hook is `try/catch`‑isolated and skips mints/burns/self‑transfers, so a reverting hook cannot freeze transfers.
