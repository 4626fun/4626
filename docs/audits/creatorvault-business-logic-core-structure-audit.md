# 1. Executive Summary

Top-level answers first:

1. Distinct value lanes are present and separable in code:
   - Lane A: genesis creator allocation (deployment-funded vesting).
   - Lane B: shareOFT trading-fee flow (native buy-fee plane and optional hook-fee plane).
   - Lane C: external creator-revenue routing (payout recipient mode, often `PayoutRouter`).
   - Lane D: post-fee destinations (burn, jackpot reserve, optional creator treasury, voter/protocol branch).
2. Lanes are mostly separated in implementation, but naming and some UI/docs still blur lane B vs lane C.
3. The canonical sink for shareOFT trade fees is `CreatorGaugeController` (via `CreatorShareOFT.gaugeController`, `payoutRecipient()`, and hook recipient wiring when configured).
4. The canonical recipient for external creator earnings is the creator coin `payoutRecipient` domain; in accretion mode this should be `PayoutRouter`.
5. Jackpot reserve is held in `CreatorGaugeController` (`jackpotReserve`).
6. `CreatorLotteryManager` is payout authority (authorized caller), not jackpot custodian.
7. Initial creator allocation logic is separate from ongoing creator fee-share logic.
8. Internal consistency is good on custody/unit flows, but fee-side semantics remain deployment-conditional and easily miscommunicated.

The true business logic is a multi-lane system, not a single "fees go to creator" or "fees go to lottery" story. Native fee collection starts in `CreatorShareOFT` under a buy-side trigger pattern (`SwapOnly -> non-SwapOnly`), then resolves through `CreatorGaugeController` where units are normalized into vault shares and split across burn, jackpot reserve, optional creator treasury, and voter/protocol branch. External creator revenue is a separate lane that can be routed into `PayoutRouter` for holder-wide PPS accretion via burn-streamed vault shares.

The single biggest naming/semantics problem remains overloaded `payoutRecipient` language. In this codebase, one `payoutRecipient` context points toward trade-fee collection semantics (`CreatorShareOFT.payoutRecipient()` -> gauge domain), while another refers to external creator revenue routing (`CreatorCoin.setPayoutRecipient(...)` interface usage). Treating both as the same business concept creates real routing and monitoring mistakes.

The single biggest docs-vs-code mismatch is not one constant; it is fee-policy wording drift at integration surfaces. Core contracts model fee collection as conditional planes (native buy-trigger plus optional hook path), but generated docs and UI copy still include unconditional "buy + sell 6.9%" style statements in places. This can produce false launch-readiness claims and incorrect operator assumptions.

The biggest operational/configuration risk is launch completion semantics under owner-gated hook configuration. `CCALaunchStrategy` can sweep and migrate, but hook `setTaxConfig` remains a separate call path. If completion is declared without verified hook recipient/policy alignment, the system can go live with fee-plane reality that diverges from product claims.

# 2. Scope Freeze

| Source | Branch/commit reviewed | Files reviewed | Missing / inaccessible | Why it matters |
|---|---|---|---|---|
| Local repo `/home/akitav2/projects/4626` | `codex/footprint-reporting-20260324` @ `baa6c69ce722289fd3b2b640b2b87ad3480d3260` | Core contracts: `contracts/utilities/messaging/CreatorShareOFT.sol`, `contracts/governance/CreatorGaugeController.sol`, `contracts/utilities/routers/PayoutRouter.sol`, `contracts/utilities/routers/VaultShareBurnStream.sol`, `contracts/utilities/vesting/CreatorLinearVesting.sol`, `contracts/utilities/lottery/CreatorLotteryManager.sol`, `contracts/governance/VoterRewardsDistributor.sol`, `contracts/vault/strategies/CCALaunchStrategy.sol`, plus `contracts/vault/CreatorOVault.sol`, `contracts/vault/CreatorOVaultWrapper.sol`, `contracts/vault/modules/CreatorOVaultCoreModule.sol`, `contracts/helpers/batchers/DeploymentBatcher.sol`; operational paths: `frontend/api/_handlers/cre/keeper/_sweep.ts`, `frontend/api/_handlers/cre/keeper/_markSettled.ts`, `frontend/server/_lib/keeprSchema.ts`, `cre/cre-workflows/auction-settlement/main.ts`, `cre/cre-workflows/payout-integrity/main.ts`; docs/readmes under `README.md`, `docs/**`, `frontend/**`, `cre/**` | CreatorCoin implementation source is not present in this repo (only interface usage in batcher/frontend), external tax-hook implementation is not in this repo, remote `CreatorVault` GitHub repo intentionally not audited in this run | Some conclusions are deployment-dependent where external contracts or ownership domains are off-repo |
| Prompt-listed path mapping (local equivalence) | Same commit | Requested -> local: `contracts/services/messaging/CreatorShareOFT.sol` -> `contracts/utilities/messaging/CreatorShareOFT.sol`; `contracts/helpers/routers/*` -> `contracts/utilities/routers/*`; `contracts/helpers/vesting/*` -> `contracts/utilities/vesting/*`; `CreatorLotteryManager.sol` -> `contracts/utilities/lottery/CreatorLotteryManager.sol` | N/A | Avoids false negatives from path drift while preserving requested audit intent |
| External repo refs in prompt | Out of scope by user choice | N/A | `https://github.com/wenakita/CreatorVault` not inspected in this execution | Report is authoritative for local 4626 code only |

# 3. Canonical Value-Lane Map

| Lane | Source of value | Token/unit | First recipient | Transformations | Final destination | Main authority |
|---|---|---|---|---|---|---|
| Lane A - Genesis creator allocation | Deployment split from wrapped share token supply | `shareOFT` | `CreatorLinearVesting` | Time-vested linear release (`release()`) | Vesting `beneficiary` (creator genesis ownership) | Deployment scripts / batcher policy |
| Lane B - shareOFT trading-fee flow | Native `CreatorShareOFT` buy-trigger fees + optional hook fee path | `shareOFT` and/or `WETH`, then `vaultShares` at split point | `CreatorGaugeController` (direct on hub or bridged to hub then swept) | OFT path: unwrap to vault shares; WETH path: swap to creator coin, deposit to vault, receive vault shares | Split to burn, jackpot reserve, optional creator treasury, voter/protocol branch | Gauge owner/config + trading venue registration + hook configuration |
| Lane C - External creator-payout/revenue routing | Off-protocol creator revenue routed through creator-coin payout recipient | Arbitrary ERC20/ETH -> creator coin -> `vaultShares` | `externalRevenueRecipient` domain (recommended: `PayoutRouter`) | `convertAndQueue`: swap to creator coin, deposit to vault with burn stream receiver, queue stream | Holder-wide PPS accretion via streamed burns (router mode) | Payout recipient configuration + router owner/keeper operations |
| Lane D - Post-fee reward destinations | Vault-share output of lane B split engine | `vaultShares` | `CreatorGaugeController` split logic | `toBurn`, `toLottery`, `toCreator`, `toProtocol` with fallbacks | Burn (PPS), jackpot reserve, creator treasury (if enabled), voter distributor/protocol treasury/jackpot fallback | `setFeeSplit`, treasury/distributor wiring, lottery manager authorization |

# 4. Contract-by-Contract Product Truth

## CreatorShareOFT

- What it actually does:
  - Applies native transfer fee only on `SwapOnly -> non-SwapOnly` pattern via `_transferWithFees` / `_processBuy`.
  - Routes fee to gauge domain (`_sendFeesToGauge`) on hub, or accumulates `pendingFees` and bridges to hub on remote.
  - Exposes hook-facing helper endpoints (`payoutRecipient()`, `getTaxHookParams(...)`).
- What it does not do:
  - Does not natively charge a generic sell fee across all transfer patterns.
  - Does not perform final economic split; it forwards to gauge lane.
- What people misunderstand:
  - `payoutRecipient()` here is about trade-fee collection target, not generic creator external earnings.
  - "6.9% on buys and sells" is not guaranteed by this contract alone.

## CreatorGaugeController

- What it actually does:
  - Receives OFT fees (`receiveFees`, `receiveBridgedFees`) and WETH fees (`receiveWETHFees`/`processWETHFees`).
  - Normalizes to vault shares (unwrap or WETH->creatorCoin->vault deposit).
  - Splits shares by BPS into burn, jackpot reserve, optional creator treasury, and voter/protocol branch.
  - Custodies jackpot reserve and executes payout transfers only when called by lottery manager.
- What it does not do:
  - Does not run VRF or decide winners.
  - Does not make external creator-coin payout-recipient decisions.
- What people misunderstand:
  - `protocolShareBps` is not "always protocol treasury"; distributor and jackpot fallbacks exist.
  - Default split values are configurable; comments or docs are not runtime truth.

## CreatorLotteryManager

- What it actually does:
  - Accepts lottery entries from authorized swap callers (`processSwapLottery`) and resolves winners.
  - On payout, calls each gauge `payJackpot(...)` based on reserve and configured payout BPS.
- What it does not do:
  - Does not custody jackpot funds.
  - Does not split trade fees.
- What people misunderstand:
  - Manager authority is payout-call authority, not reserve ownership.

## PayoutRouter

- What it actually does:
  - Acts as an external revenue router under `onlyOwnerOrKeeper`.
  - Converts arbitrary payout token -> creator coin -> vault deposit to burn stream.
  - Queues minted vault shares into `VaultShareBurnStream`.
- What it does not do:
  - Does not execute gauge split logic.
  - Does not inherently create direct creator spendable revenue in router mode.
- What people misunderstand:
  - "Creator earnings" in this lane are often holder PPS accretion, not creator treasury cash.

## VaultShareBurnStream

- What it actually does:
  - Queues shares to the next weekly epoch and burns linearly via `drip`/`checkpoint`.
  - Is permissionless to operate; no owner withdrawal path.
- What it does not do:
  - Does not custody jackpot.
  - Does not distribute to creator treasury.
- What people misunderstand:
  - Burns are not always immediate; delayed checkpointing causes lumpier burn timing.

## CreatorLinearVesting

- What it actually does:
  - Enforces four core parameters: token, beneficiary, start, duration.
  - Releases linearly accrued amount on `release()`.
- What it does not do:
  - Does not hardcode 40% allocation or one-year duration.
  - Does not verify token semantics beyond ERC20 transferability.
- What people misunderstand:
  - "40% over 1 year" is deployment policy (currently batcher default), not vesting-contract invariant.

## CCALaunchStrategy

- What it actually does:
  - Creates/controls CCA lifecycle, sweeps raised currency, and migrates to v4 LP (`migrate()`).
  - Configures oracle pool reference in migration path.
  - Provides hook-call calldata helpers (`getTaxHookCalldata`, `getCompleteAuctionCalldata`).
- What it does not do:
  - Does not itself execute hook `setTaxConfig` automatically in normal execution path.
  - Does not guarantee full launch completion without external hook call ownership path.
- What people misunderstand:
  - It is not a single-transaction fully autonomous launch-completion engine.

# 5. Actual Funds Flow

## Genesis creator allocation

1. Deployment path mints/holds share tokens through wrapper flow (`DeploymentBatcher`).
2. Batcher applies launch split in current deployment policy (40% auction, 40% vesting, 20% LP reserve).
3. Batcher deploys `CreatorLinearVesting(params.shareOFT, params.owner, now, 365 days)` and transfers vesting amount.
4. Beneficiary calls `release()` over time; token released is whatever ERC20 was funded (expected shareOFT in current policy).

## shareOFT trade fees

1. Transfer enters `CreatorShareOFT._transferWithFees(from,to,amount)`.
2. Fee path triggers only when `addressType[from] == SwapOnly` and `addressType[to] != SwapOnly`.
3. `_processBuy` transfers fee into token contract balance, transfers net to buyer, emits `BuyFee`.
4. `_routeFees`:
   - Hub mode: `_sendFeesToGauge` -> `CreatorGaugeController.receiveFees(amount)`.
   - Remote mode: increment `pendingFees`; later `flushFees` bridges to hub receiver.
5. Gauge accumulates `pendingFees`; distribution path unwraps OFT to vault shares (`wrapper.unwrap`) then splits via `_distributeVaultShares`.

## External hook WETH fees

1. Hook-configured trades send WETH fees to gauge (`receiveWETHFees`).
2. Gauge accumulates `pendingWETHFees`; owner/keeper/permissionless path triggers `processWETHFees` subject to caps.
3. `_processWETHFees` swaps WETH -> creator coin through swap router with min-out checks.
4. Gauge deposits creator coin into vault, receives vault shares.
5. Same `_distributeVaultShares` split logic applies (burn/jackpot/creator/voter-protocol).

## External creator earnings

1. Creator-coin payout recipient receives external funds (configuration dependent).
2. In router mode, recipient is `PayoutRouter`; funds can be ERC20 or ETH (ETH is wrapped on receive).
3. `convertAndQueue(tokenIn, amountIn, minCreatorOut)` converts to creator coin if needed.
4. Router deposits creator coin into vault with receiver=`burnStream`, then calls `burnStream.queueShares(sharesQueued)`.

## Jackpot payout

1. Lottery manager computes winner and payout BPS.
2. For each active creator vault, manager reads `gauge.getJackpotReserve()`.
3. Manager calls `gauge.payJackpot(winner, rewardShares)`.
4. Gauge verifies caller is configured lottery manager, decrements `jackpotReserve`, transfers vault shares to winner.

## Voter rewards

1. Gauge computes `toProtocol` branch after burn/lottery/creator slices.
2. If `voterRewardsDistributor` configured:
   - Gauge approves distributor and calls `notifyRewards(vault, vaultSharesToken, toProtocol)`.
3. Distributor records rewards by `(epoch, vault)` and users claim pro-rata by vote weight.
4. If distributor unset, fallback is protocol treasury; if not available, jackpot fallback in gauge logic.

## Creator ongoing treasury allocation

1. `creatorShareBps` controls ongoing creator lane.
2. During `_distributeVaultShares`, `toCreator = shares * creatorShareBps / 10000`.
3. If `creatorTreasury` is set, shares transfer there.
4. If `creatorTreasury` is unset, `toCreator` is redirected to jackpot reserve.

## Vault-share burn path

1. Immediate burn path (gauge): `vault.burnSharesForPriceIncrease(toBurn)` from gauge context.
2. Streamed burn path (burn stream): queued shares burn linearly across weekly epoch via `drip`/`checkpoint`.
3. Vault core module authorizes this burn function only from `gaugeController` or `burnStream`.

# 6. Documentation Drift Audit

| Source location | Current claim | Code reality | Severity | Fix needed |
|---|---|---|---|---|
| `docs/_generated/contracts/src/README.md` | Fee section now documents two conditional fee planes (native + optional hook) | Matches current `CreatorShareOFT` and hook-activation semantics | Informational | Keep generated docs refreshed with source README changes |
| `contracts/utilities/messaging/CreatorShareOFT.sol` (header NatSpec) | Sell-fee path now phrased as hook-conditional | Matches deployment-dependent hook activation model | Informational | Keep conditional wording in future comment edits |
| `contracts/utilities/messaging/CreatorShareOFT.sol` (`payoutRecipient()` comment) | Now describes trade-fee collector domain and config-driven downstream split | Matches `CreatorGaugeController.setFeeSplit` mutability and fallback behavior | Informational | Preserve lane-specific wording (`tradeFeeCollector`) |
| `frontend/src/pages/CompleteAuction.tsx` | Step-3 copy now states conditional fee planes; split labels corrected to 69 / 21.39 / 9.61 | Better aligned with onchain defaults and lane semantics | Medium | Consider rendering live split values from gauge reads instead of static text |
| `docs/solana-spoke-article.md` | Clarifies Solana TransferFeeConfig semantics are not equivalent to EVM native triggers; launch split updated to 40/40/20 | Better aligned with current EVM + batcher behavior in this repo | Informational | Keep chain-specific fee semantics explicitly separated |
| `docs/contracts/governance/index.md` | Fee split section now labeled defaults/configurable with voter/protocol fallback note | Better aligned with mutable split and fallback routing | Informational | Optionally link to `setFeeSplit` and fallback paths for deep readers |
| `frontend/src/components/explore/TokenRow.tsx` / `PoolRow.tsx` | Zora fee comments are now explicitly scoped as Zora-specific | Reduces cross-protocol confusion with CreatorVault gauge economics | Informational | Keep cross-protocol comments namespaced and explicit |
| `docs/operations/deployment/launch/verification.md` | Hook step now includes onchain checks for pool id/key, enabled flag, fee bps, and recipient | Better aligned with required launch-completion verification | Informational | Keep this checklist coupled to keeper/manual runbooks |
| Legacy mismatch check from prompt (`README 100% lottery`, `50/31/19`, `90/5/5`) | Expected stale claims | These exact strings are not present in current primary source files in this snapshot | Informational | Keep legacy check in CI drift tests; treat as previously fixed, not current blocker |

# 7. Config-Dependency Review

| Config field / address | Where set | Effect on business logic | Failure if unset/wrong |
|---|---|---|---|
| `gaugeController` (ShareOFT) | `CreatorShareOFT.setGaugeController`, deployment batcher phase-2 wiring | Defines trade-fee sink for native hub path and hook helper recipient | Fees remain local/stuck or route to wrong sink; lottery/economic split breaks |
| `addressType` (`SwapOnly`/`NoFees`) | `CreatorShareOFT.setAddressType(s)` | Determines whether native buy-fee trigger executes | Wrong classification causes untaxed trades or wrong taxed flows |
| Hub routing (`isHub`, `hubEid`, `hubGaugeReceiver`) | `CreatorShareOFT.setHubConfig` | Controls remote fee accumulation/flush target | Remote fees never settle to hub gauge or settle to wrong receiver |
| Hook recipient and tax config (`feeRecipient`, `taxRateBps`, pool key) | `CCALaunchStrategy.getTaxHookCalldata`, external hook call path | Activates hook fee plane and routes hook-collected fees | Sell-side (or hook side) inactive/misrouted; buy+sell policy claims invalid |
| `creatorTreasury` | `CreatorGaugeController.setCreatorTreasury` | Enables direct creator ongoing lane when `creatorShareBps > 0` | Setter guard now reverts (`CreatorTreasuryRequired`) if trying to clear treasury while creator lane is active |
| `lotteryManager` | `CreatorGaugeController.setLotteryManager` | Authorizes jackpot payout caller | Jackpot cannot be paid out if unset/wrong |
| `voterRewardsDistributor` | `CreatorGaugeController.setVoterRewardsDistributor` | Routes voter/protocol branch to epoch claim system | Branch falls back to protocol treasury, then jackpot fallback if unavailable |
| `protocolTreasury` | Constructor + `setProtocolTreasury` | Fallback sink for protocol/voter branch | If invalid/unusable, protocol branch can degrade to jackpot fallback behavior |
| `burnShareBps` / `lotteryShareBps` / `creatorShareBps` / `protocolShareBps` | `CreatorGaugeController.setFeeSplit` | Defines post-fee economics; must sum to 10000 | Wrong config changes who gets what; docs and expected tokenomics diverge |
| Creator-coin payout recipient (`externalRevenueRecipient` domain) | `ICreatorCoin.setPayoutRecipient` (used by batcher) | Selects lane C destination (router mode vs direct mode) | External revenues route into wrong lane (gauge vs router confusion) |
| Router keeper | `PayoutRouter.setKeeper` | Allows non-owner automated `convertAndQueue` | External revenue conversion stalls without operational signer |
| Router swap paths (`swapPathToCreator`) | `PayoutRouter.setSwapPath` | Enables tokenIn conversion to creator coin | `convertAndQueue` reverts (`PathNotSet`) or poor execution if wrong path |
| Burn stream binding | `CreatorOVault.setBurnStream` (one-time), `PayoutRouter` immutable `burnStream` | Required for enforceable streamed burn lane | Router deposits can fail semantic intent; burn path may not execute as designed |
| Vault/wrapper linkage | `CreatorGaugeController.setVault`, `.setWrapper`; batcher wiring | Needed for OFT unwrap and WETH path conversion to vault shares | Gauge cannot normalize units; distribution fails |
| CCA recipients (`fundsRecipient`, `tokensRecipient`) | `CCALaunchStrategy.setRecipients` via batcher | Ensures raised currency/unsold token land where migration expects | `migrate()` can fail (`CurrencyBalanceTooLow`) if raised funds are elsewhere |

# 8. Attack / Failure Scenarios

| Scenario | Preconditions | Failure path | User effect | Economic effect | Severity | Fix |
|---|---|---|---|---|---|---|
| 67. `creatorShareBps` left at 0 unintentionally | Creator expects ongoing treasury lane | Gauge computes `toCreator = 0` | Creator sees no direct ongoing payout | All post-fee value shifts to burn/jackpot/voter-protocol branch | Medium | Explicit deploy invariant and UI disclosure of live split |
| 68. `creatorTreasury` unset with creator lane enabled | Owner attempts to enable creator lane without treasury, or clear treasury while creator lane active | `setFeeSplit` / `setCreatorTreasury` now revert with `CreatorTreasuryRequired` | Config tx fails (state unchanged) | Prevents silent creator-lane diversion | Informational | Keep contract guard and monitor for non-standard upgrade/storage-mutation paths |
| 69. `voterRewardsDistributor` unset | Voter branch intended but distributor absent | Gauge fallback sends to protocol treasury (or jackpot fallback) | Voters cannot claim expected rewards | Governance incentive path changes silently | Medium | Require distributor config for voter mode or publish explicit fallback mode |
| 70. `protocolTreasury` unset/wrong | Misconfiguration or legacy abnormal state | Protocol fallback path degraded | Protocol ops funding disrupted | Branch can be misallocated | Low | Constructor/setter already zero-guard; retain invariant checks and address monitoring |
| 71. Jackpot assumed in lottery manager | Ops/docs blur custody | Manager queried/treated as reserve holder | Incorrect dashboards and incident handling | Payout operations misdiagnosed during outages | High | Treat custody vs authority as hard architectural boundary in docs/alerts |
| 72. External `payoutRecipient` set to gauge instead of router (when router mode intended) | Creator coin recipient points at gauge | External revenues enter lane B splitter, not lane C router | Unexpected jackpot/burn allocation from external revenue | Holder/creator economics diverge from intended policy | High | Monitor `externalRevenueRecipient` mode and block mismatched configs |
| 73. External `payoutRecipient` set to router instead of gauge for trade-fee hooks | Hook or trade-fee path points to router | Trade-fee revenue bypasses gauge split and jackpot reserve | Lottery rewards shrink/unpredictable | Fee economics and governance assumptions break | Critical | Enforce `tradeFeeCollector` alignment on ShareOFT + hook recipient checks |
| 74. Docs claim buys+sells while code is buy-trigger + optional hook | Public claims not tied to config proof | Operators/users assume symmetric taxation | User trust and disclosures diverge from behavior | Forecasting and tokenomics models become wrong | High | Publish two-plane matrix and require config proof before buy+sell claims |
| 75. V4 hook sends fees to wrong address | Hook configured with wrong recipient/pool id | Fees routed away from intended gauge | Users see reduced lottery/burn outcomes | Direct economic diversion | Critical | Add post-config onchain verification for pool id + recipient |
| 76. Native and hook fee paths both active with overlapping coverage | Both planes enabled without overlap policy | Same trade can be charged by both mechanisms | Users perceive unexpected total fee | Over-tax or inconsistent taxation across venues | High | Define and test fee-plane partitioning per venue/pool before go-live |
| 77. `CreatorLinearVesting` funded with wrong token | Deployment/operator error | Beneficiary vests wrong asset | Creator cannot access intended genesis allocation | Genesis economics broken | High | Deployment-time token assertion and post-deploy balance validation |
| 78. `PayoutRouter.convertAndQueue` with bad path/minOut | Path stale or slippage too strict/loose | Revert or poor conversion output | External revenue processing stalls or underperforms | PPS accretion delayed/inefficient | Medium | Path health checks, conservative minOut policy, keeper retry/alerting |
| 79. Burn stream not checkpointed | No keeper/manual cadence | Burns accumulate and execute in large catch-up tx | PPS updates become lumpy | Timing-dependent valuation noise | Medium | Keep periodic `checkpoint` automation and freshness alerts |
| 80. Launch config finalized before fee recipients are finalized | Sweep/migrate done, hook recipient not verified | "Live" status reached with misaligned fee sink | Users trade under wrong assumptions | Fee routing can be wrong at launch | High | Completion gate must include hook config + recipient alignment |
| 81. Jackpot paid while docs/UI imply creator direct ongoing revenue | Messaging conflates lanes | Winners paid from jackpot while creator expects treasury stream | Support confusion and dispute risk | Economic expectations mismatch | Medium | Separate creator ongoing lane from jackpot lane in all product copy |
| 82. Creator ongoing revenue assumed spendable cash when route is PPS accretion | Router mode active but represented as creator cash | Creator expects direct withdrawals that do not exist | Misunderstood earnings model | Mispriced incentives and creator dissatisfaction | Medium | Explicitly label router lane as holder accretion path |
| 83. Integrators follow comments/docs over code | Stale generated docs/UI snippets persist | Incorrect downstream integrations | Broken dashboards, wrong alarms, bad runbooks | Operational and economic misconfiguration risk | High | Add docs drift CI and onchain invariant checks as source of truth |

# 9. Recommended Canonical Spec

The system has four economic lanes and they must stay distinct:

- Genesis allocation lane:
  - Creator genesis ownership comes from a one-time shareOFT allocation funded into `CreatorLinearVesting`.
  - `CreatorLinearVesting` enforces token/beneficiary/start/duration only.
  - In this repository's current deployment flow, batcher policy sets 40% vesting over 365 days, but that policy is outside vesting-contract invariants.

- Trade-fee lane:
  - Native `CreatorShareOFT` fee collection is buy-trigger pattern (`SwapOnly -> non-SwapOnly`) and not universal for all transfers.
  - Hook-based fee collection is a separate plane and must be explicitly configured and verified.
  - Both planes should resolve to the same `tradeFeeCollector` domain (typically `CreatorGaugeController`) unless governance intentionally changes policy.

- Jackpot lane:
  - `CreatorGaugeController` custodies jackpot reserve (`jackpotReserve` in vault-share units).
  - `CreatorLotteryManager` is authorized to call payout, not the reserve holder.

- External revenue lane:
  - Creator-coin `payoutRecipient` defines external revenue destination.
  - In holder-accretion mode, external revenue should route to `PayoutRouter`, which converts to creator coin, deposits into vault, and queues shares into `VaultShareBurnStream`.

- Post-fee destination lane:
  - Gauge split resolves vault-share outcomes into burn, jackpot reserve, optional creator treasury, and voter/protocol branch with explicit fallbacks.
  - Direct creator ongoing revenue exists only when `creatorShareBps > 0` and `creatorTreasury` is configured.

Who gets what:

- Initial creator allocation: vesting beneficiary.
- Ongoing creator treasury: creator treasury address only if enabled by split and config.
- Holders: benefit via burn/PPS accretion (immediate gauge burns and/or stream burns).
- Jackpot winners: paid vault shares from gauge-held reserve through lottery-manager-authorized call path.
- Voters/protocol: routed by distributor/treasury fallback policy.

Fee-side truth statement:

- Never claim unconditional "buy and sell 6.9%" unless onchain verification proves both fee planes are active exactly as stated and non-overlapping by policy.

# 10. Recommended Naming Cleanup

- `payoutRecipient` (generic) -> avoid as product term; use lane-specific names.
- `CreatorShareOFT.payoutRecipient()` context -> `tradeFeeCollector`.
- `CreatorCoin.payoutRecipient` context -> `externalRevenueRecipient`.
- `protocolShareBps` (doc/UI wording) -> `voterProtocolBranchBps` to reflect distributor-first behavior.
- "lottery manager holds jackpot" -> replace with:
  - `jackpotCustodian`: `CreatorGaugeController`
  - `jackpotPayoutAuthority`: `CreatorLotteryManager`
- "creator earnings" in router lane -> `externalRevenueAccretionFlow` unless direct treasury lane is explicitly enabled.

Terminology rules:

1. Do not use "creator gets fees" without naming the lane.
2. Do not use "payout recipient" without contract context.
3. Every fee policy statement must state plane (`native`, `hook`, or both) and activation prerequisites.

# 11. Findings

## Critical

### Finding C1: Trade-fee sink and external-revenue sink are easy to cross-wire
- Severity: Critical
- Affected component: Lane B/Lane C boundary (`CreatorShareOFT`, creator coin payout recipient config, hook config)
- Evidence: `CreatorShareOFT.payoutRecipient()` points to gauge domain, while creator coin payout recipient is configured separately via batcher interface path.
- Why it matters: Miswiring can divert trade fees into router flow or external revenue into gauge split.
- Exploitability / misconfiguration path: Wrong recipient set during deployment or hook config.
- Recommended fix: Hard-block launch unless `tradeFeeCollector` and `externalRevenueRecipient` invariants pass mode-aware checks.

### Finding C2: Hook recipient misalignment can silently break launch economics
- Severity: Critical
- Affected component: `CCALaunchStrategy` + external tax hook
- Evidence: Strategy provides hook calldata (`getTaxHookCalldata`) but does not execute hook config directly in main path.
- Why it matters: Launch can be swept/migrated while hook plane is unset or pointed wrong.
- Exploitability / misconfiguration path: Owner/keeper hook call omitted or configured to wrong recipient/pool.
- Recommended fix: Make launch completion status contingent on verified hook config and recipient alignment.

## High

### Finding H1: Fee policy can be overstated as unconditional buy+sell
- Severity: High
- Affected component: Product/docs/UI fee semantics
- Evidence: Native fee trigger in `_transferWithFees` is `SwapOnly -> non-SwapOnly`; hook plane is separate.
- Why it matters: Incorrect public claims and forecasting.
- Exploitability / misconfiguration path: Teams ship copy before hook verification.
- Recommended fix: Publish fee-plane matrix and enforce "proof before claim" checks.

### Finding H2: Creator ongoing revenue is optional and must be explicitly enabled
- Severity: High
- Affected component: `CreatorGaugeController` split config
- Evidence: `creatorShareBps` defaults to 0, and setters now enforce `CreatorTreasuryRequired` before any non-zero creator lane can be activated.
- Why it matters: Creator incentive model may differ from intent without visible failure.
- Exploitability / misconfiguration path: Governance expects creator cash lane by default but leaves `creatorShareBps` at 0.
- Recommended fix: Enforce explicit deployment intent for creator lane (`creatorShareBps` target + treasury address) and verify post-deploy state.

### Finding H3: UI/documentation drift can induce operational mistakes
- Severity: High
- Affected component: `frontend/src/pages/CompleteAuction.tsx`, generated docs
- Evidence: UI/docs copy needed lane/plane hardening; this pass corrected key hotspots, but static text can drift again without CI guardrails.
- Why it matters: Operators and users act on incorrect economics.
- Exploitability / misconfiguration path: Runbook and frontend become de facto source of truth.
- Recommended fix: Drive UI/doc values from onchain config and enforce docs drift checks in CI.

### Finding H4: Launch completion still depends on multi-actor operational correctness
- Severity: High
- Affected component: CCA completion orchestration (strategy + keeper + owner/hook auth)
- Evidence: Completion requires sweep, migrate, and hook config; hook path may remain owner-manual depending mode.
- Why it matters: Partial completion states can persist.
- Exploitability / misconfiguration path: keeper cannot perform hook call, owner action delayed.
- Recommended fix: Keep dual-mode but block "completed" status until all predicates are true.

## Medium

### Finding M1: Voter/protocol branch semantics are configuration-dependent
- Severity: Medium
- Affected component: `CreatorGaugeController` + `VoterRewardsDistributor`
- Evidence: `toProtocol` routes distributor first, treasury second, jackpot fallback third.
- Why it matters: Same BPS branch can end in different beneficiaries.
- Exploitability / misconfiguration path: Distributor unset or unexpected address.
- Recommended fix: Explicitly encode selected mode in deployment metadata and monitoring.

### Finding M2: Burn-stream liveness affects PPS smoothness
- Severity: Medium
- Affected component: `VaultShareBurnStream`
- Evidence: Permissionless `drip/checkpoint`; delayed calls produce catch-up burns.
- Why it matters: Value accrual timing appears discontinuous.
- Exploitability / misconfiguration path: Keeper downtime.
- Recommended fix: Alert on stale stream checkpoints and backstop automation.

### Finding M3: Solana article and cross-surface messaging can blur chain-specific semantics
- Severity: Medium
- Affected component: `docs/solana-spoke-article.md` and user-facing docs
- Evidence: Solana TransferFeeConfig and EVM native/hook fee planes have different trigger models and must stay explicitly separated in docs.
- Why it matters: Cross-chain product truth becomes ambiguous.
- Exploitability / misconfiguration path: Users infer incorrect EVM fee behavior.
- Recommended fix: Add explicit "Solana model vs EVM model" split section.

## Low

### Finding L1: Vesting contract itself does not guard token correctness
- Severity: Low
- Affected component: `CreatorLinearVesting`
- Evidence: Contract enforces token address at deployment but cannot know intended economic asset.
- Why it matters: Wrong-token funding is an operator risk.
- Exploitability / misconfiguration path: Deployment error.
- Recommended fix: Add deployment-time assertions and post-deploy sanity checks.

## Informational

### Finding I1: Legacy mismatch strings requested in prompt are mostly already removed in current source
- Severity: Informational
- Affected component: docs/comments baseline
- Evidence: Exact "100% lottery" and "50/31/19", "90/5/5" strings not found in current primary source files.
- Why it matters: Current drift focus should move to fee-plane conditionality and lane naming.
- Exploitability / misconfiguration path: N/A
- Recommended fix: Keep regression checks so legacy claims do not reappear.

# 12. Production Readiness Verdict

Scores (1-10):

- Business-logic clarity: 7/10
- Docs accuracy: 6/10
- Config robustness: 7/10
- Fee-routing correctness: 7/10
- Launch-readiness: 7/10
- Operational smoothness: 6/10
- Overall coherence: 7/10

Top 5 blockers before launch:

1. Enforce hard `tradeFeeCollector` and hook recipient alignment checks before launch-complete state.
2. Eliminate remaining unconditional fee-language drift in generated docs/UI.
3. Make lane B vs lane C recipient mode explicit at deployment and in monitoring outputs.
4. Enforce creator lane invariants (`creatorShareBps` with treasury requirements) in deployment scripts.
5. Ensure completion gate remains sweep + migrate + hook-config verified (not sweep-only or migrate-only).

Three mandatory doc fixes before public launch:

1. Update generated docs and UI copy to describe conditional two-plane fee behavior (native/hook).
2. Clarify that gauge split is configurable and default creator lane is zero unless enabled.
3. Standardize jackpot wording to "gauge custodian, lottery manager payout authority."

Three config checks that must be enforced in deployment scripts:

1. `ShareOFT.gaugeController == expectedTradeFeeCollector` and hook `taxRecipient == same collector`.
2. If `creatorShareBps > 0`, require nonzero valid `creatorTreasury` and monitor post-deploy.
3. Do not mark completion/live until strategy sweep + migrate + hook configuration and recipient alignment are all verified onchain.
