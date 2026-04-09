# Solana Strategy Accounting Design

## Problem

Solana integration is currently out-of-band from vault strategy accounting. `CreatorOVault` strategy semantics (weighting, debt tracking, `totalAssets()`, `report()`, and withdrawal queue behavior) only apply to on-Base strategies like Charm and Ajna. You want Solana exposure to be managed under the same `CreatorOVault` semantics.

## Goals

- Represent Solana exposure as a first-class `IStrategy` in `CreatorOVault`.
- Keep user withdrawals synchronous on Base by default.
- Keep `CreatorOVault` accounting invariants intact (`deposit/withdraw/report/totalAssets`).
- Use keeper-reported Solana NAV with strict guardrails for fast, practical rollout.
- Preserve existing phase-based deploy flow with minimal route/UX churn.

## Non-Goals

- Full trust-minimized cross-chain proof verification in this phase.
- Async withdrawal queue UX for standard user flows.
- Reworking ERC-4626 share math in `CreatorOVault`.
- Changing canonical wallet/deploy routes.

## Decision

Use **Option A**: a single `SolanaStrategy` contract implementing `IStrategy` + `IStrategyValuation`.

- `CreatorOVault` sees one normal strategy with standard strategy weight/debt behavior.
- Strategy tracks:
  - Base liquid assets (instant withdrawal capacity)
  - Remote Solana NAV (keeper-updated)
- `getTotalAssets()` includes both buckets when valuation is healthy.
- Withdrawals are synchronous from Base-side liquidity only.

## Architecture

### New Contract

- Add `contracts/vault/strategies/SolanaStrategy.sol`.
- Implement:
  - `IStrategy`
  - `IStrategyValuation`
- Conform to current vault checks:
  - `asset()` must equal vault asset (Creator Coin)
  - `deposit()` and `withdraw()` must return measured values safely

### Core State

- `address public vault`
- `IERC20 public immutable CREATOR`
- `address public adapter` (Solana bridge adapter)
- `uint256 public remoteNav`
- `uint64 public remoteNavUpdatedAt`
- `uint64 public maxNavAge`
- `uint16 public maxNavDeltaBpsPerUpdate`
- `uint16 public minBaseLiquidityBps`
- `bool public remoteNavEnabled`
- `bool public emergencyPaused`
- keeper authorization mapping and emergency role addresses

### Asset Model

- `baseLiquid = CREATOR.balanceOf(address(this))`
- `remoteNav = guarded keeper-reported value`
- `getTotalAssets()`:
  - if `remoteNavEnabled` and valuation healthy: `baseLiquid + remoteNav`
  - else: `baseLiquid`

This keeps solvency conservative during stale/unhealthy periods.

## Valuation and Trust Guardrails

### Keeper NAV Updates

- Authorized keepers call `updateRemoteNav(uint256 newRemoteNav, bytes32 reportId)`.
- Contract enforces:
  - staleness freshness window (`maxNavAge`)
  - per-update delta cap (`maxNavDeltaBpsPerUpdate`)
  - monotonic timestamp progression
  - optional replay guard via `reportId`

### Safety Switches

- `remoteNavEnabled` toggle for controlled rollout or incident response.
- emergency pause to stop bridge/rebalance paths.
- stale or unhealthy valuation causes `isValuationReady()` to return false, which already gates vault deposit/mint/report paths via existing `CreatorOVault` module logic.

## Strategy Operation Flow

### deposit(amount)

- Called only by vault.
- Pulls/accepts Creator Coin from vault as normal strategy deposit path.
- Keeps funds in Base liquid bucket initially.
- Returns exact `amount` to satisfy vault exact-accounting checks.

### rebalanceToSolana(amount, destination, ixs)

- Keeper-only operation.
- Can only move assets above required Base buffer.
- Bridges via adapter call path.
- Emits reconciliation event for offchain observability.

### rebalanceFromSolana(...)

- Keeper-only operation to bring liquidity back to Base.
- On receipt, Base liquid bucket rises; keeper then updates NAV snapshot.

### withdraw(amount)

- Called by vault only.
- Serves from Base liquid bucket only.
- Never blocks on synchronous cross-chain settlement.
- Returns actual withdrawn amount to vault.

### harvest()

- No forced asset movement.
- Computes profit signal from asset deltas and emits strategy event.
- Vault `report()` remains the source of truth for share/accounting effects.

## Failure Handling

- **Bridge delay/failure:** strategy stays operational with Base buffer; remote NAV can be frozen/disabled.
- **Keeper outage:** stale NAV eventually makes valuation not ready; vault blocks unsafe new deposits/mints/reports.
- **Bad keeper update:** delta circuit breaker blocks extreme jumps; emergency role can disable remote NAV.
- **Withdrawal pressure:** if Base liquidity is insufficient, vault fallback behavior across strategy queue remains intact; strategy never fakes liquidity.

## Integration Changes (Planned)

- Add new strategy code ID to bytecode store seed flow:
  - `script/SeedUniversalBytecodeStore.s.sol`
  - frontend deploy code ID checks in `frontend/src/pages/deploy/DeployVault.tsx`
- Extend batcher phase-3 deploy path to include SolanaStrategy deployment + vault `addStrategy(...)` weighting.
- Extend phase-3 params/code IDs for Solana-specific config while keeping Ajna/Charm behavior intact.
- Keep Solana route registration at strategy-stage boundary, now aligned with SolanaStrategy deployment.

## Testing Strategy (High-Level)

- Unit tests for `SolanaStrategy`:
  - valuation readiness/staleness behavior
  - delta breaker enforcement
  - synchronous withdrawal guarantees
  - base buffer enforcement on rebalance
- Vault integration tests:
  - `addStrategy(SolanaStrategy, weight)` with asset checks
  - `totalAssets()` + `report()` behavior under healthy/stale NAV
  - multi-strategy withdrawal queue interactions with partial Solana liquidity
- Deployment tests:
  - phase-3 deployment includes SolanaStrategy when configured
  - bytecode store coverage includes SolanaStrategy code ID

## Rollout Plan

1. Ship contract + tests behind feature flag (`enableSolanaStrategy` in phase-3 config path).
2. Deploy to Base, seed bytecode store, and canary on selected creators.
3. Monitor NAV freshness, withdraw success rates, and valuation readiness events.
4. Gradually increase usage and strategy weight defaults.
