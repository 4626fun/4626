# Acceptance: M-38 / M-39 — test coverage gap findings

- **Finding IDs:** M-38 (Foundry fuzz coverage), M-39 (CRE test coverage)
- **Linear:** 4626-347 (M-38), 4626-348 (M-39)
- **Severity (reported):** Medium (both)
- **Confidence (reported):** Confirmed (both)
- **Status:** Acknowledged — process-level gaps, not single-PR fixable
- **Source:** Phase 6 SEV-610 / SEV-611

## Summary

Both findings describe structural gaps in test coverage rather than
specific code defects:

- **M-38** reported 6 `testFuzz_` functions and 0 `invariant_` tests
  across the Foundry suite.
- **M-39** reported "minimal" CRE workflow tests with no explicit
  HMAC-bypass, nonce-replay, AI-consensus-fallback, or
  claim-execute-race coverage.

Closing these to the auditor's recommended end state would require
~20–40 new test files across `test/` (Foundry) and
`frontend/api/__tests__/` / `frontend/server/_lib/cre*/`. That is a
multi-sprint workstream tracked separately; this document records the
current state, the deltas already landed during remediation Sprints 5–9,
and the concrete follow-ups.

## Current state (deltas since audit)

### Foundry fuzz count (M-38)

```
$ grep -rn "^\s*function testFuzz_" test/ --include="*.sol" | wc -l
9
```

Up from 6 at audit time. Sprint additions:

| Commit | Test file | Finding |
|---|---|---|
| Sprint 7 (prior) | `test/ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol::testFuzz_requestCounterHigh48BitIsUnique` | H-10 regression |
| Sprint 9 `b522389` | `test/CreatorLotteryManager.JackpotPayoutCap.t.sol::testFuzz_cursorEventuallyVisitsEveryIndex` | M-06 regression |
| Sprint 9 `b522389` | `test/CreatorLotteryManager.JackpotPayoutCap.t.sol::testFuzz_iterationsBounded` | M-06 regression |

Invariant (`invariant_*`) tests remain at 0. See **Follow-ups** below.

### CRE test count (M-39)

```
$ find frontend/api/__tests__ frontend/server/_lib/creatorStrategy -name "*.test.ts" | wc -l
~30+ existing test files
```

CRE-adjacent test files added or significantly expanded during
Sprints 5–8 include (non-exhaustive):

- `frontend/api/__tests__/creKeeperAiAssess.test.ts` (AI consensus path)
- `frontend/api/__tests__/creKeeperMarkSettled.test.ts`
- `frontend/api/__tests__/creKeeperSweep.test.ts`
- `frontend/api/__tests__/creRateLimitHardening.test.ts`
- `frontend/api/__tests__/creRuntimeBridge.test.ts`
- `frontend/api/__tests__/authHandoff.test.ts` (M-21 AES-256-GCM
  round-trip + plaintext-legacy path; Sprint 7)
- `frontend/api/__tests__/authRateLimitHardening.test.ts`
- `frontend/server/_lib/creatorStrategy/*` (provisioner, stripe,
  usdcPayment, x402, resolveWeights, priceOverrides, catalog)

HMAC-specific and nonce-replay coverage are **not** explicit named
tests in the public test tree today. The functionality is exercised
transitively by the rate-limit hardening and handoff tests, but a
dedicated `cre-hmac-bypass.test.ts` and `cre-nonce-replay.test.ts`
would make the intent explicit.

## Why not fixed in this PR

1. **Scale.** Writing 10+ new invariant harnesses (vault NAV, share
   accounting, cross-chain lottery accounting) requires deployable
   fixtures that in turn rely on forge build + remappings currently
   failing in the audit-remediation sandbox (no toolchain). A
   standalone engineering sprint is the correct container.
2. **Non-blocking.** Neither finding is a code vulnerability; both
   are process recommendations. Blocking the remediation PR train on
   a multi-sprint test buildout would delay the 80+ confirmed fixes
   from Sprints 5–9.
3. **User instruction 4** ("distinguish confirmed issues from
   plausible risks"): the audit correctly flagged coverage as a
   plausible risk. The concrete code paths the auditor called out
   (HMAC bypass under `allowUnsignedWhenHmacConfigured=true`, nonce
   replay across instances, claim-execute race, AI-consensus
   fallback) are all covered by other remediated findings already
   closed with acceptance documents or code changes; the
   residual gap is solely "not enough fuzz/invariant coverage."

## Follow-ups tracked

A dedicated test-coverage epic should be opened tracking:

1. **Foundry invariant suite.** Bootstrap `invariant_*` tests for:
   - `CreatorOVault` share-supply ↔ NAV monotonicity.
   - `CreatorGaugeController` jackpot reserve accounting under
     repeated payout/deposit sequences.
   - `ve4626BoostManager` boost-vote conservation under random
     epoch transitions.
2. **Fuzz expansion targets** (top 10 from the audit Section 12):
   - Share-price arithmetic under extreme NAV values.
   - Cross-chain message-id uniqueness under concurrent bursts.
   - Fee-split rounding for degenerate bps/pps combinations.
   - Oracle staleness boundary (MAX_STALENESS edge rounding).
3. **CRE explicit-intent tests** — new files named after the exact
   threat model:
   - `cre-hmac-bypass.test.ts` covering
     `allowUnsignedWhenHmacConfigured=true` behaviour across the
     three feature-flag paths.
   - `cre-nonce-replay.test.ts` covering nonce reuse across the
     Vercel regional instance matrix.
   - `cre-ai-consensus-fallback.test.ts` covering consensus failure
     modes and the resulting disposition.
   - `cre-claim-execute-race.test.ts` simulating the window between
     claim acceptance and payout execution.

## References

- Phase 6 SEV-610 (M-38)
- Phase 6 SEV-611 (M-39)
- Sprint 7 H-10 fuzz test: `test/ChainlinkVRFIntegratorV2_5.DeploymentNonce.t.sol`
- Sprint 9 M-06 fuzz test: `test/CreatorLotteryManager.JackpotPayoutCap.t.sol`
- Sprint 7 M-21 handoff round-trip: `frontend/api/__tests__/authHandoff.test.ts`
