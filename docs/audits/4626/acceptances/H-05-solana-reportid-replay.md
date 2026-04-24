# H-05 (4626-437): SolanaStrategy reportId replay guard

**Status:** Acceptance — fix shipped
**Finding:** H-05
**Linear:** [4626-437](https://linear.app/4626fun/issue/4626-437) (sub-ticket of meta [4626-422](https://linear.app/4626fun/issue/4626-422))
**Severity:** High / Critical (pre-merge blocker per GitHub issue [#347](https://github.com/wenakita/4626/issues/347))
**File:** `contracts/vault/strategies/SolanaStrategy.sol`
**Scope affected:** `updateRemoteNav(uint256,bytes32)`, `reconcileFromSolana(uint256,bytes32)`

## Problem

Both keeper-only entry points accepted a `reportId bytes32` parameter but only used it as an event-field for off-chain correlation. The on-chain path never tracked which `reportId` values had been consumed. A compromised relayer, a keeper-key leak, a cross-chain re-org on the Solana side, or a buggy retry loop could therefore re-submit the same report and:

- In `updateRemoteNav`: ratchet `remoteNav` upward step-by-step within the 5 % per-hour anchor window, since each individual replay is within the delta cap. The hourly `navWindowAnchor` (FIX C-01) bounds the *total* drift from the window start, but it does **not** prevent re-submitting the same observation many times and inflating PPS by up to `maxNavDeltaBpsPerUpdate` per call until the anchor rolls.
- In `reconcileFromSolana`: double- or N-count `totalReconciledFromSolana` on every replay, desynchronising Base-side bridge accounting from the real Solana receipt state.

The audit fix description specified `mapping(bytes32 => bool) public usedReportIds` with checks on both functions, but the mapping was absent from `main` at the time of the pre-merge audit verification (commit `5288ac1`).

## Fix

Added to `SolanaStrategy.sol`:

1. `mapping(bytes32 => bool) public usedReportIds` — persistent replay set.
2. `error InvalidReportId()` — reverts on `bytes32(0)` input. Forces the keeper and off-chain tooling to always supply a meaningful identifier derived from `(srcChain, slot, nonce)`; prevents the "zero is a valid id" foot-gun.
3. `error ReportIdAlreadyUsed()` — reverts when the same id is resubmitted.
4. `event ReportIdConsumed(bytes32 indexed reportId, bytes32 indexed context)` — observability for off-chain monitors; `context` is the function name (`"updateRemoteNav"` / `"reconcileFromSolana"`) so a single filter resolves both surfaces.
5. Guard block at the top of both functions:

   ```solidity
   if (reportId == bytes32(0)) revert InvalidReportId();
   if (usedReportIds[reportId]) revert ReportIdAlreadyUsed();
   usedReportIds[reportId] = true;
   emit ReportIdConsumed(reportId, <context>);
   ```

   Placed **before** any state effects and before the C-01 window-anchor roll so a replay cannot even warp the anchor forward.

### `reconcileFromSolana` zero-amount behaviour

`reconcileFromSolana` already short-circuits on `amount == 0` (keeps the noop semantics). The replay guard runs **after** that short-circuit, so a zero-amount call does not consume the `reportId` — the legitimate later non-zero report can still use the same id. Tested explicitly in `test_reconcileFromSolana_allowsZeroAmount_withoutConsumingReportId`.

## Tests

Added to `test/vault/strategies/SolanaStrategy.Valuation.t.sol`:

- `test_updateRemoteNav_reverts_whenReportIdZero`
- `test_updateRemoteNav_reverts_whenReportIdReplayed`
- `test_updateRemoteNav_marksReportIdUsed`

Added to `test/vault/strategies/SolanaStrategy.Flows.t.sol`:

- `test_reconcileFromSolana_reverts_whenReportIdZero`
- `test_reconcileFromSolana_reverts_whenReportIdReplayed`
- `test_reconcileFromSolana_allowsZeroAmount_withoutConsumingReportId`

All existing tests that previously passed `bytes32(0)` as the reportId have been updated to use distinct non-zero ids (`"v1"`, `"v2"`, `"flow-nav-1"`, `"flow-r-unauth"`, etc.). Uniqueness is trivial within each test (each test has its own `setUp` fresh contract); a single in-test call-chain that needs two writes uses two distinct ids.

## Off-chain / keeper impact

The keeper process must now:

- Always supply a unique non-zero `reportId` on every `updateRemoteNav` and every non-zero-amount `reconcileFromSolana`.
- Derive `reportId` deterministically from an off-chain source of truth (recommended: `keccak256(abi.encode(srcChain, slot, nonce))` — deterministic, collision-resistant, re-derivable on retry so the keeper idempotently reports the same observation under the same id, making on-chain replay protection align with off-chain retry semantics).

This is a breaking change for any keeper wrapper that previously relied on the `bytes32(0)` default. A keeper-side change ticket should track the rollout; the on-chain contract is backward-compatible for any keeper that already supplies a unique id.

## Refs

- Linear: 4626-437 (fix), 4626-422 (meta), 4626-311 (M-02 related ring-buffer gap tracked separately).
- GitHub: issue [#347](https://github.com/wenakita/4626/issues/347) (pre-merge blocker rollup).
- PR: this PR.
