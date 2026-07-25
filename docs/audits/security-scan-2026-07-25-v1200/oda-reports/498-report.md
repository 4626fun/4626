# 🔐 Security Review — CreatorShareOFT + CreatorOVaultWrapper (ODA v1.20.0 greenfield candidate)

leftclaw job #498 · 4626fun/4626 · branch `audit/oda-v1200-greenfield-candidate` · commit `82688294f7765f20f7763175aa566e046eca95af`

---

## Scope

|                                  |                                                                                                    |
| -------------------------------- | -------------------------------------------------------------------------------------------------- |
| **Mode**                         | Named files (2)                                                                                     |
| **Files reviewed**               | `contracts/creator/vault/CreatorShareOFT.sol` (1426 LOC) · `contracts/creator/vault/CreatorOVaultWrapper.sol` (846 LOC) |
| **Out of scope**                 | `CreatorOVault`/`CreatorOVaultCoreModule` (audited independently as leftclaw job #497 — this report cross-references those findings where relevant but does not re-derive them); LayerZero `OFT`/`OApp` base-contract internals (trusted dependency, not vendored in this repo); `IRegistry4626`, `ITradeFeeCollector4626`, `ILotteryManager4626` (external black-box interfaces) |
| **Prior context**                | Delta review vs. full ODA audit dated 2026-07-22 (pin `423e0e3`); P0 remediations landed in PR #757 / commit `413f060`. Prior related jobs: ODA 463, 481. Independent, from-scratch re-audit — no findings below were sourced from prior reports. |
| **Confidence threshold (1–100)** | 50 (findings below 50 are listed as Leads)                                                          |

## Methodology

Three-phase audit: **Phase 0** (context) — three parallel agents built a protocol map, access-control inventory, and threat catalog (zero findings). **Phase 1** (breadth) — 6 domain checklist agents (evm-audit-general, precision-math, erc20, bridges, access-control, dos), routed for this target's LayerZero/cross-chain/transfer-tax domain. **Phase 2** (depth) — 12 attacker-mindset agents (9 single-specialty + 3 cross-lens gap-hunters), run **blind to Phase 1's findings**, given only the protocol map. **Phase 3** — this document: cross-phase reconciliation, resolution of a genuine severity dispute among Phase-2 agents (see Finding #1), and a coverage gate against the Phase 0 threat catalog. All agents ran on opus given the scope size (~2,300 in-scope LOC across a LayerZero OFT + cross-chain lottery + vault-wrapper design).

**Reconciliation summary**: Overlap (both phases): 3 · Phase-1-only: 11 · Phase-2-only: 6 · Disputed-then-resolved: 1 (Finding #1 — 3 agents called it a finding, 2 called it a bounded lead; resolved via direct repeatability trace) · Coverage holes closed this pass: 0.

---

## Findings

[75] **1. Cooldown-propagation hook can be weaponized to force a withdrawal cooldown onto an unwilling victim, enabling sustained low-cost targeted censorship**

`CreatorOVaultWrapper.propagateCooldownOnTransfer()` / `_requireWrapperCooldown()`, `CreatorShareOFT._update()` · Confidence: 75

**Description**
`_update` (CreatorShareOFT.sol:622-637) calls `wrapper.propagateCooldownOnTransfer(from, to, value)` on every ShareOFT transfer. This hook (CreatorOVaultWrapper.sol:812-828) monotonically forwards `lastWrapperDepositBlock[from]` onto `to` — documented as protection against *the depositor themselves* laundering a fresh deposit through a throwaway wallet to dodge their own withdrawal cooldown. But `from`/`to` are ordinary transfer parties: **any address that has recently deposited can transfer a trivial amount to *any other address* and unilaterally advance that victim's cooldown to the current block, with no action or consent from the victim.**

Three Phase-2 agents (economic-security, first-principles, periphery) independently found and promoted this to a finding; two others (execution-trace, boundary) found the identical mechanism but characterized it as bounded to a single block's delay. The orchestrator resolved this directly:

**Proof of Concept**
Attacker deposits (any recoverable amount) at block N → `lastWrapperDepositBlock[attacker] = N`. Attacker calls `ShareOFT.transfer(victim, 1)` → `propagateCooldownOnTransfer` sets `lastWrapperDepositBlock[victim] = N`. Victim's `withdraw()`/`unwrap()` in block N reverts `WrapperWithdrawTooSoon` (`requiredBlock = N+1 > N`).

**Repeatability (the disputed point, resolved)**: In block N+1 alone, the victim's stamp of N would satisfy the cooldown check and they could withdraw. But **the attacker can repeat the attack every block** — re-deposit (own stamp → N+1) and re-transfer 1 wei (victim's stamp → N+1) — blocking N+1 too, and so on indefinitely. Cost per block: one small (fully recoverable) deposit refresh + one dust transfer + gas (a few cents on Base). This makes it a **sustainable, low-cost, targeted censorship tool** against any specific victim — not a single-block nuisance. No fund theft occurs; this is pure denial-of-withdrawal griefing.

**Fix**
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

---

[55] **2. `flushFees` accepts an unvalidated `composeMsg`/`extraOptions` from a permissionless caller — potential confused-deputy into the hub gauge**

`CreatorShareOFT.flushFees()` · Confidence: 55 (mechanism confirmed in-scope; impact contingent on out-of-scope `hubGaugeReceiver`/`GaugeController` implementing and trusting `lzCompose`)

**Description**
`flushFees` (S:726-747) is permissionless and validates only `_sendParam.dstEid`, `.to`, and `.amountLD`. The caller-supplied `.composeMsg`, `.extraOptions`, and `.minAmountLD` pass through unvalidated into `this.send(...)`. The intended builder, `buildFlushSendParam()` (S:753-767), always sets `composeMsg: ""` — but nothing forces `flushFees` callers to use it. A non-empty `composeMsg` turns the send into a LayerZero SEND_AND_CALL, delivering an attacker-chosen payload to `hubGaugeReceiver` as if it originated from the trusted SOFT peer.

**Proof of Concept**
Attacker calls `flushFees` with a crafted `_sendParam.composeMsg` (dstEid/to/amountLD still valid so the three checks pass). If `hubGaugeReceiver` implements `lzCompose` and trusts calls from a registered peer OFT, this delivers attacker-controlled compose data authenticated as coming from SOFT. Whether `GaugeController`/`hubGaugeReceiver` is composable at all is out of scope for this job — this finding documents the in-scope missing validation, not a confirmed downstream exploit.

**Fix**
```diff
     function flushFees(SendParam calldata _sendParam, MessagingFee calldata _fee) external payable nonReentrant {
         ...
         require(_sendParam.dstEid == hubEid, "Invalid dstEid");
         require(_sendParam.to == bytes32(uint256(uint160(hubGaugeReceiver))), "Invalid receiver");
         require(_sendParam.amountLD == amount, "Amount mismatch");
+        require(_sendParam.composeMsg.length == 0, "No compose allowed");
```
Better: ignore the caller's `SendParam` entirely and reconstruct it internally via `buildFlushSendParam()`, accepting only the `MessagingFee`.

---

[85] **3. Beneficiary operator can siphon a beneficiary's accumulated wrap/unwrap dust via `depositFor`/`withdrawFor`**

`CreatorOVaultWrapper._wrapInternal()`/`_unwrapInternal()` via `depositFor()`/`withdrawFor()` · Confidence: 85 (mechanism fully proven; severity capped by trusted-role gate and dust-scale bound)

**Description**
The single most-corroborated item in this engagement — raised independently by 7+ agents across both phases (precision-math, access-control, economic-security, periphery, asymmetry, trust-gap, flow-gap). In the `*For` paths, the dust ledger is keyed to the `beneficiary` (`accountingUser`) while the ShareOFT burn/mint and the redemption/mint recipient is `msg.sender` (the operator). An operator can fold a victim beneficiary's accumulated dust into their own mint/redemption output.

**Proof of Concept**
Beneficiary has `userDustShares[beneficiary] = 500` (from a prior self-deposit). An owner-granted beneficiary operator calls `withdrawFor(1, 0, beneficiary)`: `_unwrapInternal` computes `vaultSharesBeforeFee = 1×1000 + 500 = 1500`, zeroes the beneficiary's dust, and redeems 1500 (minus fee) worth of vault shares to the *operator*, who only burned 1 ShareOFT of their own.

**Assessment**: Bounded to `<1000` vault-share-units (`<1` ShareOFT-equivalent, sub-cent value) per victim, and requires the owner-granted, trusted `isBeneficiaryOperator` role — capped at Low despite the high mechanism confidence.

**Fix**
```diff
-        uint256 vaultSharesBeforeFee = shareOFTIn * NORMALIZATION_FACTOR + userDustShares[accountingUser];
+        // When accountingUser != the party receiving output (msg.sender), do not fold
+        // accountingUser's dust into msg.sender's payout — either require accountingUser
+        // == msg.sender for dust reclamation, or credit the reclaimed dust back to
+        // accountingUser as a separate balance rather than paying it to the operator.
```

---

[65] **4. `unwrap()` omits the large-withdrawal async-redemption gate the three `withdraw*` paths enforce**

`CreatorOVaultWrapper.unwrap()` W:455-467 vs. `withdraw()`/`withdraw(amount)`/`withdrawFor()` W:371,392,416 · Confidence: 65 (in-scope code asymmetry fully confirmed; independent exploitability ruled out via cross-reference to job 497)

**Description**
`withdraw`/`withdraw(amount)`/`withdrawFor` all call `_requireSynchronousRedemption(vaultShareAmount)` before redeeming — a gate meant to force large withdrawals through the vault's async queue. `unwrap()` releases raw vault shares directly via `_unwrapInternal` + `safeTransfer` with **no such gate**. A user blocked from `withdraw(hugeAmount)` could instead `unwrap(hugeAmount)` to get raw vault shares gate-free, then call the vault's `redeem()` themselves.

**Cross-reference to job 497 (this repo's sibling vault audit)**: `CreatorOVaultCoreModule.redeem()`/`withdraw()` independently enforce `largeWithdrawalThreshold` (reverting `LargeWithdrawalMustBeQueued`) **regardless of caller** — the vault does not rely on this wrapper to gate large withdrawals. This means `unwrap()`'s missing check does **not** currently defeat the vault's real MEV/large-withdrawal protection.

**Assessment**: Real code inconsistency and defense-in-depth gap (the wrapper advertises this control on 3 of 4 exit paths and silently omits it on the 4th), but not independently exploitable today given the vault's own enforcement. Kept as a finding rather than a lead because the code fact is fully proven in-scope; severity is Low-Medium rather than the higher rating it would warrant if the vault didn't self-protect.

**Fix**
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

---

## Leads

_Vulnerability trails with concrete code smells where impact is bounded, contingent on out-of-scope contracts, or gated behind a trusted role. Not scored._

- **Lottery-entry inbound path lacks the peer allowlist the winner-callback path has** — `_lzReceive()` S:1026-1031 vs. `_isWinnerCallbackMessage()` S:1053-1062. The hub forwards 224-byte lottery entries to `hubLotteryPeer` relying only on base-class LayerZero `peers[srcEid]` authentication, with no in-branch re-check (unlike the sibling winner-callback branch). Raised by 5+ agents across both phases. Most agents that traced it fully concluded base-class auth is sufficient in practice (`setPeer` on the hub is owner-only, per the chainid-gated `onlyOwnerOrRemoteProtocolWire` modifier), with residual risk living entirely in the out-of-scope `LotteryManager4626`'s own content validation. Recommend an explicit lottery-source EID allowlist as defense-in-depth regardless.
- **Owner can self-grant minter status via `setMinter(owner, true)`**, bypassing the documented "owner is not a free minter" restriction on `mint()`'s inline check — still gated by `_assertMintBacking` afterward, making the restriction largely redundant with the backing check rather than a real bypass.
- **Hardcoded default `remoteProtocolWireAuthority`** is live and privileged (able to `setPeer`/`setHubConfig`) on every non-Base deployment from construction, before explicit owner reconfiguration.
- **Creator Coin / vault-share legs lack balance-delta verification** (unlike the carefully-guarded ShareOFT mint/burn legs) — fails safe (DoS via revert) rather than loses funds, given the protocol's own choice of standard, non-fee-on-transfer tokens.
- **Raw `approve()` instead of `SafeERC20.forceApprove`** on the Creator Coin allowance — breaks on no-bool-return or USDT-style approve-race tokens (not the actual Creator Coin in production).
- **Async-redemption gate (`_requireSynchronousRedemption`) fails open** on any vault-call failure (`staticcall` to an unconfirmed selector) — separate from Finding #4, this covers the case where the *vault itself* stops answering, not the `unwrap()` code-path gap.
- **`flushFees` strands OFT shared-decimals dust** with no sweep mechanism on spoke chains, and over-reports `totalFeesFlushed` by the same dust each flush.
- **One-shot bindings** (`setVault`, `setWrapper`, `setShareOFT`) have no recovery path if bound to the wrong address — anti-rug property with a fat-finger-risk tradeoff.
- **Single-step `Ownable`** (not `Ownable2Step`) on both contracts — standard transfer/renounce footgun.
- **`uint32` truncation of `block.chainid`** in cross-chain lottery-entry metadata (the actual replay-id uses the full `uint256`, so this is metadata-only corruption).
- **`convertToAssets()` silently clamps** oversized input instead of reverting, inconsistent with `_assertMintBacking`'s revert-on-overflow behavior.
- **Cooldown-propagation hook can also be gas-griefed to *skip* propagation** (opposite direction from Finding #1) via 63/64-rule gas starvation — no profitable exploit chain established, contingent on the out-of-scope vault's PPS being same-block-manipulable (job 497 found no evidence of this).
- **Whitelisted/beneficiary-operator addresses are fully exempt from the cooldown check**, potentially reopening the flash-loan same-block deposit→withdraw bypass for trusted roles — same out-of-scope-vault contingency as above.
- **Chain-local backing/redemption ledgers don't code-enforce a single-hub-deployment invariant** — safe under the current topology (wrapper+vault exist only on the hub), a deployment-configuration footgun if that topology ever changes, not a live issue.
- **`flushThreshold` is stored/settable but read by no flush path** — vestigial dead config, confirmed by nearly every agent.

---

## Access-Control Inventory

_Condensed by guard class; full per-function table (~60 rows across both files) preserved in the audit working files._

| Guard | Representative functions | Moves value |
|---|---|---|
| `onlyOwner` (SOFT) | setVault(one-shot), setRemoteProtocolWireAuthority, setRegistry, setMinter, setWrapper(one-shot), setLotteryResolver, setFlushThreshold, setLotteryEntryGasLimit, setAddressType(s), setGaugeController, setBuyFee(capped), setFeesEnabled, setLotteryEnabled, setContractURI, withdrawETH | withdrawETH only |
| `onlyOwnerOrRemoteProtocolWire` (SOFT) | setPeer, setHubConfig, setHubLotteryPeer | no |
| `vault‖isMinter` (SOFT, `mint`'s narrower inline check — excludes owner) | mint | yes |
| `onlyVaultOrMinter` (SOFT, the modifier — includes owner) | burn (+ allowance unless caller is vault) | yes |
| No role, `nonReentrant` (SOFT) | flushPendingFeesToGauge (hub-only), flushFees (remote-only), submitPendingLotteryEntry (entry-owner-pinned) | yes |
| LayerZero endpoint (inherited auth) | `_lzReceive` | yes |
| `onlyOwner` (Wrapper) | setShareOFT(one-shot), setFees, setFeeRecipient, setWhitelist, batchWhitelist, setBeneficiaryOperator, emergencyWithdraw(capped), refreshApproval | emergencyWithdraw only |
| No role, `nonReentrant` (Wrapper) | deposit/depositFor, withdraw/withdrawFor, wrap, unwrap | yes |
| Self-only (`msg.sender==shareOFT`) (Wrapper) | propagateCooldownOnTransfer | no |

**Roles**: owner (both contracts, single-step OZ Ownable). **remoteProtocolWireAuthority** (SOFT, hardcoded default, owner-settable/revocable) — a second key, off-Base-only, for cross-chain peer wiring. **vault** (SOFT, one-shot) — trusted minter/burner. **minters** (SOFT, `isMinter`, owner-granted) — production minter is the wrapper. **beneficiaryOperator** (Wrapper, owner-granted, owner is one by default) — trusted third-party accounting role (see Finding #3). **whitelisted** (Wrapper, owner-granted) — fee/cooldown-exempt. **hub vs. spoke** (SOFT, `isHub`, Base cannot be demoted). **LayerZero peers** — the trust root for all inbound cross-chain messages.

---

## Threat Model

| Actor | Reach | Potential gain | Status |
|---|---|---|---|
| Any ShareOFT holder with a recent deposit | `transfer` (dust amount) to any victim | Force a withdrawal cooldown onto an unwilling victim, sustained indefinitely | **Addressed by Finding #1** |
| Anyone | `flushFees` with crafted `composeMsg`/`extraOptions` | Confused-deputy compose delivery to hub gauge, or delivery griefing | **Addressed by Finding #2** — contingent on out-of-scope GaugeController compose support |
| Beneficiary operator (trusted) | `depositFor`/`withdrawFor` | Siphon a beneficiary's accumulated dust | **Addressed by Finding #3** — bounded, trusted-role-gated |
| Any user | `unwrap()` for a large amount | Bypass the wrapper's advertised large-withdrawal gate | **Addressed by Finding #4** — not independently exploitable given vault's own enforcement (see job 497) |
| Compromised/misconfigured LayerZero peer | `_lzReceive` inbound lottery-entry forwarding | Forge lottery entries with arbitrary buyer/amount | **Lead** — base-class peer auth judged sufficient by most agents; residual risk in out-of-scope LotteryManager |
| Owner | `setMinter(owner, true)` | Bypass the documented "owner can't mint" restriction | **Lead** — still backing-gated, largely redundant restriction |
| Cross-chain bridger | Bridge SOFT into hub via standard `_credit` | Inflate hub-local supply / over-redeem | **Invariant holds** — proven fail-safe by 7+ independent agents across both phases; global supply conservation + wrapper's chain-local ledger make over-redemption structurally impossible |
| Arbitrary caller | Message-type discrimination (224 vs. 128 byte) | Steer a legitimate transfer into the lottery/callback branches, or vice versa | **Invariant holds** — packed wire-format position makes collision infeasible for honest peers |
| remoteProtocolWireAuthority (second key) | setPeer/setHubConfig/setHubLotteryPeer off-Base | Wire malicious peers / redirect fees | **Lead** — documented, owner-revocable co-authority; hardcoded default is live from deployment (see Leads) |
| Whitelisted/operator role | deposit + withdraw same block | Bypass anti-flash-loan cooldown | **Lead** — trusted-role carve-out, contingent on vault PPS manipulability (none found in job 497) |

---

## Coverage Gate

- **Entrypoints**: ~60 external/public functions identified across both files in the Phase 0 access-control inventory; every one received a Phase 1 checklist pass and/or Phase 2 attacker-agent examination.
- **Threat-catalog rows**: 11 actor×entrypoint rows in the Phase 0 catalog; all answered above.
- **Holes closed this pass**: 0. Both phases covered the full inventory and catalog — Phase 3's work was resolving the Finding #1 severity dispute (a re-examined lead, not a coverage hole) and cross-referencing job 497's vault behavior to correctly scope Finding #4's real-world exploitability.
- **Confidence floor used**: 50.

---

> ⚠️ This review was performed by an AI-orchestrated multi-agent audit pipeline (context-building + breadth checklists + blind depth attackers + adversarial reconciliation). AI analysis can never verify the complete absence of vulnerabilities and no guarantee of security is given. Independent human review, a public bug bounty, and on-chain monitoring are strongly recommended before mainnet deployment, especially given several findings here are contingent on the behavior of out-of-scope contracts (`CreatorOVault`, `LotteryManager4626`, `GaugeController`/`ITradeFeeCollector4626`, `IRegistry4626`, and the LayerZero OFT/OApp base) that could not be fully inspected in this engagement. Finding #4's severity assessment relies on a cross-reference to leftclaw job #497's independent audit of `CreatorOVault`/`CreatorOVaultCoreModule` — if that vault's own large-withdrawal enforcement is ever changed, Finding #4 should be re-evaluated.
