# 1. Final Canonical Spec

## Genesis allocation

- The creator genesis allocation is a deployment-time `shareOFT` allocation funded into `CreatorLinearVesting`.
- `CreatorLinearVesting` is a generic vesting wallet; allocation percentage and duration are deployment parameters, not protocol constants.
- In the current deployment flow (`DeploymentBatcher` policy), genesis ownership is separate from ongoing fee/revenue lanes.

## Trade-fee lane

- Trade fees are resolved to the **tradeFeeCollector** domain (canonically the gauge path).
- This lane has two distinct fee planes that must be documented separately:
  - Native OFT fee plane in `CreatorShareOFT` (buy-side transfer pattern: `SwapOnly -> non-SwapOnly`).
  - Hook fee plane (sell-side and any hook-defined behavior) configured via tax-hook `setTaxConfig(...)`.
- `CreatorGaugeController` is the canonical post-collection resolver that converts fee inputs into `vaultShares` outcomes, then splits by configured bps.

## Jackpot lane

- `CreatorGaugeController` is jackpot custodian and accounting source (`jackpotReserve` in vault-share units).
- `CreatorLotteryManager` is jackpot payout authority (authorized caller of `payJackpot`), not the custodian.
- Jackpot language must always preserve this custodian-vs-authority split.

## External revenue lane

- `CreatorCoin.payoutRecipient` semantics are canonically documented as **externalRevenueRecipient**.
- When `externalRevenueRecipient` points to `PayoutRouter`, external revenue is converted/swapped to creator coin, deposited into the vault, and queued into `VaultShareBurnStream`.
- This default router path is holder-wide PPS accretion, not immediate creator spendable cash.

## Creator ongoing revenue lane

- Direct creator ongoing revenue exists only when:
  - `creatorShareBps > 0`, and
  - `creatorTreasury` is configured.
- If this lane is disabled or treasury is unset, creator-directed value does not appear automatically just because fees exist elsewhere.

## Voter rewards lane

- Voter/protocol branch is resolved by gauge config:
  - Preferred path: `VoterRewardsDistributor.notifyRewards(...)` for epoch claims.
  - Fallback path: protocol treasury behavior when distributor path is unavailable.
- Public docs should describe this as a voter/protocol branch, not unconditional voter payouts.

## Burn lane

- Burn outcomes come from gauge split and/or external revenue router flow:
  - Immediate burn path from gauge-distributed `vaultShares`.
  - Streamed burn path via `VaultShareBurnStream` weekly epochs.
- Both paths are holder PPS accretion, not creator treasury payouts.

## Launch / activation caveats

- `CCALaunchStrategy` should be described as:
  - Auction lifecycle + settlement primitive, and
  - v4 LP migration primitive (`migrate()` does pool init and position minting path with `positionRecipient`).
- It is not full launch-completion automation by itself, because hook activation/config alignment (`setTaxConfig`) is a separate operational step.
- Canonical completion state should require all intended post-auction steps, not only sweep.

## Automatic/keeper completion target model (recommended)

### Canonical completion state

Launch completion is true only when all intended checks pass:

1. `sweepCurrency()` succeeded.
2. `migrate()` succeeded and pool is live.
3. Hook tax configuration is confirmed on the intended pair/pool and recipient.
4. `tradeFeeCollector` alignment checks pass across native/hook fee planes.

### Keeper-driven implementation plan (no semantic change)

1. Add a keeper completion endpoint/workflow that is phase-aware and idempotent:
   - sweep if not swept,
   - migrate when `migrationBlock` is ready,
   - configure hook when authorized signer path is available.
2. Update CRE settlement workflow to mark `settled` only after canonical completion conditions are met.
3. Keep manual fallback in UI (`CompleteAuction`) for owner-gated hook configuration when keeper cannot sign as authorized owner.
4. Add monitoring states:
   - `swept_not_migrated`,
   - `migrated_hook_unconfigured`,
   - `collector_misaligned`.
5. Block public “launch complete” status until all required completion predicates are true.

# 2. Who Gets What Table

| Lane | Source of value | Token/unit | Immediate recipient | Final beneficiary | Config dependency |
|---|---|---|---|---|---|
| Genesis allocation | Deployment split allocation | `shareOFT` | `CreatorLinearVesting` | Vesting beneficiary (creator genesis ownership) | Deployment split + vesting params |
| Trade-fee collection | Native OFT transfer fee + hook fee plane | `shareOFT` / `WETH` -> `vaultShares` outcomes | `CreatorShareOFT` and/or hook -> `CreatorGaugeController` | Burn/jackpot/creator/voter-protocol branches per split | `tradeFeeCollector` wiring + hook config + address typing |
| Jackpot custody | Lottery share from gauge split | `vaultShares` reserve | `CreatorGaugeController` | Jackpot reserve for eligible winners | Gauge split bps + lottery manager authorization |
| Jackpot payout authority | Authorized payout execution | `vaultShares` transfer | `CreatorLotteryManager` calls gauge | Winning participants | Lottery config + gauge authorization |
| External revenue routing | Third-party creator payouts/revenue | arbitrary ERC20/ETH -> creator coin -> `vaultShares` | `externalRevenueRecipient` (often `PayoutRouter`) | Holder PPS accretion via burn stream (router mode) | `CreatorCoin.payoutRecipient` mode + router swap/deposit config |
| Creator ongoing treasury | Creator branch from gauge split | `vaultShares` | `creatorTreasury` | Creator direct ongoing treasury | `creatorShareBps > 0` and treasury set |
| Voter rewards | Voter/protocol branch from gauge split | `vaultShares` | `VoterRewardsDistributor` (or fallback path) | Voters (if distributor active) or protocol fallback path | Distributor address + voting state |
| Burn | Burn branch and burn stream queue | `vaultShares` burned | Gauge burn path and/or `VaultShareBurnStream` | All holders via PPS accretion | Burn bps + burn stream operations |

# 3. Naming Cleanup

| Old term | Problem | New canonical term |
|---|---|---|
| `payoutRecipient` (generic) | Overloaded across distinct lanes and contracts | Use lane-specific names only |
| `CreatorShareOFT.payoutRecipient()` context | Confused with creator external payouts | `tradeFeeCollector` |
| `CreatorCoin.payoutRecipient` context | Confused with trade-fee plumbing | `externalRevenueRecipient` |
| `protocolShareBps` | Sounds like treasury-only branch | `voterProtocolBranchBps` (doc term) |
| Jackpot manager as "prize pool" | Blurs custody and authority | `jackpotCustodian` (gauge) vs `jackpotPayoutAuthority` (lottery manager) |
| "Creator earnings" for router flow | Blurs creator cash with holder accretion | `externalRevenueAccretionFlow` (doc term) |
| "6.9% buy + sell" (unqualified) | Overstates unconditional fee behavior | `nativeBuyFee + hookConfiguredFeePlanes` |

Canonical glossary rule:

- `payoutRecipient` is a legacy identifier name.
- Docs/spec/UI copy must not use generic "payout recipient" as product truth.
- Always use `tradeFeeCollector` or `externalRevenueRecipient` depending on lane.

# 4. Docs Patch List

| File/section | Old claim | New claim | Severity |
|---|---|---|---|
| `docs/contracts/strategies/cca-launch.md` (Auction flow) | `sweepCurrency() -> migrate() -> pool live` implies completion end-state | `migrate()` covers LP migration; launch completion additionally requires hook config/alignment checks | Critical |
| `docs/operations/deployment/launch/verification.md` (Phase 3) | Completion listed as sweep + configure hook, omits migrate in CCA path | Completion checklist must include sweep + migrate + hook config + collector alignment | Critical |
| `README.md` fee flow sections | Unqualified buy+sell fee language | Separate native buy-side plane from hook-dependent fee plane | High |
| `docs/architecture/index.md` fee diagrams/text | Single-lane fee narrative for all DEX sides | Two-plane fee trigger matrix + lane-specific recipients | High |
| `docs/tokenomics/index.md` fee policy claims | Unconditional buy/sell tax claims | Conditional policy with required deployment proofs | High |
| `frontend/README.md` split numbers | Legacy split ratios as product truth | Gauge split is configurable; publish live defaults explicitly | High |
| `cre/README.md` payout integrity wording | Treats payout recipient as one invariant | Split monitoring into `tradeFeeCollector` vs `externalRevenueRecipient` invariants | Critical |
| `cre/cre-workflows/payout-integrity/main.ts` messages | Generic payoutRecipient alarms | Lane-specific alarms and mode-aware checks | High |
| `contracts/helpers/hooks/TaxHookConfigurator.sol` comments | Stale split examples in comments | Mark split as configurable and source from gauge config | Medium |
| `contracts/utilities/routers/PayoutRouter.sol` notice/comments | "creator earnings" wording suggests direct creator cash | Clarify external revenue accretion lane and holder PPS impact | Medium |

# 5. Deployment Invariant Checklist

| Invariant | Why it matters | Must block launch if false? |
|---|---|---|
| `tradeFeeCollector` alignment across OFT and hook planes | Prevents fee misrouting and broken economics | Yes |
| `externalRevenueRecipient` mode is explicit (router mode vs direct mode) | Prevents lane-B/lane-C conflation and monitoring drift | Yes |
| If `creatorShareBps > 0`, `creatorTreasury != 0` | Prevents silent creator-lane disable/misdirection | Yes |
| Router mode requires live `burnStream`, swap path(s), and keeper/operator wiring | Prevents stuck external revenue and false PPS assumptions | Yes |
| Hook activation finalized for intended trading pair/pool before declaring completion | Prevents incomplete fee-plane go-live | Yes |
| Public fee-policy claim matches deployed reality (buy-plane/hook-plane truthfulness) | Prevents incorrect disclosures and operator mistakes | Yes |
| Gauge split integrity holds (`burn + lottery + creator + protocol == 10000`) | Prevents value leakage and undefined branch behavior | Yes |
| Completion status requires sweep + migrate + hook config (or explicit approved exception) | Prevents "settled but not actually complete" states | Yes |
| Jackpot boundary checks: gauge is custodian, lottery manager is authority only | Prevents custody/authority operational errors | Yes |
| Monitoring includes `swept_not_migrated` and `migrated_unconfigured` alerts | Ensures keeper and ops close all completion gaps | Yes |

## Keeper/automation implementation plan detail

1. Upgrade keeper bridge/workflow to include migration phase:
   - current gap: sweep-only bridge path,
   - target: idempotent multi-phase completion path.
2. Add migration-readiness checks (`migrationBlock`, lifecycle flags) before attempting `migrate`.
3. Add hook-config phase:
   - execute when authorized signer is available,
   - otherwise set explicit `awaiting_owner_hook_config` status and keep completion open.
4. Change settlement DB semantics:
   - `settled` only after canonical completion predicates,
   - introduce intermediate statuses for observability.
5. Keep UI manual controls for owner-gated fallback and emergency recovery.

# 6. Public Product Truth

CreatorVault has multiple value lanes that must not be merged:

- **Genesis ownership lane:** creator genesis ownership comes from deployment-time vesting allocation.
- **Trade-fee lane:** trading fees flow to the `tradeFeeCollector` domain and are resolved by gauge splits.
- **Jackpot lane:** jackpot reserve is custodied by gauge; lottery manager only triggers payouts.
- **External revenue lane:** external payouts routed to `externalRevenueRecipient` can be configured for holder accretion via router + burn stream.
- **Creator ongoing revenue lane:** direct creator treasury flow exists only when `creatorShareBps` is enabled and treasury is configured.

Fee policy is conditional by design:

- Native OFT fee logic is not equivalent to unconditional buy+sell taxation.
- Hook-configured fee behavior must be activated and verified before public buy/sell fee claims are made.

Launch completion is an operational state, not a single transaction:

- Sweep, migrate, and hook configuration/alignment must all be complete before launch is treated as fully live.

# 7. Remaining Unknowns

1. Deployed hook contract authorization model and effective permissions are deployment-specific and not fully provable from this repo alone.
2. Whether keeper signer is authorized to execute hook config in production depends on account-owner architecture and ops policy.
3. Exact runtime `addressType` registrations across venues determine native buy-fee coverage in practice.
4. CreatorCoin implementation details and deployed payout-recipient behavior outside this repo may affect external revenue semantics.
5. Monitoring and database status semantics currently differ across keeper paths; production behavior depends on which path is active.
6. Split values are configurable; published docs must bind to live config source-of-truth, not stale constants.
