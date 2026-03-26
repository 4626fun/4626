# 1. Executive Summary

The implemented system is a multi-lane value router, not a single "fee bucket" design. Genesis creator allocation is created in deployment flow and funded into `CreatorLinearVesting`; trading fees flow into `CreatorGaugeController` and are resolved in vault-share units across burn/jackpot/creator/voter-or-protocol branches; external creator earnings can be routed through `PayoutRouter` into `VaultShareBurnStream`; jackpot payout authority is separated from jackpot custody (manager-authorized, gauge-custodied).

The largest naming/semantics issue is `payoutRecipient` overloading. In practice, `CreatorShareOFT.payoutRecipient()` is a trade-fee sink hint for external hooks, while `CreatorCoin.setPayoutRecipient(...)` is an external-revenue routing control. These are different lanes but are named as if they are the same lane, which causes integration drift.

The largest docs-vs-code mismatch is fee policy communication: several docs/readmes/comments describe "buys and sells" and obsolete split ratios, while current Solidity behavior is buy-side fee logic in `CreatorShareOFT` plus separately configured hook behavior for sell-side (and possibly additional behavior depending on hook implementation).

The largest operational/configuration risk is recipient and hook misconfiguration at launch/activation boundaries: fee recipient, hook recipient, gauge wiring, payout recipient choice, and post-launch hook config are distributed across different contracts and operational steps. If not enforced as a single invariant set, value can be misrouted, trapped, or economically mis-accounted.

# 2. Scope Freeze

| Source | Branch/commit reviewed | Files reviewed | Missing / inaccessible | Why it matters |
|---|---|---|---|---|
| Local repo `/home/akitav2/projects/4626` | `codex/footprint-reporting-20260324` @ `66a4991159b11f312407b3889a2110aac74cc8e0` | `contracts/utilities/messaging/CreatorShareOFT.sol`, `contracts/governance/CreatorGaugeController.sol`, `contracts/utilities/routers/PayoutRouter.sol`, `contracts/utilities/routers/VaultShareBurnStream.sol`, `contracts/utilities/vesting/CreatorLinearVesting.sol`, `contracts/utilities/lottery/CreatorLotteryManager.sol`, `contracts/governance/VoterRewardsDistributor.sol`, `contracts/vault/strategies/CCALaunchStrategy.sol`, `contracts/vault/CreatorOVault.sol`, `contracts/vault/CreatorOVaultWrapper.sol`, `contracts/helpers/batchers/DeploymentBatcher.sol`, `README.md`, `frontend/README.md`, `docs/contracts/strategies/cca-launch.md` + key docs/scripts/tests | None for this scoped repo | This is the canonical audited codebase for this report. |
| External repo reference in original prompt (`CreatorVault`) | Not reviewed (user scope choice: local `4626` only) | N/A | Entire external repository not in this audit scope | Claims originating only from external repo/docs remain out of scope here. |
| External deployed dependencies | N/A | Interface-level only (`CreatorCoin` payout recipient methods, external tax hook contracts at configured addresses) | Full source for deployed CreatorCoin implementation and hook implementations not audited in this repo | Some conclusions are config/integration-conditional and cannot be proven from local Solidity alone. |

Provisional conclusions depend on deployment/runtime config for: `addressType` tagging, hook activation and fee config, `CreatorCoin` payout recipient, `voterRewardsDistributor` setup, and whether burn-stream/router post-phase wiring was successfully executed.

# 3. Canonical Value-Lane Map

| Lane | Source of value | Token/unit | First recipient | Transformations | Final destination | Main authority |
|---|---|---|---|---|---|---|
| A. Genesis creator allocation | Initial wrapped share supply minted in phase finalize | `shareOFT` | `CreatorLinearVesting` | `DeploymentBatcher` split (40/40/20 default policy), transfer to vesting wallet, linear release | `CreatorLinearVesting.beneficiary` | Deployment path + vesting constructor params |
| B. shareOFT trading-fee flow | DEX transfer pattern recognized as buy (`SwapOnly -> non-SwapOnly`) and optional external hook lane | `shareOFT` on native lane; `WETH` on hook lane; split in `vaultShares` | Native: `CreatorShareOFT` then `CreatorGaugeController`; Hook: `CreatorGaugeController` | Native: fee collect -> `receiveFees` -> `wrapper.unwrap` -> split. Hook: `receiveWETHFees` -> swap to creator coin -> `vault.deposit` -> split | Burn, jackpot reserve, optional creator treasury, voter/protocol branch | `CreatorShareOFT` owner config + gauge owner config + hook config owner |
| C. External creator-payout / revenue routing | External earnings sent to configured recipient (if routed to `PayoutRouter`) | arbitrary ERC20 / ETH in, creator coin mid-hop, vault shares queued | `PayoutRouter` | optional swap (`exactInput`) -> `vault.deposit(..., burnStream)` -> `queueShares` -> epoch `drip/checkpoint` burns | PPS accretion to all vault share holders over time | `PayoutRouter` owner/keeper + burn stream permissionless callers |
| D. Post-fee destination resolution | Shares produced from lane B conversions | `vaultShares` | `CreatorGaugeController` internal splitter | burn now, reserve jackpot, optional creator transfer, voter distributor or treasury fallback | PPS increase, jackpot reserve, creator treasury (if enabled), voter/protocol path | `CreatorGaugeController` owner + dependent recipient contracts |

# 4. Contract-by-Contract Product Truth

## CreatorShareOFT

- **What it actually does**
  - Implements OFT share token transfer accounting and native fee logic keyed by `OperationType`.
  - Charges native fee only on `SwapOnly -> non-SwapOnly` transfers (`_transferWithFees` / `_processBuy`).
  - Routes native fees to gauge (`_sendFeesToGauge`) in hub mode; accumulates `pendingFees` in remote mode for explicit `flushFees`.
  - Exposes `getTaxHookParams` and `payoutRecipient()` to point external hook systems at gauge/owner.
- **What it does not do**
  - Does not natively charge a sell fee on `non-SwapOnly -> SwapOnly` transfers.
  - Does not auto-execute hook configuration; only returns params/hints and accepts owner config.
  - Does not enforce global "all DEX trades taxed" without correct `addressType` registration.
- **Likely misunderstanding**
  - Teams read "6.9% buy + sell" as fully native token logic, but code is buy-side native plus external-hook-dependent sell path.

## CreatorGaugeController

- **What it actually does**
  - Receives OFT fees (`receiveFees`, `receiveBridgedFees`) and WETH fee lane (`receiveWETHFees`, `processWETHFees`).
  - Converts fee inputs into vault-share outcomes and applies split in `_distributeVaultShares`.
  - Custodies jackpot reserve accounting in `jackpotReserve` and pays winners via `payJackpot` (lottery manager authorized).
- **What it does not do**
  - Does not itself determine trade-type eligibility; that comes from upstream token/hook behavior.
  - Does not guarantee creator direct payout unless `creatorShareBps > 0` and `creatorTreasury` set.
- **Likely misunderstanding**
  - "Protocol share" naming implies treasury-only route, but code prefers `voterRewardsDistributor` first.

## CreatorLotteryManager

- **What it actually does**
  - Computes lottery eligibility/probability and executes payout calls across all active creators.
  - Uses gauge interfaces (`getJackpotReserve`, `payJackpot`) to execute payouts.
- **What it does not do**
  - Does not custody jackpot balances.
  - Does not split fees.
- **Likely misunderstanding**
  - Often treated as jackpot vault/custodian; in code it is payout orchestrator with authorization, not reserve holder.

## PayoutRouter

- **What it actually does**
  - Accepts payout assets, optionally swaps to creator coin, deposits into vault, queues resulting vault shares into burn stream.
  - Restricts processing to owner/keeper (`onlyOwnerOrKeeper`) and supports emergency withdraw.
- **What it does not do**
  - Does not split trade fees or feed jackpot directly.
  - Does not provide direct creator spendable cash on `convertAndQueue`; output path is PPS accretion.
- **Likely misunderstanding**
  - "Payout recipient" sounds like direct creator cash sink, but default happy path is conversion to holder-wide PPS improvement.

## VaultShareBurnStream

- **What it actually does**
  - Ownerless, non-withdrawable queue/drip burn schedule for vault shares.
  - Queues to next epoch and burns linearly over weekly epochs.
- **What it does not do**
  - Does not custody arbitrary payout tokens.
  - Does not perform swaps or route creator treasury transfers.
- **Likely misunderstanding**
  - Assumed immediate burn engine; actual semantics are epoch-based and keeper-sensitive for smoothness.

## CreatorLinearVesting

- **What it actually does**
  - Generic linear vesting wallet enforcing token address, beneficiary, start timestamp, duration.
  - `release()` sends releasable amount to beneficiary.
- **What it does not do**
  - Does not hardcode 40% allocation.
  - Does not hardcode one-year duration.
  - Does not enforce only-beneficiary caller (anyone can trigger release to beneficiary).
- **Likely misunderstanding**
  - "40% for 1 year" is assumed contract invariant; in code it is a deployment policy.

## CCALaunchStrategy

- **What it actually does**
  - Runs CCA launch lifecycle and migrates graduated auction to V4 pool with configured hook.
  - Stores hook recipient/rate config (`feeRecipient`, `taxRateBps`) and exposes calldata helpers for hook config call.
- **What it does not do**
  - Does not itself execute hook `setTaxConfig` automatically in migration path.
  - Does not enforce that hook recipient is synchronized with other fee sink settings at all times.
- **Likely misunderstanding**
  - Teams assume migration automatically enables/updates tax hook; in code it requires an explicit separate call path.

# 5. Actual Funds Flow

## Genesis creator allocation

1. `DeploymentBatcher._finalizePhase2Internal` deposits creator coin into wrapper (`wrapper.deposit`) and receives `shareTokens`.
2. `shareTokens` are split by deploy-policy constants: 40% auction, 40% vesting, 20% LP reserve.
3. Vesting leg deploys `CreatorLinearVesting(params.shareOFT, params.owner, block.timestamp, 365 days)`.
4. `vestingAmount` of `shareOFT` transfers into vesting contract.
5. Beneficiary receives linearly via `CreatorLinearVesting.release()`.

## shareOFT trade fees (native transfer lane)

1. `CreatorShareOFT.transfer/transferFrom` calls `_transferWithFees`.
2. Fee path only triggers when `fromType == SwapOnly` and `toType != SwapOnly`.
3. Fee amount (`buyFeeBps`, default 690) moves to token contract; net moves to recipient.
4. `_routeFees`:
   - hub mode: `_sendFeesToGauge` (`approve` + `receiveFees` call; fallback direct transfer on catch),
   - remote mode: increment `pendingFees`, later `flushFees` to hub receiver.
5. In gauge, OFT fees accumulate in `pendingFees`.
6. Distribution path unwraps OFT via wrapper into vault shares and applies `_distributeVaultShares`.

## External hook WETH fees

1. Hook-side flow sends WETH (or ETH -> wrapped in `receive()` path) to gauge `receiveWETHFees`.
2. `pendingWETHFees` increases; processing depends on keeper/owner/cap config.
3. `processWETHFees` swaps WETH -> creator coin with oracle-based min-out.
4. Creator coin deposits into vault (`vault.deposit`), minting vault shares to gauge.
5. Same `_distributeVaultShares` split logic executes on resulting vault shares.

## External creator earnings

1. External earnings route into `PayoutRouter` (when configured as external payout recipient).
2. If ETH is sent, router wraps to WETH.
3. Owner/keeper calls `convertAndQueue(tokenIn, amountIn, minCreatorOut)`.
4. Router swaps `tokenIn` to creator coin if needed.
5. Router deposits creator coin into vault with receiver = burn stream.
6. Router queues minted vault shares in `VaultShareBurnStream`.
7. Burn stream starts/drips/checkpoints shares over epoch, burning into PPS accretion.

## Jackpot payout

1. Gauge accumulates lottery slice into `jackpotReserve` during fee distribution.
2. `CreatorLotteryManager._payoutLocalJackpot` loops active creator coins and reads gauge reserve.
3. Reward shares computed as `jackpotReserve * payoutBps / 10000` (default payoutBps 6900).
4. Lottery manager calls gauge `payJackpot(winner, rewardShares)`.
5. Gauge decreases reserve and transfers vault shares to winner.

## Voter rewards

1. Gauge computes protocol/voter branch (`toProtocol`) as remainder after burn/lottery/creator slices.
2. If `voterRewardsDistributor` configured, gauge sends vault shares to distributor via `notifyRewards`.
3. Distributor records rewards by `(epoch, vault)` and users claim pro-rata after epoch closes.
4. If distributor unset, gauge falls back to `protocolTreasury`; if also unavailable, fallback branch adds to jackpot.

## Creator ongoing treasury allocation

1. Creator ongoing lane exists only if `creatorShareBps > 0`.
2. If `creatorTreasury` is set, `toCreator` vault shares transfer there.
3. If `creatorTreasury` is unset, creator slice is rerouted to jackpot reserve.

## Vault-share burn path

1. **Immediate burn lane**: gauge burn slice calls `vault.burnSharesForPriceIncrease` in same distribution transaction.
2. **Streamed burn lane**: external earnings via router queue into burn stream and burn progressively over weekly epoch.

# 6. Documentation Drift Audit

| Source location | Current claim | Code reality | Severity | Fix needed |
|---|---|---|---|---|
| `frontend/README.md` | "6.9% fee: 90% to holders, 5% burned, 5% protocol" | Gauge defaults are 21.39% burn, 69% jackpot, 0% creator, 9.61% voter/protocol branch | Critical | Replace with live split or make explicit this is historical/legacy not current |
| `contracts/helpers/hooks/TaxHookConfigurator.sol` (header comment) | Gauge distributes 50% burn / 31% lottery / 19% creator | Gauge defaults do not match; comment is stale/misleading | High | Update/remove stale split comment and align to configurable source of truth |
| `README.md` fee flow section | "6.9% trading fee on buy + sell" | Native token fee code is buy-side (`SwapOnly -> non-SwapOnly`); sell-side depends on external hook config | High | Split docs into native fee plane vs hook fee plane and state config conditions |
| `docs/architecture/index.md` | "6.9% on all DEX trades (buys and sells)" and transfer-hook fee flow from `CreatorShareOFT` | `CreatorShareOFT` transfer logic does not natively tax sell pattern | High | Rewrite with explicit trigger matrix and external-hook caveat |
| `docs/tokenomics/index.md` | "6.9% on buys AND sells" as unconditional protocol truth | Conditional by hook activation/config; native path is buy-side only | High | Add canonical rule with conditions and deployment invariants |
| `docs/contracts/core/creator-share-oft.md` | "Collects 6.9% fee on all DEX trades" | Only specific address-type transitions are taxed natively | Medium | Replace with address-type matrix language |
| `cre/README.md` + `cre/cre-workflows/payout-integrity/main.ts` | CreatorCoin `payoutRecipient` must equal GaugeController | Frontend deploy flow attempts to set CreatorCoin payout recipient to `PayoutRouter` for external earnings lane | Critical | Decide canonical recipient model and update monitor/checks accordingly |
| `contracts/governance/CreatorGaugeController.sol` comment near burn block | "Burn shares ... disabled by default" | `burnShareBps` default is 2139, so burn path is active by default | Medium | Update comment to reflect actual default |
| `contracts/governance/CreatorGaugeController.sol` naming/comments | `protocolShareBps` described as platform ops | Code routes this branch first to `voterRewardsDistributor` if configured | Medium | Rename or document as "voter/protocol" branch |
| External claim from original prompt ("README says 100% fees to lottery") | Not found in scoped local repo root README | Local scoped docs reviewed here do not contain that exact current claim | Informational | Keep out-of-scope note; verify in external repo before carrying forward |

# 7. Config-Dependency Review

| Config field / address | Where set | Effect on business logic | Failure if unset/wrong |
|---|---|---|---|
| `gaugeController` (ShareOFT) | `CreatorShareOFT.setGaugeController`, wired in `DeploymentBatcher._deployPhase2Core` | Native fee sink for hub mode and `payoutRecipient()` default target | Hub fees can be trapped or misrouted; jackpot/voter/burn flow not fed correctly |
| `creatorTreasury` | Gauge constructor + `setCreatorTreasury` | Receives creator ongoing share when `creatorShareBps > 0` | Creator share silently reroutes to jackpot |
| `lotteryManager` | `CreatorGaugeController.setLotteryManager` | Only authorized caller for `payJackpot` | Jackpot reserve cannot be paid out via intended path |
| `voterRewardsDistributor` | `CreatorGaugeController.setVoterRewardsDistributor` | Receives voter/protocol branch first | Branch falls to protocol treasury instead of voters |
| `protocolTreasury` | Gauge constructor (non-zero required) + `setProtocolTreasury` (non-zero) | Fallback recipient when distributor unset | Under normal guards cannot be zero; if mis-set via nonstandard path, branch can reroute to jackpot |
| `burnShareBps` | Gauge default or `setFeeSplit` | Immediate vault-share burn amount | Wrong value changes holder accrual and jackpot funding balance |
| `lotteryShareBps` | Gauge default or `setFeeSplit` | Jackpot reserve accrual | Wrong value changes jackpot growth and lottery economics |
| `creatorShareBps` | Gauge default or `setFeeSplit` | Direct creator ongoing vault-share lane | At 0, creator direct lane disabled; if non-zero unexpectedly, creator captures share |
| `protocolShareBps` | Gauge default or `setFeeSplit` | Voter/protocol branch size | Wrong value alters governance rewards/protocol route economics |
| Payout recipient choices (`CreatorCoin` vs `CreatorShareOFT`) | `CreatorCoin.setPayoutRecipient` (batcher/UI owner calls), `CreatorShareOFT.payoutRecipient()` view | Decides whether external creator earnings go to router/gauge and where hooks send fees | Lane conflation/misrouting; monitor false positives; potential stranded assets |
| `router keeper` | `PayoutRouter.setKeeper` | Non-owner processing authority for convert-and-queue | External earnings can sit unprocessed if owner/keeper flow not operational |
| `swap paths` | `PayoutRouter.setSwapPath` | Enables tokenIn conversion to creator coin | `convertAndQueue` reverts (`PathNotSet`/slippage) or fails to process expected assets |
| `burnStream` | `CreatorOVault.setBurnStream` (one-time) | Enables enforceable streamed burn lane | Without burn stream wiring, external earnings lane not enforceably PPS-only |
| `vault` (Gauge) | `CreatorGaugeController.setVault` | Target vault for burn/deposit/price paths | Distribution and burn paths fail/revert |
| `wrapper` (Gauge) | `CreatorGaugeController.setWrapper` | OFT -> vault share conversion in OFT fee lane | Pending OFT fees cannot be distributed |
| `addressType` map | `CreatorShareOFT.setAddressType(s)` | Determines which transfers are taxed as buys | No/incorrect fee collection behavior by venue |
| Hook recipient/tax config | `CCALaunchStrategy.setOracleConfig`, then explicit hook `setTaxConfig` call | Determines sell/hook fee route and rate | Fee plane missing, wrong recipient, or inconsistent buy/sell charging |

# 8. Attack / Failure Scenarios

| Scenario | Preconditions | Failure path | User effect | Economic effect | Severity | Fix |
|---|---|---|---|---|---|---|
| 67. `creatorShareBps` left at 0 unintentionally | Governance expected creator ongoing share but did not update split | Gauge keeps creator lane disabled | Creator sees no direct treasury flow | Creator revenue model diverges from expectations | Medium | Enforce split policy check in deploy/ops scripts and dashboard alerts |
| 68. `creatorTreasury` unset | `creatorShareBps > 0` and treasury cleared/never set | `_distributeVaultShares` reroutes creator slice to jackpot | Creator receives no direct payout | Jackpot overfunded relative to intended creator lane | Medium | Block `creatorShareBps > 0` unless treasury set; add invariant monitor |
| 69. `voterRewardsDistributor` unset | Distributor not configured | Voter/protocol branch falls to protocol treasury | Voters cannot claim intended rewards | Governance incentive lane weakens, treasury capture increases | Medium | Require distributor before enabling target economics; preflight checks |
| 70. `protocolTreasury` unset | Nonstandard deployment/storage corruption | Fallback branch can route protocol slice to jackpot | Unexpected payout behavior | Protocol branch no longer routable as treasury fallback | Low | Keep non-zero constructor/setter guards; add invariant checks |
| 71. Jackpot assumed in lottery manager | Integrator treats manager as custodian | Attempts to read/move jackpot from wrong contract | Monitoring/accounting confusion | Wrong reserves reported; payout ops errors | High | Standardize docs: gauge is custodian, manager is authorized caller |
| 72. External payout recipient set to gauge instead of router | CreatorCoin payout recipient pointed to gauge | Non-fee external assets arrive in gauge lane | External earnings not processed as intended | Assets can be unprocessed/stranded or miss PPS burn stream lane | Critical | Separate recipient policies by lane; enforce recipient-type checks |
| 73. External payout recipient set to router instead of gauge (trade-fee lane confusion) | Hook or trade-fee sink incorrectly pointed at router | Router receives fee assets intended for gauge split | Jackpot/lottery/voter paths not funded correctly | Fee economics break; lottery underfunded | Critical | Enforce gauge recipient for trade-fee hook/native sink paths |
| 74. Docs say buys+sells, code only buys natively | Teams rely on docs, not trigger matrix | Sell trades may bypass native fee unless hook active | Users see inconsistent fee behavior | Fee intake lower/inconsistent vs assumptions | High | Publish explicit fee trigger matrix with hook dependency |
| 75. v4 hook sends fees to wrong address | Hook recipient misconfigured | Fees land in wrong sink | Fee destination appears broken | Jackpot/burn/voter/creator outcomes diverge or funds strand | High | Add post-launch onchain check: hook recipient == intended gauge |
| 76. Native fee path + hook fee path both active on same side | Hook configured to tax buys and token still taxes buy transitions | Same trade leg charged twice | Users overcharged on some venues | Distorted pricing and participation | High | Canonicalize one fee plane per trade side; enforce config guardrails |
| 77. `CreatorLinearVesting` funded with wrong token | Wrong token transferred to vesting wallet | Beneficiary vests wrong asset | Creator cannot access intended genesis allocation in expected unit | Allocation accounting invalid | High | Deployment assertions: vesting token must equal designated share token |
| 78. PayoutRouter bad swap path/minOut | Missing/incorrect path or strict minOut | `convertAndQueue` reverts or skips processing | External earnings processing stalls | Delayed/no PPS accretion from external revenue lane | Medium | Health checks for path coverage + keeper retries + sane minOut policy |
| 79. Burn stream not checkpointed/dripped | No keeper/actor calls over epochs | Burn accrual executes in lumpy catch-up burns | PPS changes occur in bursts | Timing distortion, less smooth holder accrual | Medium | Run regular checkpoint keeper and stale-epoch alerting |
| 80. Launch config set before fee recipients finalized | Auction/migration proceeds but hook recipient not finalized | Pool live before fee plane finalized | Early trades may route fees incorrectly or not at all | Lost/misrouted early lifecycle fees | High | Make tax-hook config completion a hard launch checklist gate |
| 81. Jackpot paid while UI assumes creator direct cashflow | Product copy says creator gets ongoing direct flow by default | Creator does not receive direct lane (`creatorShareBps=0`) | Trust/expectation mismatch | Potential governance/support escalation | Medium | Align UI text to default economics and optional creator lane config |
| 82. Creator ongoing revenue assumed spendable cash, but lane is PPS accretion | External earnings routed via router + burn stream | No direct creator token transfer from that lane | Creator cannot spend "earnings" directly | Value accrues to all holders instead | Medium | Explicitly separate "creator treasury lane" vs "holder accrual lane" in product docs |
| 83. Comments drive integrator behavior more than code | Stale comments/readmes remain in use | Integrators build against obsolete splits/semantics | Wrong operational actions and monitors | Repeated misconfig and reporting errors | High | Treat comments/docs as versioned artifacts with CI consistency checks |

# 9. Recommended Canonical Spec

The system should publish one canonical business-logic spec:

1. **Genesis allocation**
   - Creator genesis allocation is a deployment-time policy split funded into `CreatorLinearVesting`.
   - `CreatorLinearVesting` is a generic linear vesting wallet; it does not hardcode percentage or duration.

2. **Trading-fee sink**
   - Trading fees are intended to resolve through `CreatorGaugeController`.
   - Native `CreatorShareOFT` fee applies on `SwapOnly -> non-SwapOnly` transfers (buy-side trigger matrix).
   - Sell-side and/or additional fee behavior is hook-dependent and must be explicitly configured and verified.

3. **Post-fee outcomes**
   - Gauge splits fee-converted vault shares into:
     - immediate PPS burn,
     - jackpot reserve,
     - optional creator treasury share (only if `creatorShareBps > 0`),
     - voter/protocol branch (distributor first, treasury fallback).

4. **Jackpot model**
   - `CreatorGaugeController` is jackpot custodian (`jackpotReserve` accounting, vault-share custody).
   - `CreatorLotteryManager` is authorized payout caller (`payJackpot`), not custodian.

5. **External creator earnings**
   - External earnings should route to `PayoutRouter` when the intended outcome is holder-wide PPS accretion.
   - Router converts to creator coin, deposits to vault, and queues shares in `VaultShareBurnStream` for epoch-based burn.

6. **Who gets what**
   - **Initial creator allocation recipient**: `CreatorLinearVesting.beneficiary`.
   - **Trade-fee sink**: `CreatorGaugeController`.
   - **External earnings recipient (accretion lane)**: `PayoutRouter`.
   - **Ongoing creator treasury**: `creatorTreasury` only when `creatorShareBps > 0`.
   - **Voter rewards sink**: `VoterRewardsDistributor` when configured.
   - **Burn beneficiaries**: all vault-share holders via PPS increase.

7. **Fee-direction canonical rule**
   - Native token logic is buy-side only by address-type matrix.
   - Sell-side behavior depends on explicit hook config and must be treated as deployment-conditioned.
   - Docs must never present unconditional "buys and sells taxed" unless hook condition is simultaneously stated.

# 10. Recommended Naming Cleanup

Adopt these terminology rules in docs/UI/runbooks:

- **`CreatorShareOFT.payoutRecipient()`** -> document as **Trade Fee Sink**.
- **`CreatorCoin.payoutRecipient`** -> document as **External Revenue Recipient**.
- **`protocolShareBps`** -> document as **Voter/Protocol Branch BPS**.
- **`totalProtocolEarned`** -> document as **Total Voter/Protocol Routed**.
- **`jackpotReserve`** -> document as **Jackpot Reserve (vault shares)**.
- **`CreatorLinearVesting`** -> document as **Genesis Allocation Vesting Wallet**.
- **`PayoutRouter`** -> document as **External Revenue Router (accretion lane)**.
- **`VaultShareBurnStream`** -> document as **PPS Burn Stream (weekly epoch)**.

# 11. Findings

## Critical

- **Overloaded `payoutRecipient` semantics create lane collisions**
  - **Severity:** Critical
  - **Affected component:** CreatorCoin payout routing, ShareOFT hook routing, CRE monitoring
  - **Evidence:** `contracts/utilities/messaging/CreatorShareOFT.sol` (`payoutRecipient`, `getTaxHookParams`), `contracts/utilities/routers/PayoutRouter.sol` (safe payout recipient design), `frontend/src/pages/DeployVault.tsx` (sets CreatorCoin payout recipient to payout router), `cre/cre-workflows/payout-integrity/main.ts` (expects payout recipient == gauge)
  - **Why it matters:** Integrations can route external revenue and trade fees to incompatible sinks.
  - **Exploitability/misconfiguration path:** Wrong recipient assignment during deployment/ops; monitor policy enforces opposite behavior.
  - **Recommended fix:** Split naming/spec into two explicit recipient fields and enforce recipient invariants in deploy + monitor code.

- **Public fee split claims conflict with live gauge defaults**
  - **Severity:** Critical
  - **Affected component:** Docs/readmes and integrator assumptions
  - **Evidence:** `frontend/README.md` (90/5/5), `contracts/helpers/hooks/TaxHookConfigurator.sol` (50/31/19 comment), vs `contracts/governance/CreatorGaugeController.sol` defaults (2139/6900/0/961)
  - **Why it matters:** Wrong economics communicated to users/governance/partners.
  - **Exploitability/misconfiguration path:** Operators configure automation/compliance against incorrect split assumptions.
  - **Recommended fix:** Single canonical split source, CI docs lint against contract defaults, immediate doc corrections.

- **Tax-hook activation is not enforced by launch strategy execution**
  - **Severity:** Critical
  - **Affected component:** Post-auction fee-plane activation
  - **Evidence:** `contracts/vault/strategies/CCALaunchStrategy.sol` exposes `getTaxHookCalldata`/`getCompleteAuctionCalldata` but does not execute hook config in `migrate`
  - **Why it matters:** Pool can go live without intended hook fee routing.
  - **Exploitability/misconfiguration path:** Operational omission of explicit hook call leaves sell-side lane inactive/misconfigured.
  - **Recommended fix:** Add deterministic post-migration hook-config step with invariant checks and blocking launch completion gate.

## High

- **Buy/sell fee policy remains ambiguous in implementation layers**
  - **Severity:** High
  - **Affected component:** Fee intake correctness
  - **Evidence:** `CreatorShareOFT._transferWithFees` buy-side trigger only; comments/docs claim broader buy+sell behavior
  - **Why it matters:** Unclear policy causes either no-charge or overcharge paths by venue.
  - **Exploitability/misconfiguration path:** Hook not enabled or configured inconsistently with token-native path.
  - **Recommended fix:** Canonical trigger matrix and side-specific fee-plane ownership.

- **Hook API divergence increases integration error risk**
  - **Severity:** High
  - **Affected component:** Hook setup tooling
  - **Evidence:** `CCALaunchStrategy`/`CompleteAuction` use token+counter `setTaxConfig`; `TaxHookConfigurator` uses poolId buy/sell config struct
  - **Why it matters:** Operators may apply wrong API assumptions to deployed hook.
  - **Exploitability/misconfiguration path:** Wrong function signature/semantics selected for production hook.
  - **Recommended fix:** Deprecate one integration path, keep one canonical hook adapter with tests.

- **Trade fees can be stranded or bypass intended accounting if hub sink misconfigured**
  - **Severity:** High
  - **Affected component:** Hub fee routing in ShareOFT
  - **Evidence:** `CreatorShareOFT._sendFeesToGauge` returns if gauge unset; catch path direct-transfers tokens to gauge without `pendingFees` accounting call
  - **Why it matters:** Collected fees may not enter distribution accounting promptly or at all without manual follow-up.
  - **Exploitability/misconfiguration path:** Hub mode active before gauge set or gauge call failure.
  - **Recommended fix:** Hard-revert on hub with unset gauge and add explicit recovery/sweep path.

- **CRE payout integrity monitor enforces potentially obsolete invariant**
  - **Severity:** High
  - **Affected component:** Operations and alerts
  - **Evidence:** `cre/README.md` and `cre/cre-workflows/payout-integrity/main.ts` require CreatorCoin payout recipient == gauge
  - **Why it matters:** Alerting can force wrong remediation or mask intended router model.
  - **Exploitability/misconfiguration path:** Legitimate router deployment flagged as critical incident.
  - **Recommended fix:** Update monitor policy to support explicit mode (`gauge` vs `router`) per deployment.

## Medium

- **Creator ongoing direct revenue can be disabled silently**
  - **Severity:** Medium
  - **Affected component:** Creator revenue expectations
  - **Evidence:** `creatorShareBps` default 0; creator branch only transfers when `creatorShareBps > 0` and treasury set
  - **Why it matters:** Product narrative can diverge from active economics.
  - **Exploitability/misconfiguration path:** Governance forgets split update or treasury assignment.
  - **Recommended fix:** Policy checks and UI surfacing for active split state.

- **External payout lane is custody/ops dependent before conversion**
  - **Severity:** Medium
  - **Affected component:** `PayoutRouter`
  - **Evidence:** `onlyOwnerOrKeeper` on `convertAndQueue`; `emergencyWithdraw` exists
  - **Why it matters:** Funds may remain idle or be extracted via emergency path.
  - **Exploitability/misconfiguration path:** Keeper outage, mis-set swap paths, owner intervention.
  - **Recommended fix:** Strong ops runbook + monitoring + constrained emergency controls.

- **Burn stream requires active checkpointing for smooth accrual**
  - **Severity:** Medium
  - **Affected component:** `VaultShareBurnStream`
  - **Evidence:** Epoch drip model with catch-up burn in one tx if unattended
  - **Why it matters:** Holder accrual profile can be lumpy.
  - **Exploitability/misconfiguration path:** No keeper/checkpoint maintenance.
  - **Recommended fix:** Keeper SLA and stale-stream alerts.

- **Genesis vesting policy is deployment-level, not contract invariant**
  - **Severity:** Medium
  - **Affected component:** Token allocation governance
  - **Evidence:** `CreatorLinearVesting` generic constructor; 40%/365-day policy enforced in `DeploymentBatcher` only
  - **Why it matters:** Alternative deployment paths can produce different economics.
  - **Exploitability/misconfiguration path:** Wrong token, wrong amount, or wrong duration at deploy.
  - **Recommended fix:** Deployment assertions and emitted policy metadata checks.

## Low

- **`flushThreshold` naming suggests automation not implemented onchain**
  - **Severity:** Low
  - **Affected component:** Remote fee flush expectations
  - **Evidence:** `CreatorShareOFT.setFlushThreshold` exists but flush remains explicit via `flushFees`
  - **Why it matters:** Operators may expect automatic remote flushes.
  - **Exploitability/misconfiguration path:** Keepers not configured because threshold assumed sufficient.
  - **Recommended fix:** Rename/document as advisory threshold or implement automation.

- **Gauge inline comments contain stale phrasing**
  - **Severity:** Low
  - **Affected component:** Developer comprehension
  - **Evidence:** "burn disabled by default" despite nonzero default burn share; protocol naming mismatch with distributor-first routing
  - **Why it matters:** Increases integration and audit friction.
  - **Exploitability/misconfiguration path:** Human error in runbooks/config assumptions.
  - **Recommended fix:** Refresh comments to match code.

## Informational

- **Custody-vs-authority boundary is correct but easy to misstate**
  - **Severity:** Informational
  - **Affected component:** Jackpot mental model
  - **Evidence:** Gauge stores reserve and transfers on `payJackpot`; manager triggers payout loops
  - **Why it matters:** Correct architecture should be documented clearly to avoid future drift.
  - **Exploitability/misconfiguration path:** Documentation-only confusion.
  - **Recommended fix:** Add explicit "custodian vs payout authority" block to architecture docs.

# 12. Production Readiness Verdict

- **business-logic clarity:** 6/10
- **docs accuracy:** 3/10
- **config robustness:** 5/10
- **fee-routing correctness:** 6/10
- **launch-readiness:** 5/10
- **operational smoothness:** 5/10
- **overall coherence:** 5/10

### Top 5 blockers before launch

1. Canonicalize and enforce recipient semantics (`tradeFeeSink` vs `externalRevenueRecipient`).
2. Remove split and fee-direction doc drift (90/5/5, 50/31/19, unconditional buys+sells claims).
3. Make tax-hook completion deterministic and verifiable in launch completion runbooks/automation.
4. Add deploy-time invariant checks for gauge/wrapper/vault/hook recipient alignment.
5. Decide and enforce a single non-overlapping fee-plane policy for buy/sell sides.

### 3 mandatory doc fixes before public launch

1. Replace all obsolete split claims with active configurable split model and defaults from gauge.
2. Publish explicit fee trigger matrix: native buy-side logic + hook-dependent sell-side logic.
3. Clarify creator economics: genesis vesting policy vs ongoing creator treasury lane vs holder PPS accrual lane.

### 3 config checks to enforce in deployment scripts

1. Verify fee sink alignment: `CreatorShareOFT.gaugeController`, `CCALaunchStrategy.feeRecipient`, and hook `taxRecipient` are the same intended gauge address.
2. Verify gauge economics config: BPS sum = 10000 and expected branch recipients (`creatorTreasury`, `voterRewardsDistributor`/`protocolTreasury`) are set per policy.
3. Verify external earnings lane wiring: CreatorCoin payout recipient mode is explicit (`router` or `gauge`), and if `router` then `burnStream` is set, router is whitelisted, and required swap paths/keeper are configured.
