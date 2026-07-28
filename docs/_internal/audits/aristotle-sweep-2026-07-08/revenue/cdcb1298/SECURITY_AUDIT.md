# Security Audit — Agent Revenue / Fee-Routing Subsystem

**Scope (as requested — this subsystem only):**
- `AgentGaugeController.sol`
- `AgentRevenueRouter.sol`
- `AgentRevenuePolicyController.sol`
- `AgentOVaultTaxAdapter.sol`

**Focus areas:** accounting integrity, fee routing, external-call safety, privileged/admin actions.

External/imported components (`IAgentOVault`, wrapper, LayerZero OFT tokens, Uniswap routers,
oracle, lottery manager, `ProtocolRewards`, `IAgentTokenV4`) are treated as trusted black boxes
and are out of scope except where this subsystem's assumptions about them are unsafe.

Severity uses the usual Critical / High / Medium / Low / Informational scale. "Exploit path"
and "Remediation" are given per finding.

---

## Summary table

| ID | Title | Area | Severity |
|----|-------|------|----------|
| H-1 | `fallbackMinOutputBps` prices AgentToken ≈ WETH 1:1, effectively disabling slippage protection on the permissionless WETH swap | Fee routing / external call | High |
| H-2 | Broad, timelock-less admin powers can seize/redirect in-flight fees and jackpot backing | Privileged admin | High |
| M-1 | `emergencyWithdraw` desyncs `pendingFees` vs `accountedOFTBalance`, permanently bricking distribution | Accounting | Medium |
| M-2 | `emergencyWithdraw` can drain undistributed `pendingFees` ShareOFT (jackpot guard does not cover pending fees) | Accounting / admin | Medium |
| M-3 | No consistency validation in `setVault` / `setWrapper` / `setAgentToken` (vault.asset ↔ agentToken ↔ wrapper) | Fee routing / config | Medium |
| M-4 | Router external-swap and V3 paths rely solely on caller-supplied `minOut` (keeper trust / MEV) | External call safety | Medium |
| L-1 | Router `_claimProtocolRewards` treats any successful low-level call as a claim (silent no-op + misleading event) | External call safety | Low |
| L-2 | `setSwapConfig` accepts arbitrary `swapFeeTier`; `emergencyWithdraw` (gauge) lacks `nonReentrant` | Config / hygiene | Low |
| L-3 | `AgentOVaultTaxAdapter` accrual counters are attacker-influenceable by any authorized caller (analytics only) | Accounting | Low/Info |
| I-1 | Jackpot ShareOFT rescue depends on owner reusing `lotteryManager` role; ETH `receive()` mis-attributes `from` | Info | Info |

---

## H-1 — `fallbackMinOutputBps` prices AgentToken ≈ WETH 1:1, effectively disabling slippage protection

**Contract:** `AgentGaugeController.sol` — `_calculateMinOutput`, `_processWETHFees`, `processWETHFees`

**Detail.** When the oracle is disabled or unset, `_calculateMinOutput` falls back to:

```solidity
if (!useOracleSlippage || address(oracle) == address(0)) {
    if (fallbackMinOutputBps > 0) {
        return (wethAmount * fallbackMinOutputBps) / MAX_BPS; // <-- WETH units, not AgentToken units
    }
    return 0;
}
```

The returned value is used directly as `amountOutMinimum` for a `WETH → AgentToken` swap. This
formula assumes 1 wei of WETH ≈ 1 wei of AgentToken. AgentToken is a low-unit-price token, so the
true output of the swap is typically **orders of magnitude larger** than `wethAmount`. A `minOut`
of e.g. `0.9 * wethAmount` is therefore trivially satisfied even after an adversary has extracted
almost the entire real output.

**Exploit path.**
1. Owner enables permissionless processing (`maxPermissionlessWethProcess > 0`) and, during an
   oracle outage / to avoid fail-closed behaviour, sets `fallbackMinOutputBps` (e.g. 9000).
2. Attacker (any address) calls `processWETHFees()` (permissionless up to the cap) or waits for a
   keeper, sandwiching the `exactInputSingle` call: buy AgentToken to push the pool, let the
   contract swap with a near-useless `minOut`, sell back.
3. Almost all fee value is extracted as MEV; the `sqrtPriceLimitX96` derived from the same bogus
   `minOut` is equally loose, so it provides no additional protection.

**Remediation.** Do not derive `minOut` in input-token units. Either (a) remove the fallback and
keep failing closed (the default `0`), or (b) require a caller-supplied absolute `minOut` for
permissionless/keeper calls that is denominated in AgentToken, or (c) keep the swap gated to
owner/keeper only whenever the oracle is unavailable. Never treat WETH and AgentToken as 1:1.

---

## H-2 — Broad, timelock-less admin powers can seize/redirect in-flight fees and jackpot backing

**Contracts:** `AgentGaugeController.sol`, `AgentRevenueRouter.sol`, `AgentRevenuePolicyController.sol`

**Detail.** A single `owner` (EOA-capable) can, with no timelock or multi-party control:

- `setVault`, `setWrapper`, `setAgentToken`, `setLotteryManager`, `setProtocolTreasury`,
  `setAgentTreasury`, `setVe4626VoterRewardsDistributor` — re-point every routing destination.
- `emergencyWithdraw` — sweep tokens (see M-1/M-2 for the ShareOFT specifics; note vaultShares and
  AgentToken are **not** blocked and can be swept while transiently held during processing).
- `PolicyController.enforceProjectTaxRecipient()` — set the AgentToken's project tax recipient to
  the router (and, by re-deploying/replacing the controller, elsewhere).

Because `lotteryManager`, `voterRewardsDistributor`, `agentTreasury`, and `protocolTreasury` are
all owner-settable and are the sinks of fee routing, a compromised or malicious owner can redirect
essentially all future fee value to an address it controls (e.g. set `voterRewardsDistributor` to a
contract that forwards to the owner, or set `lotteryManager` to itself and drain `jackpotReserve`
via `payJackpot`).

**Exploit path.** Owner key compromise (or malicious operator) → repoint sinks / call
`payJackpot` after `setLotteryManager(attacker)` → funnel current jackpot and future fees.

**Remediation.** Place `owner` behind a timelock + multisig. Emit and monitor all setter events
(already emitted). Consider two-step ownership (`Ownable2Step`). Constrain `emergencyWithdraw` to a
guardian-only, rate-limited path and explicitly exclude protocol-owned assets (vaultShares,
AgentToken, ShareOFT while any liability exists). Document these as trusted-role assumptions.

---

## M-1 — `emergencyWithdraw` desyncs `pendingFees` vs `accountedOFTBalance`, permanently bricking distribution

**Contract:** `AgentGaugeController.sol` — `emergencyWithdraw`, `_distributeInternal`

**Detail.** `emergencyWithdraw` adjusts `accountedOFTBalance` for a ShareOFT withdrawal but never
touches `pendingFees`:

```solidity
if (token == address(shareOFT)) {
    if (amount >= accountedOFTBalance) accountedOFTBalance = 0;
    else accountedOFTBalance -= amount;
}
```

`_distributeInternal` later does `accountedOFTBalance -= oftAmount;` with `oftAmount = pendingFees`.
The invariant the code relies on is `accountedOFTBalance >= pendingFees`. After an
`emergencyWithdraw` of ShareOFT (only reachable when `jackpotReserve == 0`, see M-2), that invariant
is broken: `accountedOFTBalance` is reduced (possibly to 0) while `pendingFees` is unchanged.

**Exploit path (owner footgun / self-DoS).**
1. `jackpotReserve == 0`, `pendingFees > 0` (typical before the first distribution).
2. Owner calls `emergencyWithdraw(shareOFT, X, ...)` → `accountedOFTBalance` drops below
   `pendingFees`.
3. Any later `distribute()` / auto-distribute computes `accountedOFTBalance -= pendingFees`, which
   underflows and reverts. There is **no setter** to reset `pendingFees` or `accountedOFTBalance`,
   so distribution is bricked; incoming fees only widen the gap.

**Remediation.** In `emergencyWithdraw`, when withdrawing ShareOFT, decrement `pendingFees`
consistently (and clamp), or forbid ShareOFT withdrawal entirely while `pendingFees > 0` (mirroring
the WETH `pendingWETHFees` guard). Alternatively add an admin re-sync function that recomputes both
counters from the real balance.

---

## M-2 — `emergencyWithdraw` can drain undistributed `pendingFees` ShareOFT

**Contract:** `AgentGaugeController.sol` — `emergencyWithdraw`

**Detail.** The `AUDIT-2026-07-01-M01` fix protects the jackpot (`jackpotReserve > 0` blocks ShareOFT
withdrawal) but **not** `pendingFees`, which is also ShareOFT held for the burn/voter/treasury/
lottery split. Whenever `jackpotReserve == 0` (e.g. before the first `_distribute`), the owner can
withdraw all pending, not-yet-distributed protocol/voter/burn value.

**Exploit path.** As in M-1 step 1–2, but the impact framing is *value seizure* of fees owed to the
burn/voter routing rather than only a DoS. Combined with M-1 it also bricks the contract.

**Remediation.** Extend the guard: block (or account for) ShareOFT withdrawals while
`pendingFees > 0` as well as while `jackpotReserve > 0`; only allow withdrawing the genuine
"unaccounted surplus" (`balanceOf(this) - accountedOFTBalance`).

---

## M-3 — No consistency validation across `setVault` / `setWrapper` / `setAgentToken`

**Contract:** `AgentGaugeController.sol`

**Detail.** The WETH path does `agentToken.forceApprove(vault, x); vault.deposit(x, this)` and the
burn/wrap paths rely on `wrapper` unwrapping ShareOFT into *this specific* `vault`'s shares. The
setters only check non-zero addresses; they never verify `vault.asset() == address(agentToken)` or
that `wrapper.vaultShares() == address(vault)` / `wrapper` corresponds to `shareOFT`. A wrong (but
non-zero) address passes silently.

**Exploit path.** Misconfiguration (or a partial migration) leaves `agentToken`/`vault`/`wrapper`
mutually inconsistent → `vault.deposit` reverts (funds stuck as pending) or, worse, unwraps/deposits
against a mismatched vault, mis-routing value. No theft required — an operator mistake strands fees.

**Remediation.** In each setter, cross-check the linkage: `IAgentOVault(_vault).asset() ==
address(agentToken)` and `IAgentOVaultWrapper(_wrapper).vaultShares() == address(vault)`; revert on
mismatch. Where ordering makes this impossible at set-time, validate at first use.

---

## M-4 — Router swaps rely solely on caller-supplied `minOut`

**Contract:** `AgentRevenueRouter.sol` — `_convertAndQueue`, `_convertViaExternalAndQueue`

**Detail.** Both the Uniswap-V3 path and the allowlisted-aggregator path use only the
`minOut`/`minOut`+overspend guard supplied by the `owner`/`keeper`. There is no independent oracle
bound. This is acceptable *only* under full trust of the keeper; a compromised keeper can pass
`minOut = 1` and sandwich the swap, or route through an allowlisted target with adversarial
`swapCallData`.

Positive observations (defense present): `_requireSafeExternalSwapAddress` blocks self/vault/
wrapper/burnStream/agentToken/shareOFT from being an approved target/spender; approvals are set to
the exact `amountIn` and reset to `0` after the call; an overspend check (`before - after > amountIn`)
bounds `tokenIn` outflow; `nonReentrant` guards all entrypoints; failed external calls bubble up via
`_revertWithBytes`.

**Exploit path.** Keeper key compromise → economically-lossy swaps within the (large) `tokenIn`
budget, extracting value as MEV while satisfying a trivial `minOut`.

**Remediation.** Treat the keeper as a lower-trust role: enforce an on-chain oracle-derived floor on
`minOut` (as `AgentGaugeController` does for WETH), or bound per-call/per-epoch `amountIn`, and keep
the keeper role behind monitoring. At minimum document the keeper trust assumption explicitly.

---

## L-1 — `_claimProtocolRewards` treats any successful low-level call as a claim

**Contract:** `AgentRevenueRouter.sol`

**Detail.** `_claimProtocolRewards` fires `withdraw(address,uint256)` (`0xf3fef3a3`) then, on failure,
`0x9f1d9267`, and only checks the boolean `ok`. If `protocolRewards` has a permissive fallback (or
the selector maps to a view/no-op), `ok == true` and `ProtocolRewardsClaimed(msg.sender, amount)` is
emitted even though no tokens moved. No return-value / balance-delta check is performed. Because
`protocolRewards` is validated to have code at deploy and is a fixed, trusted contract, impact is low
(misleading event / accounting confusion, not theft).

**Remediation.** Measure the received-asset balance delta and assert it is `>= amount` (or `> 0`);
emit the *actual* claimed amount. Avoid the blind two-selector fallback — pin the correct interface.

---

## L-2 — Minor hardening

- `AgentGaugeController.setSwapConfig` accepts any `uint24 _feeTier`; an invalid tier bricks WETH
  processing until reset. Restrict to the supported set (100/500/3000/10000).
- `AgentGaugeController.emergencyWithdraw` lacks `nonReentrant` (all other state-mutating externals
  have it). Owner-only, but add it for consistency / defense-in-depth.
- `AgentRevenueRouter.emergencyWithdraw` correctly protects `agentToken`/`shareOFT`/`weth`; note WETH
  can then only leave via a configured swap path — ensure a path exists or WETH can be stranded.

---

## L-3 / Info — `AgentOVaultTaxAdapter` accrual trust

`onBuyTax` / `onSellTax` add caller-supplied `amount` to `totalBuyTaxAccrued` /
`totalSellTaxAccrued` for any `authorizedCallers[msg.sender]` (or owner). These are analytics
counters that move no funds, but a compromised authorized caller can arbitrarily inflate them, and
any downstream keeper logic that trusts these totals should not assume they are tamper-proof. Keep
the authorized set minimal; treat the counters as untrusted for value-bearing decisions.

## I-1 — Informational

- **Jackpot rescue coupling:** ShareOFT `emergencyWithdraw` is blocked while `jackpotReserve > 0`,
  and `payJackpot` is `onlyLotteryManager`. Rescue of jackpot ShareOFT is therefore only possible by
  the owner temporarily setting `lotteryManager` to a controlled address — workable, but couples an
  emergency path to a routing role; document it.
- **ETH `receive()` attribution:** `AgentGaugeController.receive()` emits
  `WETHFeesReceived(msg.sender, msg.value)` after wrapping; `msg.sender` is the ETH sender, not
  necessarily the tax hook — off-chain accounting keyed on `from` may misattribute.
- **Accounting model (positive):** The `accountedOFTBalance` model (G-11) correctly prevents
  `receiveBridgedFees` from sweeping jackpot ShareOFT, and the OFT distribution path keeps
  `accountedOFTBalance == pendingFees + jackpotReserve` consistent across lottery/voter/treasury/burn
  branches. The only breakages of that invariant are the owner `emergencyWithdraw` paths (M-1/M-2).

---

## Notes on methodology / residual risk

- Reentrancy: all externally-callable state-mutating functions in both routers use `nonReentrant`;
  external calls (aggregator, distributor, wrapper, swap router, protocol rewards) are made after or
  around balance-delta checks. No reentrancy issue was identified beyond the trust assumptions above.
- Fee-split math: constants sum to `MAX_BPS` (asserted in constructor); remainder-based `toBurn`/
  `toVoters` computation avoids rounding leakage.
- The correctness of value routing ultimately depends on the trusted external contracts (vault,
  wrapper, oracle, distributor, lottery manager) behaving as assumed; those are out of scope.
