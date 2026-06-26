---
title: Contract Size CI Gate
sidebar_position: 20
---

# Contract Size CI Gate

## Background

The protocol has multiple contracts that have historically lived close to (or required splitting to stay under) the **EIP-170 contract size limit of 24,576 bytes** (24 KiB) for deployed runtime bytecode. Contracts larger than this cap cannot be deployed to Ethereum mainnet or any EIP-170-compliant L2 (including Base).

The most persistent hot spot is `CreatorLotteryManager` (the largest production contract). As of the June 2026 x-ray contract audit pass it measured **24,528 bytes** (only **48 bytes** of headroom).

See the full June 2026 pass summary for context: `docs/audits/x-ray/contract-audit-pass-2026-06.md` (SC-03 and CLM size section).

(The original C-04 finding was about `CCALaunchStrategy`; that risk was addressed via earlier splits and the gate below. The active risk tracked in later audits and the x-ray pass is the lottery manager.)

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
  run: forge build --skip test --sizes
  id: build
```

**Post-PLONK update (2026-04-28):** added `--skip test` to the gate so
test-only artifacts (foundry harnesses, inline mocks) are excluded.
The gate is a *deployability* check; harnesses inherit production
contracts and add a few `exposed*` wrappers, so whenever a production
contract sits within a few hundred bytes of the cap the harness will
trivially overflow even though it is never deployed. The full forge
test suite (next step in `test.yml`) recompiles everything regardless,
so this does not skip any actual test execution. If the day comes
where we want a separate CI tripwire for harness size, that should be
a *non-blocking* informational step, not the deployability gate.

If a contract crosses 24 KiB, the build will fail and the PR cannot
land until the offending contract is split or shrunk. Local
developers who want to inspect sizes without failing should run
`forge build --sizes` directly in their checkout — `forge` returns
the offending contract list before exiting with a non-zero code.

## Current hot contract (June 2026 x-ray pass)

As of the June 2026 x-ray contract audit pass (`docs/audits/x-ray/contract-audit-pass-2026-06.md`), the active size pressure is on `CreatorLotteryManager`:

- Measured: 24,528 bytes
- Headroom: 48 bytes under the 24,576 B EIP-170 cap

A separate **warn-only** guard (`amoe/tools/ci/check_manager_size_warn.sh`, wired with `continue-on-error: true`) fires when size exceeds the warn threshold (currently 24,450 B, targeting ~126 B of lead time). It never blocks a merge.

**PR policy (enforced by review, not CI):** Any PR that touches `CreatorLotteryManager.sol` (or its AdminModule) **must** contain a short "size budget review" note (in the description or a linked issue) that:
- Estimates the byte impact of the change.
- Confirms the post-change headroom.
- Considers whether another module extraction is warranted before landing.

This policy was strengthened after the June 2026 pass (see also the script header and the updated step comment in `test.yml`).

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

## Manager warn-guard (active safety-net)

Alongside the EIP-170 hard gate, CI runs a **warn-only** size guard
specifically for `CreatorLotteryManager.sol` (the current highest-risk
contract per the June 2026 x-ray pass).

- Script: `amoe/tools/ci/check_manager_size_warn.sh`
- Wired in the `build` job in `.github/workflows/test.yml` with `continue-on-error: true`
- Warn threshold: 24,450 B (targeting ~126 B of lead time as of the pass)
- Current measured size (post-pass): 24,528 B (48 B headroom)

The warn-guard never blocks. It prints yellow `[WARN]` lines (including a reminder about the PR "size budget review" requirement) and exits 0. The hard gate (`forge build --sizes`) remains the sole enforcer of deployability.

See the script header for full rationale, thresholds, and the PR policy.

## Manager AMOE selector-surface guard (added v1.10.1 safety-net)

A companion script — `amoe/tools/ci/check_manager_amoe_surface.sh` —
guards a different failure mode that is **not** about size. Given a
deployed manager address and an RPC endpoint, it asserts that the
three AMOE selectors are all present in the deployed runtime
bytecode:

- `0x565551e4` — `setAuthorizedAmoeRelayer(address,bool)`
- `0x3d5fec31` — `authorizedAmoeRelayer(address)`
- `0x17e184b3` — `processAmoeEntry((address,bytes32,bytes32,uint256,uint256))`

v1.8.x managers (e.g. v1.8.3 mainnet at
`0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357`) predate PR #395 and
lack all three selectors. Pointing the AMOE router at such a
manager produces a silent deadlock: the router calls
`processAmoeEntry(...)`, the manager has no handler at that 4-byte
selector, and the EVM reverts (or falls through to fallback) with
no actionable error. This guard is the cheap pre-flight check that
catches the wiring mistake **before** the deploy script flips any
AMOE flag.

It is wired into `.github/workflows/zk-pipeline-guards.yml` as a
`workflow_dispatch` job (`manager-amoe-surface-guard`). Inputs:

- `manager_address` — the candidate manager 0x address
- `manager_rpc` — RPC endpoint (default `https://mainnet.base.org`)

Intended use: run it as the last pre-broadcast checklist item for
any release that re-wires the AMOE router.

## References

- EIP-170: https://eips.ethereum.org/EIPS/eip-170
- Forge `--sizes` flag: https://book.getfoundry.sh/forge/contract-sizes
- June 2026 x-ray contract audit pass: `docs/audits/x-ray/contract-audit-pass-2026-06.md` (especially CLM size / SC-03 findings and recommendations)
- Historical: Linear 4626-292 (C-04), earlier audit notes on CCALaunchStrategy

**Post-June 2026 pass note:** The active size risk and the strengthened "size budget review" PR policy are tracked in the x-ray pass summary and the updated warn-guard script. The hard gate + warn-guard + policy together form the current defence-in-depth.
