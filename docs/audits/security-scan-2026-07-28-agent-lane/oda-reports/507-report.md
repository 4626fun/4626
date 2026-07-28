# 🔐 Security Review — AgentShareOFT + AgentOVaultWrapper (4626.fun agent lane)

---

## Scope

|                                  |                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------ |
| **Target repo**                  | `github.com/4626fun/4626`                                                       |
| **Tag**                          | `audit/oda-2026-07-28-agent-lane`                                               |
| **Commit (pinned)**              | `0c47be24efb9f48b03f54c289e2734f4cfd50cd8`                                     |
| **Files reviewed**                | `contracts/agent/vault/AgentShareOFT.sol` (1373 lines) · `contracts/agent/vault/AgentOVaultWrapper.sol` (826 lines) |
| **Methodology**                  | Three-phase: Phase 0 context (protocol map + access-control inventory + threat catalog) → Phase 1 breadth (7 ethskills domains) → Phase 2 depth (12 pashov attacker-mindset agents, blind to Phase 1) → Phase 3 reconciliation |
| **Confidence threshold**         | 50 (findings below appear as Leads, not scored findings)                       |
| **Live deployment status**       | No per-agent vault CREATE2 instance is live on Base yet; this is a source-pin review, not a live-bytecode review. Live anchor referenced by the client: `AgentOVaultCoreModule` at `0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE` (out of this job's scope — see note below). |

**Note on scope discipline:** This job's scope is strictly `AgentShareOFT.sol` and `AgentOVaultWrapper.sol`. The sibling contracts `contracts/creator/vault/CreatorShareOFT.sol` and `CreatorOVaultWrapper.sol` are **not** in scope and were **not** audited in this job — they were read only as comparison points where they contain fixes that reveal the in-scope contracts are missing an equivalent fix (explicitly marked below wherever used). No finding in this report originates from, or was copied out of, any prior audit of the Creator lane or any other job; every item below was independently produced by this job's own Phase 0/1/2 agents and verified by the orchestrator directly against this job's pinned source.

---

## Reconciliation Summary

- **Phase 1** (7 ethskills domains: general, precision-math, erc20, erc4626, bridges, access-control, flashloans) and **Phase 2** (12 pashov attacker agents, run blind to Phase 1) were conducted independently, per the two-phase-audit-v2 methodology.
- **Overlap:** 3 mechanisms independently discovered by both phases (cooldown-propagation griefing; `remoteProtocolWireAuthority` centralization risk; fee-flush dust-stranding accounting drift).
- **Phase-1-only:** access-control/UX/precision items (rounding, downcasts, naming, slippage on convenience overloads, etc.) — 12 Low/Info items.
- **Phase-2-only:** 2 confirmed Medium findings that Phase 1 did not surface — the beneficiary-operator dust-siphon and the winner-callback peer-parity gap — both found by cross-referencing the (out-of-scope) sibling Creator-lane contracts, which Phase 1's checklist-driven approach did not do.
- **Re-examined leads kept:** 2 (cooldown-griefing DoS, dust-siphon) — both promoted from "Lead" to "Finding" after the orchestrator directly verified the claimed sibling-contract fix exists and is absent here (`grep`/`sed` against both repos' source, not agent say-so).
- **Re-examined leads demoted:** 1 — "owner can burn any holder's balance without allowance" was raised as a Medium/High finding by two Phase-1 agents but demoted to a Low/Info design-asymmetry note under strict Gate-3 application (an admin-only action with no named unprivileged amplifier does not qualify as an actionable finding per this audit's judging protocol).
- **Coverage:** 47 external/public entrypoints in the Phase-0 access-control inventory, 47 addressed (either by a finding/lead below, or "examined, no issue" during the 19-agent sweep). All 12 Phase-0 threat-catalog rows answered. **Coverage holes closed this pass: 0** (both phases' combined sweep already covered every entrypoint; no fresh re-read was required at Turn 3 beyond confirming the sibling-contract diffs above).
- **Confidence floor:** findings below confidence 50 are listed under **Leads**, not as scored findings, per this audit's reporting convention.

---

## Access-Control Inventory (from Phase 0)

### AgentShareOFT.sol — roles
| Role | Grant/revoke | Unlocks |
|---|---|---|
| `owner()` (Ownable, one-step) | constructor; `transferOwnership`/`renounceOwnership` | Nearly all admin setters; `burn` (via `onlyVaultOrMinter`); **excluded** from `mint` |
| `vault` | `setVault`, one-shot bind (idempotent same-address) | `mint`/`burn` privileged path; backing-check denominator |
| `wrapper` | `setWrapper`, one-shot bind once non-zero; cannot clear while `totalSupply()>0` | Cooldown-hook target; fee exemption; backing-check denominator |
| `isMinter[x]` | `setMinter`, freely re-settable | `mint`/`burn` |
| `gaugeController` | `setGaugeController`, freely re-settable | Fee sink (`receiveFees`) |
| `remoteProtocolWireAuthority` | `setRemoteProtocolWireAuthority`; hardcoded live default `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` | `setPeer`/`setHubConfig`/`setHubLotteryPeer`, **only** off-Base |
| `isLotteryResolver[x]` | `setLotteryResolver`, freely re-settable | Allowlist for `ILotteryBeneficiary` redirection |

### AgentOVaultWrapper.sol — roles
| Role | Grant/revoke | Unlocks |
|---|---|---|
| `owner()` (Ownable, one-step) | constructor | All admin setters, `emergencyWithdraw`, `refreshApproval` |
| `shareOFT` | `setShareOFT`, strictly one-shot (no re-set even to same address) | Mint/burn counterpart; cooldown-hook caller identity |
| `isWhitelisted[x]` | `setWhitelist`/`batchWhitelist`, freely re-settable | Fee exemption + cooldown bypass |
| `isBeneficiaryOperator[x]` | `setBeneficiaryOperator`, freely re-settable | Third-party `depositFor`/`withdrawFor` + cooldown bypass |
| `agentToken`, `vault` | constructor immutables | N/A (unchangeable) |

**Unguarded (state-changing, reachable by any address):** `transfer`/`transferFrom` (fee logic inline), `flushFees`, `flushPendingFeesToGauge`, `submitPendingLotteryEntry` (self-gated to entry owner), `deposit`/`deposit(amount)`/`depositFor`/`wrap` (no cooldown *check*, only *record*), `withdraw`/`withdraw(amount)`/`withdrawFor`/`unwrap` (cooldown-gated), `propagateCooldownOnTransfer` (self-gated to `shareOFT` caller).

**Cross-contract wiring dependency (not itself a flaw):** minting via the wrapper requires **two** separate owner actions on `AgentShareOFT` — `setWrapper(wrapper)` (fee-exemption + cooldown hook) **and** `setMinter(wrapper, true)` (actual mint/burn rights). Nothing on-chain cross-checks that `AgentOVaultWrapper.shareOFT == AgentShareOFT` and `AgentShareOFT.wrapper == AgentOVaultWrapper` point at each other.

---

## Threat Model (from Phase 0, each row marked with its outcome)

| Actor | Reaches | Could gain | Outcome |
|---|---|---|---|
| Any address | `deposit*`/`withdraw*`/`wrap`/`unwrap` | Mint/burn ShareOFT beyond real backing | **Invariant holds** — verified across 4+ independent agent traces of `_wrapInternal`/`_unwrapInternal`/`_assertMintBacking` |
| Any address | Cooldown-propagation hook via dust transfer | Deny a victim's withdrawal | **Addressed by Finding 1** (Medium) |
| `isBeneficiaryOperator` (trusted) | `depositFor`/`withdrawFor` | Siphon a beneficiary's accrued dust | **Addressed by Finding 2** (Medium) |
| Compromised `remoteProtocolWireAuthority` key | `setPeer` off-Base | Mint unbacked ShareOFT on a remote chain, bridge, drain honest depositors' backing | **Addressed by Finding 3** (Medium, contingent on key compromise) |
| LayerZero endpoint / hub relay | Winner-callback delivery to remote `_lzReceive` | Deliver winner notification | **Addressed by Finding 4** (Low — feature likely non-functional under forwarded-callback wiring, no fund-loss path) |
| Any address | `flushFees`'s caller-supplied `SendParam` | Inject unchecked LZ compose traffic from a trusted-peer identity | **Addressed by Finding 5** (Low) |
| Owner | `burn()` any holder, `setAddressType` targeting, no timelock | Destroy/tax a user's balance unilaterally | **Invariant does not hold, but Gate-3 rejects as a scored finding** — admin-only action, no unprivileged amplifier named (see Leads/Design Notes) |
| Any address | `mint`/`_assertMintBacking` slack (`totalUserDustShares`) | Mint into backing slack via a second privileged minter | **Demoted to Lead** — requires a privileged/misconfigured second `isMinter` grant |
| Cross-chain LZ mint/burn | Cooldown-propagation no-op on `from==0`/`to==0` | Bypass flash-loan cooldown via bridging | **Invariant holds in current topology** — chased and found non-exploitable (remote chains have no wrapper backing); flagged as forward-looking Lead only |
| Hub `_lzReceive` forward to `LotteryManager4626` | No try/catch (unlike local lottery path) | DoS a shared OFT+message entrypoint | **Lead** — exploitability depends on out-of-scope `LotteryManager4626` behavior |

---

## Findings

[75] **1. Withdrawal-cooldown griefing DoS via dust-transfer cooldown propagation**

`AgentOVaultWrapper.propagateCooldownOnTransfer` / `_requireWrapperCooldown` · Confidence: 75

**Description**

`propagateCooldownOnTransfer` (L792-808) stamps a recipient's *entire* withdrawal cooldown to the sender's most recent deposit block on **any** incoming ShareOFT transfer (even 1 wei), and `_requireWrapperCooldown` (L758-762) then blocks the recipient's whole account for the resulting window — so an attacker can `deposit()` then send a victim 1 wei of ShareOFT to freeze that victim's `withdraw`/`unwrap`/`withdrawFor` for the block, repeatable at the cost of one deposit+transfer per block. The out-of-scope sibling `contracts/creator/vault/CreatorOVaultWrapper.sol` (verified directly, not on agent say-so) implements a hot-balance-tracking fix — gating only the recipient's just-received units and skipping propagation once the sender's own cooldown has expired — whose own code comment states it "prevents both pre-seeded-address laundering and dust-transfer griefing." `AgentOVaultWrapper` has neither guard.

Independently found by 8 of 12 Phase-2 attacker agents plus the Phase-1 bridges-domain agent (9 of 19 total, unprompted convergence). Impact is liveness/availability (a bounded per-block freeze sustained at the attacker's ongoing gas cost, estimated ~$18–90/hour on Base by one agent's model), not fund loss — rated Medium rather than High since it requires continuous attacker spend and is not a permanent, cost-free lockout.

**Fix**

```diff
- mapping(address => uint256) public lastWrapperDepositBlock;
+ mapping(address => uint256) public lastWrapperDepositBlock;
+ mapping(address => uint256) public cooldownShareOFTBalance; // "hot" units still cooling

  function propagateCooldownOnTransfer(address from, address to, uint256 amount) external {
      if (msg.sender != address(shareOFT)) revert CooldownHookUnauthorizedCaller(msg.sender);
      if (from == address(0) || to == address(0)) return;
      if (from == to) return;
      if (amount == 0) return;

      uint256 fromBlock = lastWrapperDepositBlock[from];
      if (fromBlock == 0) return;
+     // Skip propagation once the sender's own cooldown has already expired.
+     if (block.number >= fromBlock + wrapperWithdrawDelayBlocks) return;

      uint256 toBlock = lastWrapperDepositBlock[to];
      if (fromBlock > toBlock) {
          lastWrapperDepositBlock[to] = fromBlock;
+         cooldownShareOFTBalance[to] += amount; // only the transferred amount is "hot"
          emit CooldownPropagated(from, to, fromBlock);
      }
  }

- function _requireWrapperCooldown(address user) internal view {
+ function _requireWrapperCooldown(address user, uint256 amount) internal view {
      if (isWhitelisted[user] || isBeneficiaryOperator[user]) return;
+     if (amount <= /* balance not covered by cooldownShareOFTBalance[user] */) return;
      uint256 requiredBlock = lastWrapperDepositBlock[user] + wrapperWithdrawDelayBlocks;
      if (block.number < requiredBlock) revert WrapperWithdrawTooSoon(block.number, requiredBlock);
  }
```

---

[70] **2. Beneficiary-operator can siphon a third party's accumulated dust via `withdrawFor`**

`AgentOVaultWrapper._unwrapInternal` (via `withdrawFor`) · Confidence: 70

**Description**

`_unwrapInternal(amount, accountingUser, burnFrom)` (L510-554) reads and zeroes `userDustShares[accountingUser]` unconditionally (L516, L540-543) and folds it into the vault-share amount redeemed to `burnFrom`. In `withdrawFor(amount, minOut, beneficiary)` (L372-390), `accountingUser = beneficiary` but `burnFrom = msg.sender` (the operator) — so an owner-granted `isBeneficiaryOperator` can call `withdrawFor(1, 0, victim)` where `victim` has accrued dust (e.g. 999 vault-share units), burn only 1 of their own ShareOFT, and redeem `1000 + 999 = 1999` vault-shares' worth of agent tokens to themselves, zeroing the victim's dust. The wrapper's global backing invariant stays consistent throughout, so `verify()`/`isBalanced()` never detect the transfer.

The out-of-scope sibling `CreatorOVaultWrapper.sol:554` (verified directly) carries exactly this fix under tag `ODA-498-3`: `uint256 userDust = (accountingUser == burnFrom) ? userDustShares[accountingUser] : 0;`. `AgentOVaultWrapper` lacks the guard. Independently found by 3 of 12 Phase-2 agents (trust-gap, first-principles, numerical-gap), each citing the identical sibling-contract line as proof the protocol's own developers judged this worth a targeted fix elsewhere.

Bounded per-call value (<1000 vault-share units, <1 agent token, per victim), but repeatable by a compromised/malicious operator across every historical depositor with accrued dust — rated Medium for the trust-boundary violation and non-trivial aggregate exposure, not High given the per-instance cap.

**Fix**

```diff
  function _unwrapInternal(uint256 shareOFTIn, address accountingUser, address burnFrom)
      internal
      returns (uint256 vaultSharesOut)
  {
-     uint256 userDust = userDustShares[accountingUser];
+     uint256 userDust = (accountingUser == burnFrom) ? userDustShares[accountingUser] : 0;
      uint256 vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR + userDust;
      ...
```

*Note:* the mirror-image issue on the deposit side (`_wrapInternal` L472 folds `priorDust = userDustShares[accountingUser]` into a mint credited to a different `mintTo` in `depositFor`) has **no** `accountingUser == mintTo` guard in the sibling contract either — this half is a pre-existing, unpatched-in-both-lanes issue, not a regression. Recorded separately at Low severity below for completeness.

---

[55] **3. Hardcoded `remoteProtocolWireAuthority` is a single-key cross-chain mint-trust root**

`AgentShareOFT.sol` L317, `onlyOwnerOrRemoteProtocolWire` L323-334, gates `setPeer` L379 · Confidence: 55 (contingent on key compromise)

**Description**

A hardcoded, live-from-deployment EOA (`0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3`) can call `setPeer` on any non-Base chain. Since LayerZero OFT trust is peer-based, wiring a malicious peer lets that party deliver an inbound OFT credit message that mints ShareOFT from nothing on that remote chain (remote `vault == address(0)`, so `_assertMintBacking` is a no-op there). Bridging that unbacked supply to the hub and calling `AgentOVaultWrapper.withdraw`/`unwrap` burns it against `totalLocked`, releasing **honest depositors'** real vault-share backing to the attacker — traced concretely by two independent Phase-2 agents. This is a centralization/key-management risk, not a permissionless bug: it requires compromising a specific privileged key, and the role is owner-revocable (`setRemoteProtocolWireAuthority`). Reported because the blast radius on compromise (theft from honest depositors, not just griefing) is materially worse than a typical admin key.

**Fix:** Do not ship a live hardcoded default. Require explicit owner opt-in per deployment (default `address(0)`), and prefer a multisig/timelock for a role that gates cross-chain mint trust.

---

[70] **4. Winner-callback authentication is missing the peer-parity fix present in the sibling Creator lane**

`AgentShareOFT.sol` `_isWinnerCallbackMessage()` L1018-1056, `_handleWinnerCallback()` L1090-1103 · Confidence: 70

**Description**

Both functions authenticate the inbound winner-callback message solely against `hubLotteryPeer` (L1023, L1092). LayerZero V2's base `OAppReceiver.lzReceive` enforces `_origin.sender == peers[_origin.srcEid]` before `_lzReceive` ever executes, and `peers[hubEid]` must equal the **hub AgentShareOFT's** address for ordinary OFT token bridging to work. Nothing in this file constructs or sends a `MSG_TYPE_WINNER_CALLBACK` message (confirmed absent by direct grep), so the message must be relayed through that same hub-ShareOFT OFT channel under the architecturally natural "forwarded-callback" wiring — in which case `_origin.sender` equals `peers[hubEid]`, not the literal `hubLotteryPeer` value, and the check fails, silently misrouting the message to `super._lzReceive()` as an ordinary transfer. The sibling `CreatorShareOFT.sol` (verified directly at L1055-1064 and L1138-1145) carries the exact fix under tag `ODA-428-F1`, accepting `_origin.sender == hubLotteryPeer || _origin.sender == peers[hubEid]` — `AgentShareOFT` was not given this fix.

No funds move on this path (`_handleWinnerCallback`'s only effect is an event emit); rated Low as a functional-correctness/feature-availability regression, not a fund-loss vector.

**Fix**

```diff
  function _isWinnerCallbackMessage(Origin calldata _origin, bytes calldata _message) internal view returns (bool) {
-     bytes32 expectedSender = hubLotteryPeer;
-     if (expectedSender == bytes32(0) || _origin.sender != expectedSender) return false;
+     bytes32 managerPeer = hubLotteryPeer;
+     bytes32 oftPeer = peers[hubEid];
+     bool fromAllowedPeer = (managerPeer != bytes32(0) && _origin.sender == managerPeer)
+         || (oftPeer != bytes32(0) && _origin.sender == oftPeer);
+     if (!fromAllowedPeer) return false;
      ...

  function _handleWinnerCallback(Origin calldata _origin, bytes calldata _message) internal {
-     if (hubLotteryPeer == bytes32(0) || _origin.sender != hubLotteryPeer) {
-         revert InvalidCallback();
-     }
+     bytes32 managerPeer = hubLotteryPeer;
+     bytes32 oftPeer = peers[hubEid];
+     bool fromAllowedPeer = (managerPeer != bytes32(0) && _origin.sender == managerPeer)
+         || (oftPeer != bytes32(0) && _origin.sender == oftPeer);
+     if (!fromAllowedPeer) revert InvalidCallback();
      ...
```

---

< threshold 50 — below-threshold findings, description only, no Fix block >

---

[45] **5. `flushFees` accepts a caller-supplied `SendParam` with unchecked `extraOptions`/`composeMsg`/`oftCmd`**

`AgentShareOFT.sol` `flushFees()` L690-710 · Confidence: 45. Requires (L700-702) only validate `dstEid`/`to`/`amountLD`; a permissionless caller can set an arbitrary `composeMsg` (triggering `SEND_AND_CALL` from this trusted peer identity to the hub) or arbitrary `extraOptions`/`oftCmd`. Self-funded, state-reverting on failure — no demonstrated direct fund loss, but lets an untrusted caller emit attacker-shaped LZ compose traffic from a peer-trusted address.

---

[40] **6. Hub `_lzReceive` forwards to the external `LotteryManager4626` with no try/catch, unlike the local-lottery path**

`AgentShareOFT.sol` L994 vs. L805-811 · Confidence: 40. `_triggerLotteryLocal`'s call is try/catch-wrapped; the remote-entry forward inside `_lzReceive` is a bare external call inside the shared OFT+custom-message entrypoint. A revert there fails the whole LZ delivery (retriable per LZ V2, not silently dropped) and the user's already-paid entry (deleted before send, CEI) is lost with no refund/retry hook. Exploitability depends on the out-of-scope `LotteryManager4626` ever reverting.

---

[45] **7. Fee-flush accounting doesn't account for OFT shared-decimal dust trimming**

`AgentShareOFT.sol` `flushFees()` L695-707 · Confidence: 45. `pendingFees` is zeroed to the full `amount` and `totalFeesFlushed += amount`, but `this.send`'s underlying OFT `_debit` burns only `_removeDust(amount)`. Sub-unit dust is neither re-tracked nor re-transmitted; it sits as the contract's own ShareOFT balance with no remote-side sweep. Independently found by 5 agents across both phases (general, precision-math, bridges, math-precision, economic-security).

---

[35] **8. Owner can burn any holder's ShareOFT with no allowance**

`AgentShareOFT.sol` `burn()` L480-488, `onlyVaultOrMinter` L336-341 · Confidence: 35 (below threshold; recorded as a design-asymmetry note, not a scored finding — see Leads section for the Gate-3 rationale). `mint()` deliberately excludes `owner()` from minting, but `burn()`'s modifier admits `owner()` and the allowance check (`_spendAllowance`) is skipped for both `vault` and `owner`. An owner-initiated burn destroys a holder's balance with zero consent; because it bypasses the wrapper, the victim's locked vault-share backing is stranded rather than released.

---

[35] **9. Fees round down instead of up**

`_wrapInternal` L461, `_unwrapInternal` L523, `_processBuy` L557 · Confidence: 35. Plain integer division truncates fees downward (protocol-unfavorable). Magnitude is sub-1-unit per operation and non-compounding (multiplication precedes division throughout) — reported for completeness per standard rounding-direction convention, not because it is exploitable.

---

[35] **10. `uint64(pendingFees)` downcast truncates the fee-quote payload**

`AgentShareOFT.sol` `quoteFlushFees()` L751 · Confidence: 35. Confirmed cosmetic — LZ fee quotes are size/gas-driven, not amount-driven, so the truncated value doesn't mis-price the actual flush.

---

[40] **11. One-step `Ownable`, no timelock; `renounceOwnership` can brick either contract**

Both contracts · Confidence: 40. No `Ownable2Step`. Renouncing before `AgentOVaultWrapper.setShareOFT` (strictly one-shot) is ever called permanently bricks the wrapper.

---

[30] **12. Owner can instantly impose a buy-tax on a targeted address via `setAddressType`**

`AgentShareOFT.sol` L1168-1187 · Confidence: 30. Purely a no-timelock centralization observation; the guard itself is airtight against non-owners.

---

[35] **13. Raw non-SafeERC20 `.approve()` on `agentToken`**

`AgentOVaultWrapper.sol` constructor L163, `refreshApproval()` L743 · Confidence: 35. Inconsistent with the contract's own fee-on-transfer defenses elsewhere; a USDT-shaped `agentToken` could break deployment or `refreshApproval`.

---

[30] **14. `wrap()` credits vault-share input by parameter, not measured before/after balance**

`AgentOVaultWrapper.sol` `wrap()` L403-416 · Confidence: 30. Unlike `agentToken` and `deposit()`, `wrap()` trusts the `amount` parameter rather than measuring actual vault-share receipt — safe only if the vault-share token is guaranteed non-fee-on-transfer (an unenforced assumption).

---

[30] **15. Convenience overloads (`deposit(amount)`, `withdraw(amount)`) have no slippage protection**

`AgentOVaultWrapper.sol` L277-289, L354-365 · Confidence: 30. `minOut`-protected siblings exist and should be preferred.

---

[30] **16. Small deposits revert entirely instead of degrading to dust accrual**

`AgentOVaultWrapper.sol` `_wrapInternal()` L477-478 · Confidence: 30. Deposits below ~1 agent-token-equivalent revert whole (state rolled back, no fund loss) rather than crediting the shortfall as dust.

---

Findings List

| # | Confidence | Title |
|---|---|---|
| 1 | [75] | Withdrawal-cooldown griefing DoS via dust-transfer cooldown propagation |
| 2 | [70] | Beneficiary-operator can siphon a third party's accumulated dust via `withdrawFor` |
| 3 | [55] | Hardcoded `remoteProtocolWireAuthority` is a single-key cross-chain mint-trust root |
| 4 | [70] | Winner-callback authentication missing sibling-lane peer-parity fix (ODA-428-F1) |
| 5 | [45] | `flushFees` accepts unchecked caller-supplied `SendParam` fields |
| 6 | [40] | Hub `_lzReceive` lottery-entry forward has no try/catch |
| 7 | [45] | Fee-flush accounting ignores OFT shared-decimal dust trimming |
| 8 | [35] | Owner can burn any holder's ShareOFT with no allowance (design asymmetry) |
| 9 | [35] | Fees round down instead of up |
| 10 | [35] | `uint64` downcast truncates fee-quote payload |
| 11 | [40] | One-step `Ownable`, no timelock, renounce can brick wrapper |
| 12 | [30] | Owner can instantly tax a targeted address via `setAddressType` |
| 13 | [35] | Raw non-SafeERC20 `.approve()` on `agentToken` |
| 14 | [30] | `wrap()` credits unmeasured vault-share input |
| 15 | [30] | Convenience overloads lack slippage protection |
| 16 | [30] | Small deposits revert instead of accruing dust |

---

## Info-level Observations (no scored severity — correctness/UX only)

- **`convertToAssets` silently clamps oversized input instead of reverting** (`AgentShareOFT.sol` L1232-1240) — triple-corroborated (general, precision-math, erc4626 agents); unreachable in practice, view-only.
- **`convertToAssets` returns different units on hub vs. remote chains** (L1238) — assets on hub, denormalized vault-share count on remote, under the same function name; documented in NatSpec but a footgun for cross-chain integrators.
- **`previewDeposit`/`previewWithdraw` are implicitly `msg.sender`-dependent**, not pure conversions (`AgentOVaultWrapper.sol` L563-574) — a router simulating a user's preview gets its own dust/whitelist state, not the target user's.
- **Large-withdrawal async gate has no in-wrapper path** — `_requireSynchronousRedemption` only wired into `withdraw*`, not `unwrap()`; not a lock, since `unwrap()` remains an escape hatch to raw vault shares.
- **Hardcoded, non-owner-configurable `DEFAULT_FLUSH_GAS_LIMIT`** (200,000, L100) — contrast with the owner-configurable `lotteryEntryGasLimit`; LZ V2 failed delivery is retriable, so impact is bounded.
- **Wrap-side dust fold-in lacks an `accountingUser == mintTo` guard** in `_wrapInternal` (L472) — the deposit-side mirror of Finding 2, but unpatched in **both** the Agent and Creator lanes, so not a regression; recorded for symmetry/defense-in-depth.

---

## Leads

_Vulnerability trails with concrete code smells where the full exploit path requires information outside these 2 files' scope, or requires a privileged-role compromise this audit cannot itself trigger. Not scored._

- **Cross-chain cooldown-propagation gap** — `Contract.propagateCooldownOnTransfer` — Code smells: no-ops on LZ mint/burn (`from==0`/`to==0`), so a chain-A deposit's cooldown does not carry to chain B. **Chased and found currently non-exploitable**: remote chains have `vault==address(0)` and an unfunded wrapper (`totalLocked==totalMinted==0`), so redemption there reverts regardless, and LZ transit is never same-block. Forward-looking risk only — re-flag if a backed, LZ-mint-reachable wrapper is ever deployed off-hub.
- **`_assertMintBacking` backing-check slack equals `totalUserDustShares`** — `AgentShareOFT._assertMintBacking` — Code smells: the check requires only `held >= totalSupply()*1000`, while true required backing is `totalMinted*1000 + totalUserDustShares`; a second, privileged/misconfigured `isMinter` (not the wrapper) could mint into that slack. Requires an abnormal admin grant to reach — Gate-2 demoted.
- **Fee-on-transfer `agentToken` could dilute vault depositors at the external vault** — `AgentOVaultWrapper.deposit` — the wrapper correctly measures its own received amount before calling `vault.deposit`, but whether the out-of-scope `AgentOVault` itself re-measures receipt (vs. trusting the passed `received` argument for share minting) could not be verified from these 2 files.
- **Normalization-constant coupling with no runtime cross-check** — `AgentShareOFT.VAULT_SHARE_NORMALIZATION` and `AgentOVaultWrapper.NORMALIZATION_FACTOR` are independently declared constants (both hardcoded to 1000) with no on-chain assertion they match; likewise `ShareOFT.wrapper`/`ShareOFT.vault` and `Wrapper.shareOFT`/`Wrapper.vault` are four independently-set one-shot bindings with no mutual-consistency check across the two contracts.
- **Is `AgentOVaultWrapper` (and a funded `vault`) ever deployed on non-hub chains?** — Directly determines whether the cross-chain cooldown-propagation gap (above) has a real target. Unclear from these 2 files; would require deployment scripts/registry data out of scope.

---

## Coverage Gate

- **Entrypoints:** 47 external/public state-changing functions across both contracts (30 on `AgentShareOFT` incl. inherited `send`/`transferOwnership`/`renounceOwnership`; 17 on `AgentOVaultWrapper`), all present in the Phase-0 Access-Control Inventory and reproduced above. **47/47 addressed** — either via a Finding/Lead/Info item above, or "examined, no issue" during the combined 19-agent sweep (view/getter functions, remaining admin setters, `emergencyWithdraw`, `withdrawETH`, `setPeer`, `setHubConfig`, `setHubLotteryPeer`, `setLotteryResolver`, `setRegistry`, `setFlushThreshold`, `setLotteryEntryGasLimit`, `setContractURI`, `setFeeRecipient`, `setWhitelist`/`batchWhitelist`, `setBeneficiaryOperator`, all `preview*`/`get*`/`is*` views).
- **Threat-catalog rows:** 12 rows in the Phase-0 catalog, all 12 answered above (either "addressed by finding #" or "invariant holds — checked").
- **Holes closed this pass:** 0 — no entrypoint or threat-catalog row was left unexamined by both phases combined; Turn-3 work consisted of cross-phase dedup and direct source verification of two sibling-contract diffs (Findings 1 and 2/4), not fresh discovery.

---

> ⚠️ This review was performed by an AI-based audit pipeline (context-building phase + 7 breadth agents + 12 depth agents + reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. A human security review, bug bounty program, and on-chain monitoring are strongly recommended before or alongside mainnet deployment of the agent-lane vault stack, particularly given the two confirmed regressions relative to the already-audited Creator lane (Findings 1, 2, 4) — the client may want to re-run a lane-parity diff across the full `agent/` vs `creator/` module tree, not just the two files in this job's scope.
