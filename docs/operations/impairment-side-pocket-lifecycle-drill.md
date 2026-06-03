# Impairment Side-Pocket Lifecycle Drill (v1)

This runbook validates the end-to-end impairment lifecycle for `CreatorOVault` v1:

1. trip impairment
2. propose snapshot root
3. challenge and clear root
4. re-propose and finalize
5. notify realized recovery
6. mint claims and claim recovery
7. resolve epoch

## Preconditions

- `CreatorOVault` deployed with modules set.
- `impairmentClaims` and `impairmentRecoveryEscrow` configured.
- strategy exists and is in strategy list.
- `impairmentChallengeWindow` configured to non-zero.

## Canonical test drill

Primary test file:

- `test/CreatorOVault.ImpairmentV1.t.sol`

Core drill cases:

- `test_trip_blocksSyncFlows_untilFinalize`
- `test_finalize_reverts_before_challenge_window`
- `test_challenge_blocks_finalize_until_root_cleared_and_reproposed`
- `test_claimMint_reverts_before_finalize`
- `test_claimMint_reverts_on_duplicate_mint`
- `test_finalize_allowsCleanBook_resume_and_claim_flow`

## Commands

Local targeted drill:

```bash
forge test --match-path "test/CreatorOVault.ImpairmentV1.t.sol"
```

Forked Base drill:

```bash
forge test --fork-url "https://mainnet.base.org" --match-path "test/CreatorOVault.ImpairmentV1.t.sol"
```

## Expected outcomes

- while `vaultMode == Suspect`, ERC-4626 settlement flows are blocked and `max*` returns 0
- finalize before challenge unlock reverts
- challenged root blocks finalization until root is cleared and re-proposed
- claim mint before finalization reverts
- duplicate claim mint reverts
- finalized impaired strategy is excluded from clean `totalAssets()`
- realized recovery is escrowed and claimed pro-rata by epoch claim holders

## Operational checks

- monitor events:
  - `ImpairmentTripped`
  - `ImpairmentRootProposed`
  - `ImpairmentRootChallenged`
  - `ImpairmentRootCleared`
  - `ImpairmentRootFinalized`
  - `ImpairmentFinalized`
  - `ImpairmentRecoveryNotified`
  - `ImpairmentRecoveryClaimed`
  - `ImpairmentResolved`
- alert if:
  - `vaultMode` remains `Suspect` beyond expected window
  - active epoch has no root proposal after trip
  - root challenged without follow-up clear/re-proposal
  - recovery notifications occur while epoch is not finalized/resolved

## Go/No-Go criteria

Go:

- local targeted drill passes
- forked targeted drill passes
- no invariant regressions in impairment tests

No-Go:

- any root challenge flow is non-deterministic
- claim minting possible before finalization
- any path credits impaired recovery into clean NAV

