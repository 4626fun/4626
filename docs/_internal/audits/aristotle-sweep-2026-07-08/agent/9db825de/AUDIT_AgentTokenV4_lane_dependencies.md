# Cross-check audit — AgentTokenV4 lane dependencies

Scope: the agent surface that hangs off an external `AgentTokenV4` token —
`vault/` (AgentOVault, AgentOVaultCoreModule, AgentOVaultWrapper, AgentShareOFT),
`revenue/` (AgentGaugeController, AgentRevenueRouter, AgentRevenuePolicyController,
AgentOVaultTaxAdapter), `oracles/AgentOracle.sol`, and `interfaces/`.

Focus areas requested: **lane-parity drift**, **measured-transfer assumptions**, and
**privileged control paths**. `AgentTokenV4` itself is not in this repo (ABI-only via
`IAgentTokenV4`), so every dependency on it is a *trust/cooperation boundary* and is
called out as such.

Nothing here is machine-checked — this is a manual review. Severities are the auditor's
judgement and should be triaged against deployment configuration.

---

## Map of AgentTokenV4 dependencies (the "lanes")

| Consumer | How it depends on the agent token | Transfer model assumed |
|---|---|---|
| `AgentOVaultCoreModule.deposit` | pulls agent token, **measures** `received = balAfter-balBefore`, prices shares off the measured amount | measured / fee-on-transfer safe |
| `AgentOVaultCoreModule.mint`/`injectCapital` | inherits base **exact-transfer** path; reverts `TransferAmountMismatch` under FOT (documented) | exact |
| `AgentOVaultWrapper.deposit`/`depositFor` | pulls agent token from user, then `vault.deposit(**amount**, …)` | **nominal (not measured)** — see M-1 |
| `AgentRevenueRouter` (direct agent-token path) | `vault.deposit(agentAmount, burnStream)` from its **own** balance, uses **returned shares** | measured-consistent |
| `AgentGaugeController._processWETHFees` | swaps WETH→agent token, `vault.deposit(agentTokenReceived, this)`, uses **returned shares** | measured-consistent |
| `AgentRevenuePolicyController` | calls `agentToken.setProjectTaxRecipient(router)` (owner-gated on the token) | privileged cooperation — see M-2 |
| `AgentOVaultTaxAdapter` | `onBuyTax`/`onSellTax` accrual counters, `amount` is caller-reported | trusts reported amount — see L-1 |
| `AgentOracle` | prices the agent token via V4/V3/V2 TWAP + Chainlink | oracle assumptions — see H-1/M-3 |

Parity observation: three independent deposit call-sites re-implement the inflow into the
vault. Two of them (router, gauge) are correct because they consume the vault's **returned**
share amount; the wrapper is the odd one out (M-1). The measured-transfer contract only lives
inside the core module — every caller in front of it must respect it, and one does not.

---

## HIGH

### H-1 — Slippage oracle freshness gate does not cover the TWAP source actually used
`revenue/AgentGaugeController.sol` · `_calculateMinOutput` / `previewSwap`
`oracles/AgentOracle.sol` · `isPriceFresh`, `getAssetEthTWAP`, `getTWAPTick`, `_findObservationBefore`

`_calculateMinOutput` computes the swap floor as:

```solidity
try oracle.isPriceFresh() ... if (!fresh) return 0;
try oracle.getAssetEthTWAP(oracleTwapDuration) returns (uint256 agentPerEth) { ... }
```

but the two calls read **different, independent** data:

* `isPriceFresh()` = `assetPriceUSD > 0 && block.timestamp - assetPriceTimestamp < MAX_STALENESS`
  — freshness of the **LZ-broadcast USD price** only.
* `getAssetEthTWAP()` = `tickToPrice(getTWAPTick(duration))` — derived purely from the **V4 pool
  observation ring**, with **no** tie to `assetPriceTimestamp`.

So the freshness gate does not validate the feed that produces `minOut`. Worse, `getTWAPTick`
has no minimum-window / max-age enforcement: when no observation older than `duration` exists,
`_findObservationBefore` silently returns the oldest initialized observation, **shortening the
effective TWAP window** (a shorter window is cheaper to manipulate). An operator can keep
`assetPriceUSD` fresh via `updateAssetPrice` broadcasts while the V4 observation array is stale
or sparse, and the swap in `_processWETHFees` will still run with a manipulable/short-window
`minOut` even though `useOracleSlippage == true`.

Impact: sandwich / MEV extraction on the permissioned-but-public WETH→agent-token swap despite
apparent slippage protection.

Recommendation: gate the swap on the recency of the **observation ring** actually used
(`_hasRecentObservationWindow` already exists — use it in `_calculateMinOutput`), and make
`getTWAPTick` enforce a minimum realized window (revert or fail-closed instead of silently
shrinking) so the controller returns `0` (fail-closed) when the TWAP is under-sampled.

### H-2 — Hardcoded cross-chain wiring authority controls bridge trust on remote lanes
`vault/AgentShareOFT.sol` · `REMOTE_PROTOCOL_WIRE_AUTHORITY = 0x7d42…f2d3`,
`onlyOwnerOrRemoteProtocolWire`, `setPeer`, `setHubConfig`, `setHubLotteryPeer`

On every non-Base chain, a single hardcoded address may set LayerZero **peers**, hub config,
and the hub lottery peer. Peer configuration is the root of LZ message trust: with it, that key
can point a spoke's peer at an attacker contract, which then feeds `_lzReceive` — the same
entrypoint that (a) drives `_handleRemoteFeeFlushCommand` (spends the spoke's native balance to
OFT-send pending fees) and (b) emits `LotteryWinnerNotification` winner callbacks. Compromise of
this one key subverts the fee-flush and winner-callback paths on all remotes.

This is a deliberate design (hub batcher can't exist off-Base), but it is an unrotatable,
single-key privileged path baked into bytecode. Recommendation: make the wire authority a
constructor/immutable parameter (per-deployment), or a role behind a multisig with an on-chain
event trail, rather than a hardcoded constant; document key-management and rotation.

---

## MEDIUM

### M-1 — Wrapper deposit is not measured-transfer aware (lane-parity drift + FOT DoS/double-tax)
`vault/AgentOVaultWrapper.sol` · `deposit`, `deposit(amount,minOut)`, `depositFor`

```solidity
agentToken.safeTransferFrom(msg.sender, address(this), amount); // wrapper receives amount - tax
uint256 vaultShares = vault.deposit(amount, address(this));     // pulls `amount` from wrapper
```

The wrapper forwards the **nominal** `amount` to the vault, not what it actually received. The
`AgentOVault` core module was purpose-built for measured / fee-on-transfer tokens
(`_pullAgentTokenMeasured`), yet the wrapper — the primary UX front door — is not FOT-aware:

* If the user→wrapper transfer is taxed, the wrapper holds `amount - tax` but tries to hand the
  vault `amount` → `safeTransferFrom` reverts → the main deposit path is a **DoS** for exactly
  the taxed tokens the vault advertises support for.
* Even when it succeeds, value is taxed **twice** (user→wrapper, then wrapper→vault) versus a
  direct `vault.deposit`, so wrapper depositors get systematically fewer shares.

This is the central lane-parity/measured-transfer inconsistency: router and gauge deposit from
their own balances and consume the vault's returned share count (correct); the wrapper does not.

Recommendation: measure the wrapper's own receipt
(`received = agentToken.balanceOf(this) after - before`) and call `vault.deposit(received, …)`;
compute `_wrapInternal` off the vault's returned shares (already done). Note: if AgentTokenV4
only taxes LP buys/sells and the wrapper is never a classified pool, normal EOA deposits are
untaxed and this stays latent — hence Medium, not High — but the stated "deposit is the
supported inflow for taxed assets" guarantee is not honored end-to-end.

### M-2 — Revenue lane silently depends on protocol owning the agent token
`revenue/AgentRevenuePolicyController.sol` · `enforceProjectTaxRecipient`
`interfaces/IAgentTokenV4.sol` · `setProjectTaxRecipient` (owner-gated on the token)

`enforceProjectTaxRecipient()` calls `agentToken.setProjectTaxRecipient(router)`. On
AgentTokenV4 that setter is owner-gated. Therefore:

* If the policy controller (or its owner) **is** the agent token's owner/authorized setter, the
  protocol has full control over the token's `projectTaxRecipient` and `taxAccountingAdapter` —
  a strong privileged control path over an "external" token that should be disclosed.
* If it is **not**, `enforceProjectTaxRecipient` reverts and the entire agent-revenue lane
  (router → burn stream → PPS) silently never receives tax. There is no on-chain assertion that
  the wiring actually took effect.

The same cooperation assumption governs the WETH tax hook: the `SimpleSellTaxHook`
(`0xca97…0088`) checks `msg.sender == token.owner()`, so only the token owner can route WETH tax
to the gauge controller (`getTaxHookParams` merely returns the parameters for that off-chain
call). The whole `receiveWETHFees`/`_processWETHFees` lane is dead until the token owner does so.

Recommendation: document the ownership/authority the protocol must hold over each AgentTokenV4,
and add a post-wire read-back check (e.g. assert `agentToken.projectTaxRecipient() == router`)
so misconfiguration fails loudly instead of producing a silently-inert revenue lane.

### M-3 — Swap venue ≠ oracle venue for the WETH→agent-token conversion
`revenue/AgentGaugeController.sol` · `_processWETHFees`, `_sqrtPriceLimitX96`, `_calculateMinOutput`

`minOut` and `sqrtPriceLimitX96` are derived from the **oracle's V4 pool** TWAP, but the swap is
executed against a separately-configured Uniswap **V3** pool (`SWAP_ROUTER`, `swapFeeTier`).
If the two venues diverge in price, decimals, or token ordering, the protection is either too
loose (MEV headroom) or causes spurious reverts. `_sqrtPriceLimitX96` also assumes the swap pool
shares the WETH/agent-token ordering used to build the bound.

Recommendation: derive the price bound from the pool actually being swapped (or assert the
configured swap pool == the oracle's priced pool), and unit-test the token0/token1 orientation
and decimals across both venues.

---

## LOW / INFORMATIONAL

* **L-1 — Tax adapter trusts caller-reported amounts.**
  `revenue/AgentOVaultTaxAdapter.sol` `onBuyTax`/`onSellTax` add `amount` to accruals and emit
  `AgentRevenueAccrued` with no verification against a real transfer and no check that the caller
  is the agent token. Any `authorizedCaller` can emit spoofed analytics. Analytics-only (no funds
  move), but downstream keepers/indexers keying on the event should not treat it as authoritative.

* **L-2 — Sequencer check fails open when unset.**
  `oracles/AgentOracle.sol` `_sequencerIsUp` returns `true` when `sequencerUptimeFeed == 0`. On an
  L2 deployment that forgets `setSequencerUptimeFeed`, sequencer-down protection is silently off.
  Consider requiring the feed on L2 chain-ids.

* **L-3 — `getTWAPTick` has no minimum realized window.** Root cause feeding H-1; listed
  separately because it also affects any external `getAssetEthTWAP`/`getAssetUsdTWAP` consumer.

* **L-4 — ShareOFT buy-fee plane is buy-only and classification-dependent.**
  `vault/AgentShareOFT.sol` `_transferWithFees` taxes only `SwapOnly → non-SwapOnly`. Fees are
  entirely dependent on correct `addressType` classification of venues via `setAddressType`
  (owner-gated); a missing/incorrect classification silently disables fees for that venue. This is
  asymmetric with AgentTokenV4's own buy+sell tax — ensure the two tax planes are intentionally
  distinct and monitored.

* **I-1 — Owner price powers.** `initializeAssetPrice` (one-shot, bounded) and
  `forceSyncRemotePrice` (remote-only, bounded, monotonic timestamp) are owner-gated escape
  hatches; behavior is bounded and documented but should sit behind the protocol multisig.

---

## Things that check out

* Core module measured deposit (`_pullAgentTokenMeasured`) correctly rejects `received > amount`
  (reflexive/rebasing-up), reverts on zero receipt, and prices shares off the pre-transfer
  snapshot with the same `_decimalsOffset()=3` virtual offsets as ERC4626 (`1000`/`1`). `mint`/
  `injectCapital` fail-closed under FOT by design.
* Router and gauge deposit flows consume the vault's **returned** share count, so they inherit
  measured accounting correctly (contrast with M-1).
* Gauge `emergencyWithdraw` protects `shareOFT` while `jackpotReserve`/`pendingFees` are non-zero
  and `WETH` while `pendingWETHFees` non-zero; `_validateCoreWiring` binds vault.asset==agentToken
  and wrapper.vaultShares==vault.
* ShareOFT `burn` requires allowance for non-vault/non-owner minters (H-3), winner callbacks are
  guid-deduplicated and structurally validated, `_lzReceive` on the oracle pins `origin.srcEid ==
  BASE_EID`, and remote price updates are out-of-order-guarded and deviation-clamped.
* Fee-split constants are asserted to sum to `MAX_BPS` and the gauge asserts Base chain-id at
  construction.
