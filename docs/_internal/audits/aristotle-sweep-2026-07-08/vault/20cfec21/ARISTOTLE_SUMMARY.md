# Summary of changes for run 041fed94-aef8-4999-9ff0-7a2b29262770
Completed a focused security audit of the Creator ShareOFT / Wrapper subsystem (token accounting, fee logic, lottery hooks), written to `SECURITY_AUDIT.md`. I reviewed `CreatorShareOFT.sol` and `CreatorOVaultWrapper.sol` in full, plus the interaction points in `CreatorOVault.sol`/`modules/CreatorOVaultCoreModule.sol` (mint/burn authority, `receiveFees`, decimals offset, share-transfer cooldown). The broader vault/strategy/impairment engine was treated as a separate subsystem and not audited.

Findings with concrete exploit paths and remediations:

HIGH
- H-1: `flushFees()` (permissionless remote fee-bridge) bridges via OFT `_send`, which debits `msg.sender` rather than `address(this)` where the accumulated fee tokens actually sit. A direct call zeroes `pendingFees`/bumps `totalFeesFlushed` while the real fee tokens stay stranded at the contract with no accounting pointer and no sweep function — orphaning protocol fees and letting a caller burn their own tokens. Only the hub-command self-call path works by accident. Fix: always debit the contract's own balance (self-call-only, override debit source, or pre-move tokens to msg.sender before `_send`), and add a reconcile/sweep.

MEDIUM
- M-1: The remote winner-callback branch is unreachable because LayerZero's peer check (`_origin.sender == peers[srcEid]`) conflicts with requiring `_origin.sender == hubLotteryPeer` (LotteryManager); `peers[hubEid]` must be the hub ShareOFT for OFT/flush. Winner notifications never fire and the H-14 dedup is dead code. Fix: separate OApp receiver or relay callbacks through the hub ShareOFT peer.
- M-2: Wrapper cooldown hook (`propagateCooldownOnTransfer`) lets an attacker push their fresh deposit block onto a victim via 1-wei ShareOFT transfers, repeatably blocking the victim's `withdraw`/`unwrap` for gas-only cost. Fix: don't let inbound transfers from arbitrary senders raise the recipient's cooldown (mirror the vault's anti-dust stance).
- M-3: Remote lottery entries recompute `balanceOf(buyer)` at submit time, so the buyer can inflate the "coverage" value reported to the hub between queue and submit. Fix: snapshot at queue time.

LOW/INFO: hub lottery-entry forward lacks try/catch (LZ lane stall); buy-fee bypass if a router is mis-classified `NoFees`; `withdrawFor` consumes beneficiary dust but pays the operator; stale NoFees flag/self-approval on gauge rotation; approximate `quoteFlushFees` payload. The report also lists items checked and found sound (CEI/reentrancy in `_processBuy`, burn allowance, message-discriminator collision resistance, dust invariant, isolated `_update` hook).

The report is committed and pushed.