# Security Audit — 4626 Vault Infrastructure

**Scope:** Solidity sources under `agent/`, `creator/`, `shared/`, and `other/` (≈40k LoC, 104 `.sol` files).
**Focus areas (as requested):** reentrancy, access control, upgradeability, accounting, signature validation, oracle, token-transfer edge cases, initialization.
**Method:** Manual review of the highest-value contracts across each product lane, cross-lane parity diffing of the four guarded fork pairs, and pattern scans for `ecrecover`/`delegatecall`/`selfdestruct`/`tx.origin`/initializer/randomness usage.

> Note on maturity: this codebase has already undergone at least one prior audit pass (the `docs/audits/aristotle/oracle` cycle and numerous `FIX:` tags C-*/H-*/M-*/L-*/G-* throughout). The reviewed contracts are, in general, strongly hardened: ERC-4626 inflation protection (virtual shares + `MINIMUM_FIRST_DEPOSIT`), CEI ordering, `nonReentrant` on value-moving entrypoints, oracle staleness/deviation/sequencer-uptime guards, EIP-712 nonce/deadline signature handling, and LayerZero peer/EID authorization are all present. The findings below are the residual issues identified in this pass.

---

## Summary of findings

| ID | Severity | Title | Location | Status |
|----|----------|-------|----------|--------|
| M-1 | Medium | Lane-parity drift: agent revenue router missing external-swap allowlist guard (L-3) | `agent/revenue/AgentRevenueRouter.sol` | **Fixed in this pass** |
| M-2 | Medium | Lane-parity drift: agent contracts allow owner drain of in-flight WETH (L-4) | `agent/revenue/AgentRevenueRouter.sol`, `agent/revenue/AgentGaugeController.sol` | **Fixed in this pass** |
| L-1 | Low | Lane-parity CI guard is not catching real logic drift | process / `scripts/check-lane-contract-parity.mjs` (out of tree) | Open |
| L-2 | Low | `OVaultLPManager` rebalance slippage guard only measures token0 value | `shared/shareoft-mesh/univ4/OVaultLPManager.sol` | Open (accepted risk) |
| L-3 | Low | Single-relayer drand source is trust-assuming; PULL randomness is publicly readable | `shared/lottery/randomness/DrandRandomnessSource.sol`, `RandomnessRouter.sol` | Open (documented / VRF-primary) |
| I-1 | Info | Owner-less `VaultShareBurnStream` bootstrap is a deployment invariant | `shared/distribution/VaultShareBurnStream.sol` | Open (documented) |
| I-2 | Info | Remote oracle overwrites `assetSymbol` from message payload | `creator/oracles/CreatorOracle.sol`, `agent/oracles/AgentOracle.sol` | Open (peer-authenticated) |

---

## M-1 — Agent revenue router accepts arbitrary external-swap targets/spenders (lane-parity drift)

**Severity:** Medium (access control / fund custody)
**Affected:** `agent/revenue/AgentRevenueRouter.sol` — `setExternalSwapTargetApproval`, `setExternalSwapSpenderApproval`, `convertViaExternalAndQueue`.
**Reference (correct) implementation:** `creator/revenue/CreatorPayoutRouter.sol` (`_requireSafeExternalSwapAddress`, fix tag L-3).

### Description
`AgentRevenueRouter` and `CreatorPayoutRouter` are a *guarded lane-parity fork pair*: the project's own policy (README, "Copy-renamed forks (guarded)") requires their logic to stay identical, differing only in ABI-visible naming. The creator router was hardened (fix L-3) with `_requireSafeExternalSwapAddress`, which rejects allowlisting the contract's own custody surfaces — `address(this)`, `vault`, `wrapper`, `burnStream`, the managed token, and `shareOFT` — as an external swap target or spender. **This guard was never mirrored to the agent router.**

`convertViaExternalAndQueue` performs a low-level call to an approved `swapTarget` with fully caller-controlled `swapCallData`, after granting the approved `spender` an ERC-20 allowance on `tokenIn`:

```solidity
inToken.forceApprove(spender, amountIn);
(bool ok, bytes memory returnData) = swapTarget.call(swapCallData);   // arbitrary calldata
```

### Exploit path
1. A compromised or careless `owner` allowlists a custody-relevant address (e.g. the `vault`, `wrapper`, `burnStream`, or a token address) as an approved external swap target/spender. On the creator router this reverts with `InvalidExternalSwapAddress`; on the agent router it succeeds.
2. A compromised `keeper` (a lower-trust role than owner — `onlyOwnerOrKeeper` gates these entrypoints) then calls `convertViaExternalAndQueue` with `swapTarget`/`spender` set to that address and `swapCallData` chosen to move funds outside the swap-then-queue accounting the router relies on (e.g. drive an allowance/transfer against an approved token contract, or invoke a privileged method on an in-system contract that trusts the router).
3. The router's post-checks (`ExternalSwapOverspent`, `MinOutNotMet`) only bound `tokenIn` spend and `shareOFT` received; they do not constrain side effects on other approved custody addresses.

### Remediation (applied)
Ported `_requireSafeExternalSwapAddress` and the `InvalidExternalSwapAddress` error to `AgentRevenueRouter`, and invoked it from both approval setters when `approved == true`, mirroring the creator reference (with `agentToken` substituted for `creatorCoin`). The team should still restrict the allowlist operationally to canonical DEX routers only.

---

## M-2 — Owner can drain in-flight WETH fees on the agent lane (lane-parity drift)

**Severity:** Medium (centralization / accounting — in-flight fund drain)
**Affected:**
- `agent/revenue/AgentRevenueRouter.sol` — `emergencyWithdraw`
- `agent/revenue/AgentGaugeController.sol` — `emergencyWithdraw`

**Reference (correct) implementations:** `creator/revenue/CreatorPayoutRouter.sol` (fix L-4) and `creator/revenue/CreatorGaugeController.sol` (fix L-4, `PendingWethFeesProtected`).

### Description
Both agent contracts receive native ETH via `receive()` and immediately wrap it to WETH, holding it as an in-flight balance pending conversion/processing (`convertAndQueue` for the router; `_processWETHFees` / `pendingWETHFees` for the gauge). The creator counterparts were hardened so `emergencyWithdraw` **cannot** touch this in-flight WETH:

- `CreatorPayoutRouter.emergencyWithdraw` reverts `ProtectedPayoutAsset` for `creatorCoin`, `shareOFT`, **and `weth`**.
- `CreatorGaugeController.emergencyWithdraw` reverts `PendingWethFeesProtected` when `token == WETH && pendingWETHFees > 0`.

The agent forks omitted the WETH protection: `AgentRevenueRouter` protected only `agentToken`/`shareOFT`, and `AgentGaugeController` protected only `shareOFT`/`jackpotReserve`. As a result the `owner` can call `emergencyWithdraw(WETH, …)` and skim revenue that belongs to the burn/lottery/voter distribution path before it is processed.

### Exploit path
1. Native ETH (protocol fees / tax-hook proceeds) arrives at the agent router or gauge and is wrapped into WETH, sitting as `pendingWETHFees` (gauge) or an unconverted balance (router).
2. Before a keeper processes it, `owner` calls `emergencyWithdraw(WETH, balance, attacker)` and extracts the funds that should have flowed to burn/lottery/voters.

### Remediation (applied)
Ported the L-4 WETH protection to both agent contracts, mirroring the creator reference:
- Router: added `|| token == weth` to the `ProtectedPayoutAsset` guard.
- Gauge: added the `PendingWethFeesProtected` error and the `token == WETH && pendingWETHFees > 0` revert.

Operationally, in-flight WETH should be moved via `convertAndQueue`/`processWETHFees`, not `emergencyWithdraw`.

---

## L-1 — Lane-parity CI guard is not catching real logic drift

**Severity:** Low (process / defense-in-depth)
The README states `pnpm guard:lane-contract-parity` is CI-blocking and "diffs each pair with comments stripped and the approved rename map applied; any residual difference fails the build." Yet M-1 and M-2 are genuine, comment-independent *logic* differences (extra `require`/`revert`/helper functions) that reached the tree. This means either the guard was bypassed, the rename map is masking logic, or the fixes were applied to the creator lane without CI re-running the guard.

**Recommendation:** Treat the guard as authoritative and re-run it after any change to a guarded pair; add a regression test asserting that both routers reject custody-address allowlisting and both `emergencyWithdraw`s reject WETH. Since the guard lives outside this repository snapshot (`scripts/`), verify it flags the two divergences before this fix, then confirm it passes after.

---

## L-2 — `OVaultLPManager` rebalance slippage guard measures only token0

**Severity:** Low
`_executeRebalance` computes `maxLoss` from `valueBefore0`/`valueAfter0` in units of `ASSET` (token0) only:

```solidity
uint256 maxLoss = (valueBefore0 * maxRebalanceSlippageBps) / 10_000;
if (valueAfter0 + maxLoss < valueBefore0) revert RebalanceSlippageExceeded(...);
```

A rebalance that shifts value from token0 into token1 without reducing the token0 balance below the bound would not trip this check, so the guard does not bound total-value loss. This is mitigated because `rebalance()` is `onlyManager` (not permissionless), gated by a TWAP-deviation check (`maxTwapDeviation`), a minimum tick move, and a boundary check. Risk is therefore limited to a mispriced/manipulated pool combined with a manager action.

**Recommendation:** Bound loss on the combined value (convert token1 to token0 terms via the TWAP tick and compare total), or add a symmetric token1 guard.

---

## L-3 — Single-relayer drand source and publicly readable PULL randomness

**Severity:** Low (fairness), given VRF-primary design
`DrandRandomnessSource` verifies BLS pairings correctly and binds `(round, H(round))` via a keccak commitment, but its own NatSpec acknowledges a single authorized relayer only proves self-consistency, not honesty, and defers N-of-M to a future `MultiRelayerDrandSource`. It is `SourceMode.PULL`: once a round is fulfilled, `randomWord(round)` is world-readable. If a lottery ever settled directly against a PULL source for an entry whose committed round is already published, an actor could learn the outcome before committing/settling (selective settlement). This is mitigated today because `LotteryManager4626` uses Chainlink VRF as the primary settlement source and `RandomnessRouter` treats drand as an opt-in side path fed by a keeper.

**Recommendation:** Before wiring any coin to a PULL source for real settlement, ensure the entry commits to a *future* drand round (round derived from a timestamp strictly after entry commitment) and ship the multi-relayer source.

---

## I-1 — `VaultShareBurnStream` bootstrap is a deployment-time invariant

`VaultShareBurnStream` is intentionally owner-less; `setAuthorizedQueuer` and `recoverFailedBurns` are reachable only via `msg.sender == vault`. If the deployed vault does not expose owner/governance-gated functions that call these, then (a) no queuer can be authorized (permanently reverting the payout router's `queueShares`), and (b) `failedBurnAccumulator` can never be recovered. This is already documented in-code (fix L-2). **Recommendation:** keep the deployment test that asserts the vault can successfully call both functions before the stream is wired into the payout path.

## I-2 — Remote oracle overwrites `assetSymbol` from message payload

`CreatorOracle._lzReceive` / `AgentOracle._lzReceive` accept the authoritative price from the canonical hub (`origin.srcEid == BASE_EID`, LayerZero peer-authenticated) with no per-message deviation cap — correct for an authoritative source — and also overwrite `assetSymbol` with the payload string. This is safe under the current peer-auth model, but a bug or compromise at the hub would propagate a symbol change unbounded to all spokes. **Recommendation:** consider fixing `assetSymbol` at configuration time rather than per message, or bounding its length.

---

## Areas reviewed with no material findings in this pass

- **ERC-4626 vault core (`CreatorOVaultCoreModule`)** — inflation protection (virtual shares offset 3, `MINIMUM_FIRST_DEPOSIT`, `InflationAttackDetected` bound, `pricePerShare` uses `+1`/`+1000`), CEI ordering in deposit/mint/redeem/withdraw, PPS deviation checks, withdraw-delay and large-withdrawal queueing.
- **Signature validation** — `permitOperator` and ERC-2612 `permit` use EIP-712 `_hashTypedDataV4`, per-owner nonces, deadline checks, and `SignatureChecker` (EIP-1271 aware); operator grants are epoch-invalidated on ownership transfer.
- **Oracle price paths (`CreatorOracle`)** — Chainlink staleness + L2 sequencer-uptime + grace period, `MAX_PRICE_DEVIATION` on every mutable update path, owner-only bounded `initializeAssetPrice`, TWAP tick-capping/auto-tuning, out-of-order LZ update rejection.
- **ShareOFT fee/lottery plane (`CreatorShareOFT`)** — buy-fee detection is `SwapOnly → non-SwapOnly` only, `_processBuy` is `nonReentrant` and CEI-ordered, fee-routing failures fall back to `pendingFees` with allowance revocation, wrapper cooldown hook is try/caught.
- **Gauge accounting (`CreatorGaugeController`)** — explicit `accountedOFTBalance` tracking separates jackpot reserve from bridged fees, `payJackpot` is lottery-manager-gated and bounds against `jackpotReserve`, swaps use oracle-derived `minOut` + deadline.
- **Recovery (`OVaultRecoveryEscrow`/`OVaultImpairmentClaims`)** — epoch-scoped claim caps (fix C-2), non-transferable claim ERC-1155.
- **Lottery/VRF (`LotteryManager4626`)** — VRF callbacks authenticated to `localVRFConsumer`/`vrfIntegrator`, stale-result grace period, pause-deferral, oracle staleness/deviation guards on USD valuation.
- **AlfaCreatorKeyPool** — exact-delivery transfer guards and reserves settled from stored (not live) balances, defeating donation/fee-on-transfer mispricing.

These areas warrant continued line-by-line review at production scale; this report reflects a prioritized pass over the largest and most value-bearing contracts rather than an exhaustive line-by-line audit of all 40k lines.
