# L-29 — `docs/integrations/solana-spoke-article.md` Solana program ID staleness

- Finding: L-29 (Linear: 4626-377)
- Severity: Low
- Disposition: **Fixed** — article now cites `Anchor.toml` as the canonical source and notes the last-verified date. No address discrepancy was found at audit time.

## Problem

L-29 flagged that Solana program IDs in `docs/integrations/solana-spoke-article.md` might be stale, citing a potential divergence with `solana-bridge-naming-invariant.md`.

## Verification

Only one program ID appears in the article: `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` (line 104, `creator_share_hook`). Cross-checked against every other location in the tree:

- `Anchor.toml` (localnet / devnet / mainnet entries) — **matches**.
- `cre/config.ts` line 26 — **matches**.
- `cre/tests/keepr-solana-winner-relay.test.ts` line 89 — **matches**.
- `AGENTS.md` operations runbook — **matches**.
- `docs/_internal/audits/internal-monorepo-audit-2026-03-30.md` — **matches**.

There is no `solana-bridge-naming-invariant.md` in the tree at the audited commit (`git ls-files | grep -i naming-invariant` returns nothing). The finding's cited counter-reference does not exist; no live discrepancy.

## Fix

The article now includes a note immediately after the program ID:

> **Canonical program-ID source:** [`Anchor.toml`](https://github.com/wenakita/4626/blob/main/Anchor.toml) is authoritative for the `creator_share_hook` program ID on every cluster. The value above is verified to match `Anchor.toml` and `cre/config.ts` as of 2026-04-22. If the two ever diverge, `Anchor.toml` wins.

This satisfies the remediation ask ("Last verified" timestamp + link to authoritative registry) and establishes the drift-detection contract for future updates.

## Follow-ups

- When the Solana program is redeployed to a new program ID (unlikely — design is upgrade-in-place), update `Anchor.toml` first, then `cre/config.ts`, then propagate to docs.
