# Canonical Lane Naming Audit — 2026-04

Follow-up to the decision recorded in `AGENTS.md` ("Canonical Lane
Terminology") and `docs/audits/creatorvault-business-logic-core-structure-audit.md`
(§3 "Naming Cleanup").

This audit scanned the repo for the three ambiguous-term classes called out
by the audit and recorded the outcome so future PRs don't re-run the same
grep.

## Scope

Searched across `.ts`, `.tsx`, `.js`, `.mjs`, `.md`, `.json`, `.yml`,
`.yaml`, `.toml`. Excluded `node_modules`, generated docs-site bundles,
`docs/_generated`, and `pnpm-lock.yaml`.

## Phase 1 — `payoutRecipient` (generic)

- **Hits:** 267 across 72 files.
- **Verdict:** leave almost all as-is.

Reason: the vast majority of hits are legitimate literal uses of the onchain
field name:

1. ABI definitions (`{ name: 'payoutRecipient', type: 'address' }`)
2. Contract read calls (`functionName: 'payoutRecipient'`)
3. Destructured variable names that mirror the onchain field
   (`const { payoutRecipient } = await resolveCoinParties(...)`)
4. Error messages and logs that are already qualified as
   "CreatorCoin payoutRecipient" (which *is* the `creatorCoinPayoutRecipient`
   canonical form under the audit's naming policy)

Renaming variables away from the onchain field name would diverge from the
ABI and increase cognitive overhead without clarifying anything.

### Applied patches

- `frontend/server/_lib/onchain/coinParties.ts` — file-level JSDoc added.
  Names the canonical lane (`creatorCoinPayoutRecipient`) and records that
  the literal variable name mirrors the onchain field on purpose.
- `frontend/src/lib/creator/creator-coin-resolver.ts` — file-level JSDoc
  added. Same pattern.

### Deliberately left alone

- Contract ABI arrays and `readContract({ functionName: 'payoutRecipient' })`
  calls across `frontend/api/_handlers/paymaster/_paymaster.ts`,
  `frontend/api/_handlers/cre/keeper/_sweep.ts`,
  `frontend/server/_lib/deploy/deployPhase2Invariants.ts`,
  `frontend/src/pages/deploy/DeployVault.tsx`, etc.
- Onchain read-back variables in `deployPhase2Invariants.ts` and
  `_sweep.ts` — they ultimately get compared against the canonical lane
  target, and the surrounding invariant-code comments already specify which
  mode (`gauge` vs `payout_router`) is expected.
- `CoinManage.tsx` renders the CreatorCoin `payoutRecipient()` read directly
  in a field labeled by surrounding UI as the creator-coin payout recipient.
  The label is already qualified by its parent section.
- Generated docs under `apps/docs-site/**` and `docs/_generated/**`
  (they regenerate from source).

## Phase 2 — `externalRevenueRecipient`

- **Hits:** 12 across 6 files.
- **Verdict:** leave the wire-format strings as-is.

The only hits are the `external_revenue_recipient_unresolved` and
`external_revenue_recipient_mismatch` **error codes / alert types** in:

- `frontend/server/_lib/deploy/deployPhase2Invariants.ts`
- `frontend/api/_handlers/cre/keeper/_sweep.ts`
- `frontend/api/__tests__/deploySession.test.ts` (matching expectations)
- `frontend/server/_lib/deploy/deployPhase2Invariants.test.ts` (matching
  expectations)
- `cre/cre-workflows/payout-integrity/main.ts` (`alertType` strings)

These strings are wire-compatible across:

- DB rows (`lastError` on deploy sessions)
- CRE workflow alert streams
- Test fixtures / snapshot expectations
- Operational runbooks

Changing them is not a rename — it's a protocol migration. The risk
outweighs the clarity gain. Callers already know the error code refers to
the CreatorCoin external revenue lane; the internal stance is documented
here and in `AGENTS.md`.

If the wire format ever changes for an unrelated reason, the rename to
`creator_coin_payout_recipient_*` can ride along.

## Phase 3 — "creator earnings" / "lottery wallet" / "lottery manager"

- **Hits:** "creator earnings" — 4 product-code hits; "lottery wallet" — 0;
  "lottery manager" — ~15 hits, all already qualified.
- **Verdict:** no product-code changes needed.

Findings:

1. `frontend/src/pages/CreatorEarnings.tsx` uses "Creator earnings" as a
   page headline and column label. The page's description text
   ("Lifetime creator earnings from Zora coin trades. Paid to the coin's …")
   and the data model (`payoutRecipientAddress` from Zora) make the
   external-revenue-lane framing unambiguous in context. The audit's
   "(unspecified)" tag doesn't apply here.
2. "Lottery wallet" does not appear in the repo.
3. "Lottery manager" only appears in contexts that are already bound to
   `CreatorLotteryManager.sol` (skill docs, generated contract docs, contract
   interface references). None of the hits use it as a generic "the thing
   that custodies jackpot funds" — that confusion is exactly the
   `jackpotCustodian` / `jackpotPayoutAuthority` split the audit calls for,
   and the codebase is already consistent.

## Net outcome

The canonical lane terminology policy is effectively enforced in the code
today. The remaining delta is prose hygiene: the AGENTS.md section added in
commit `6df0e83e` is the primary defense for future PRs. This audit report
records the scan so we don't re-run the same grep in a future session.

## If you disagree

The one reasonable challenge is phase 2 — renaming the
`external_revenue_recipient_*` error codes to
`creator_coin_payout_recipient_*`. If that's taken, plan it as:

1. Add the new codes as accepted aliases server-side.
2. Bump producers (`deployPhase2Invariants.ts`, `_sweep.ts`) to emit both for
   one release window.
3. Migrate test expectations.
4. Drop the old codes once no DB rows or runbooks reference them.

Otherwise we're done.
