# L-31 — `docs/audits/codex/remediation-2026-04-02.md` test count discrepancy

- Finding: L-31 (Linear: 4626-379)
- Severity: Low
- Disposition: **Stale finding — acceptance only**. The claimed "289 passing tests" string does not appear in the document at the audited commit. No fix required.

## Verification

`grep -n "289" docs/audits/codex/remediation-2026-04-02.md` returns zero matches. The document's "Verification Snapshot" section does **not** claim any numeric test count; it lists the exact commands run:

- `forge test --match-path test/vault/CreatorVRFConsumerV2_5.RelayFunding.t.sol --match-test test_rateLimitIgnoresExcessRemoteRequestsWithoutRevert`
- `pnpm lint` (frontend)
- `pnpm typecheck` (frontend)
- `pnpm vitest run` targeted suites for touched API/AA/AI/migration/waitlist/keepr modules
- `node` smoke check for bigint-buffer width behavior
- `cargo test allowlisted_buy` in `programs/creator-share-hook`

This is a per-finding verification list, not a global pass-count. The "discrepancy with `forge test`" framing of L-31 does not apply to the current doc.

## Why no change

The document's approach — citing exact commands rather than a global pass count — is more robust than the pass-count pattern L-31 recommends, because it is grepable and pinned to a specific finding. Replacing the per-command list with a single "N tests pass" line would be a regression. A future `forge test --json` artifact is still a reasonable addition but is not needed to resolve this finding.

## Follow-ups

- If a future revision does introduce a global pass count, attach the `forge test --json` output as the source-of-truth artifact alongside it.
