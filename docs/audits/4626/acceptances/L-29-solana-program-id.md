# L-29 — `docs/integrations/solana-spoke-article.md` Solana program ID staleness

- Finding: L-29 (Linear: 4626-377)
- Severity: Low
- Disposition: **Fixed** — article now cites `Anchor.toml` as the canonical source and notes the last-verified date. No address discrepancy was found at audit time.

## Problem

L-29 flagged that Solana program IDs in `docs/integrations/solana-spoke-article.md` might be stale, citing a potential divergence with `solana-bridge-naming-invariant.md`.

## Verification

Only one program ID appears in the article: `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` (line 104, `creator_share_hook`). Cross-checked against every other location in the tree:

- `Anchor.toml` (localnet / devnet / mainnet entries) — **matches**.
- `kpr/config.ts` line 26 — **matches**.
- `kpr/tests/keepr-solana-winner-relay.test.ts` line 89 — **matches**.
- `AGENTS.md` operations runbook — **matches**.
- `docs/_internal/audits/internal-monorepo-audit-2026-03-30.md` — **matches**.

The finding's cited counter-reference, `docs/operations/solana-bridge-naming-invariant.md`, **does exist** in the tree (confirmed via `git ls-files | grep -i naming-invariant` at commit HEAD). An earlier revision of this doc incorrectly asserted the file was absent and closed the finding on that basis — that claim was wrong (see Correction notice below). The actual file is a 340-line history of the `SolanaBridgeAdapter` migration that records addresses current at each deploy generation. It points at [`docs/reference/addresses.md`](../../../reference/addresses.md) as the canonical address source and does not contain a `creator_share_hook` program-ID value that conflicts with `Anchor.toml`. No live program-ID discrepancy between the two docs; the article-level remediation (pinning `Anchor.toml` as canonical) remains correct.

## Correction notice (2026-04-23, Codex-follow-up cross-check)

A prior revision of this acceptance doc asserted `git ls-files | grep -i naming-invariant` returned nothing. That was factually wrong: the command returns `docs/operations/solana-bridge-naming-invariant.md`. The underlying conclusion — that `Anchor.toml` is the canonical program-ID source and no live discrepancy exists — still holds after re-verification against the real file contents, but the stated evidence was false. Fixed in this revision.

## Fix

The article now includes a note immediately after the program ID:

> **Canonical program-ID source:** [`Anchor.toml`](https://github.com/wenakita/4626/blob/main/Anchor.toml) is authoritative for the `creator_share_hook` program ID on every cluster. The value above is verified to match `Anchor.toml` and `kpr/config.ts` as of 2026-04-22. If the two ever diverge, `Anchor.toml` wins.

This satisfies the remediation ask ("Last verified" timestamp + link to authoritative registry) and establishes the drift-detection contract for future updates.

## Follow-ups

- When the Solana program is redeployed to a new program ID (unlikely — design is upgrade-in-place), update `Anchor.toml` first, then `kpr/config.ts`, then propagate to docs.
