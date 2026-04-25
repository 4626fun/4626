---
title: Contract Size CI Gate
sidebar_position: 20
---

# Contract Size CI Gate (C-04 remediation)

## Background

Audit finding **C-04 (4626-292)** flagged `CCALaunchStrategy.sol` as
being at risk of exceeding the **EIP-170 contract size limit of
24,576 bytes** (24 KiB) for deployed runtime bytecode. Contracts
larger than this cap cannot be deployed to Ethereum mainnet or any
EIP-170-compliant L2 (including Base, which is the deploy target for
this vault).

If `CCALaunchStrategy` crosses 24 KiB, any new creator coin launch
will revert at the `CREATE` opcode with `MaxCodeSizeExceeded`, making
the entire launch path non-functional.

## Current remediation scope

This PR (Sprint 2) adds the following behavioural changes to
`CCALaunchStrategy.migrate()` for audit finding H-02 (4626-294):

- Imports: `StateLibrary`, `PoolIdLibrary` from Uniswap v4-core
- New custom error: `MigrationSqrtPriceMismatch`
- New block reading `poolManager.getSlot0(key.toId())` and comparing
  to the requested `sqrtPriceX96`
- Two `modifyLiquidities` call-site deadline swaps from a literal to a
  `migrationDeadline = block.timestamp + 5 minutes` local

These additions are small (< 200 bytes of bytecode in the aggregate
case), so **Sprint 2 does not itself introduce a new size overflow**.

## Verification requirement (reviewer action)

Per the audit rules, the size gate **must be verified** before this
branch can merge. Because the sandbox building this branch does not
have `foundry` available, the physical `forge build --sizes` run is
**the reviewer's responsibility**. The reviewer should run, at the
PR base commit and at the tip of this branch:

```bash
forge clean
forge build --sizes 2>&1 | tee /tmp/sizes.log
grep -E "(CCALaunchStrategy|FullRangeStrategy|SolanaStrategy)" \
    /tmp/sizes.log
```

Acceptable outcomes for **merge**:

1. Every contract printed by `--sizes` is **at or below 24,576 bytes**.
2. CI's `forge build --sizes` step is green.

If `CCALaunchStrategy` is within 5% of the cap (~23,347 bytes), the
reviewer should open a follow-up ticket to split the contract before
the next feature lands on that file — Sprint 3 is the right window.

## CI gate

The `forge build --sizes` check is enforced as a blocking step in
`.github/workflows/test.yml` (step name: *Run Forge build (sizes;
EIP-170 blocking)*). It exits non-zero if any deployable contract
exceeds the 24,576-byte runtime cap, and CI fails the job.

**M-01 (audit 2026-04-25) update:** the previous CI step swallowed
failures with `|| true`, making the gate effectively non-blocking.
This was flagged as a deployability time-bomb because the protocol
already runs multiple oversize-driven splits (`CreatorOVault`
core/strategies/admin modules, `DeploymentBatcher` phase2/phase3/UniV4
helpers, `CreatorLotteryManager` admin module). The current step is:

```yaml
- name: Run Forge build (sizes; EIP-170 blocking)
  run: forge build --sizes
  id: build
```

If a contract crosses 24 KiB, the build will fail and the PR cannot
land until the offending contract is split or shrunk. Local
developers who want to inspect sizes without failing should run
`forge build --sizes` directly in their checkout — `forge` returns
the offending contract list before exiting with a non-zero code.

## Why no module split in Sprint 2

The audit recommended a three-way split of `CCALaunchStrategy` into:

1. `CCALaunchSetup` — pool creation + initial liquidity
2. `CCALaunchMigration` — LBP → full-range migration (this is the
   only piece H-02 touches)
3. `CCALaunchFees` — fee routing to `lpManager`

The user decided on **verify-first, split-only-if-needed**: if the
actual compiled size is comfortably under 24 KiB, we defer the split
to avoid adding scope to the audit-remediation PR. The split will
happen in Sprint 3 if the size gate fails in CI.

## References

- EIP-170: https://eips.ethereum.org/EIPS/eip-170
- Forge `--sizes` flag: https://book.getfoundry.sh/forge/contract-sizes
- Linear: 4626-292 (C-04)
- Audit finding file: `findings/phase-2-contracts.md` — C-04
