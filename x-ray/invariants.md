# Invariant Map

> 4626 | 10 guards | 10 inferred | 3 not enforced on-chain

---

## 1. Enforced Guards (Reference)

#### G-1
`require(msg.sender == params.owner, NotOwner())` · `contracts/helpers/batchers/DeploymentBatcher.sol` · Ensures only declared creator owner can execute phase transactions.

#### G-2
`require(weightBps <= 10_000, InvalidWeight())` · `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` · Prevents invalid strategy weight domain overflow.

#### G-3
`require(totalStrategyWeight <= 10_000, InvalidWeight())` · `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` · Keeps aggregate allocation bounded to 100%.

#### G-4
`require(strategyAsset == _creatorCoin(), StrategyAssetMismatch())` · `contracts/vault/modules/CreatorOVaultStrategiesModule.sol` · Blocks strategy insertion with wrong underlying asset.

#### G-5
`require(feeBps <= MAX_FEE_BPS)` · `contracts/utilities/messaging/CreatorShareOFT.sol` · Caps transfer tax and prevents confiscatory fee settings.

#### G-6
`require(!usedReportIds[reportId], Replay())` · `contracts/vault/strategies/SolanaStrategy.sol` · Prevents replay of remote NAV reports.

#### G-7
`require(block.timestamp <= deadline, Expired())` · `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol` · Enforces signed/epoch action freshness.

#### G-8
`require(msg.sender == gaugeController, OnlyGaugeController())` · `contracts/vault/modules/CreatorOVaultCoreModule.sol` · Restricts burn path to configured gauge only.

#### G-9
`require(authorizedDeployers[msg.sender] || msg.sender == owner(), Unauthorized())` · `contracts/factories/UniversalCreate2DeployerFromStore.sol` · Restricts CREATE2 deploy permissions.

#### G-10
`require(maxNavDeltaBpsPerUpdate <= 10_000)` · `contracts/vault/strategies/SolanaStrategy.sol` · Bounds per-update NAV jumps.

---

## 2. Inferred Invariants (Single-Contract)

#### I-1

`Conservation` · On-chain: **Yes**

> Vault-share accounting remains symmetric: shares minted/burned track user share balances and total supply.

**Derivation** — Δ-pair across `deposit/mint/withdraw/redeem` in `contracts/vault/modules/CreatorOVaultCoreModule.sol` (`Δ(totalSupply)` with matching user share deltas).

**If violated** — Share price and redeemability can drift, enabling dilution or trapped value.

---

#### I-2

`Bound` · On-chain: **Yes**

> Strategy weights never exceed 100% aggregate allocation.

**Derivation** — guard-lift from `addStrategy/setStrategyWeight` with writes to `totalStrategyWeight` in `contracts/vault/modules/CreatorOVaultStrategiesModule.sol`.

**If violated** — Over-allocation can force unsafe rebalance behavior and accounting breaks.

---

#### I-3

`Bound` · On-chain: **Yes**

> ShareOFT transfer fee remains within protocol max cap.

**Derivation** — guard-lift from fee setter checks in `contracts/utilities/messaging/CreatorShareOFT.sol`; all fee write-sites route through guarded setters.

**If violated** — User transfers can be over-taxed and fee routing economics break.

---

#### I-4

`StateMachine` · On-chain: **Yes**

> Deployment phases progress in order and cannot be arbitrarily skipped.

**Derivation** — edge checks in `contracts/helpers/batchers/DeploymentBatcher.sol` for phase state transitions and phase-completion gates.

**If violated** — Partially deployed systems can expose broken ownership/config surfaces.

---

#### I-5

`Temporal` · On-chain: **Yes**

> AMOE proof submissions are time-bounded and nonce/deadline constrained.

**Derivation** — temporal predicates in `contracts/utilities/lottery/zk/LotteryAmoeRouter.sol` around `deadline` and epoch windows.

**If violated** — Stale signatures/proofs could be replayed outside intended windows.

---

#### I-6

`Bound` · On-chain: **No**

> All sponsorship policy changes in lottery manager are owner-scoped and delegatecall-scoped.

**Derivation** — guard-lift mismatch: both unrestricted wrapper signatures and `onlyDelegateCall onlyOwner` versions exist in `contracts/utilities/lottery/CreatorLotteryManager.sol`.

**If violated** — Mis-routed calls could hit weaker gates depending on call context.

---

## 3. Inferred Invariants (Cross-Contract)

#### X-1

On-chain: **Yes**

> Gauge burn path assumes vault burn entrypoint is callable only by configured gauge.

**Caller side** — `contracts/governance/CreatorGaugeController.sol` invokes burn-related hooks for rewards/price support.

**Callee side** — `contracts/vault/modules/CreatorOVaultCoreModule.sol` enforces `OnlyGaugeController` before burn path state writes.

**If violated** — Unauthorized external actors could burn/manipulate vault share state.

---

#### X-2

On-chain: **No**

> Registry/phase completion assumes all critical address wiring is coherent across batcher, gauge, OFT, and oracle.

**Caller side** — completion/invariant checks route via deployment phase assertions and registry references.

**Callee side** — mutable setter paths across `CreatorGaugeController`, `CreatorShareOFT`, `CreatorOracle`, and batcher-owned setup contracts can diverge post-deploy.

**If violated** — Fees, lottery payouts, and cross-chain accounting can route to stale/wrong endpoints.

---

#### X-3

On-chain: **Yes**

> Solana strategy NAV updates assume bridge adapter + keeper path provide unique report IDs.

**Caller side** — bridge/keeper submits report data into `SolanaStrategy` update functions.

**Callee side** — `usedReportIds` replay guard and NAV delta constraints in `contracts/vault/strategies/SolanaStrategy.sol`.

**If violated** — NAV can be replayed/manipulated, causing mis-priced vault accounting.

---

## 4. Economic Invariants

#### E-1

On-chain: **Yes**

> Productive allocation cannot exceed total vault capital budget.

**Follows from** — `I-2` + `I-1`

**If violated** — Strategy debt can overrun available assets and break withdrawals.

---

#### E-2

On-chain: **No**

> Cross-chain fee/lifecycle settlement remains fully coherent after governance/config changes.

**Follows from** — `X-2` + `I-3`

**If violated** — Burn/lottery/protocol lanes can drift from expected economic split.

