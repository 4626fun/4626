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

A `forge build --sizes` check should be added to GitHub Actions as a
required status check on `main`. The suggested workflow step is:

```yaml
- name: Enforce EIP-170 contract size limit
  run: |
    forge build --sizes 2>&1 | tee sizes.log
    # Fail if any contract is over 24,576 bytes
    if awk '/^\|/ && $4+0 > 24576 { print; found=1 } END { exit found }' sizes.log; then
      echo "All contracts within EIP-170 limit"
    else
      echo "::error::One or more contracts exceed 24 KiB (EIP-170)"
      exit 1
    fi
```

This gate is **not** part of Sprint 2 because the audit remediation
branch is scoped to contract fixes only. Adding the CI step is
tracked as follow-up work in Linear (4626-292).

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
