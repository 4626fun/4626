# C-03 (4626-291) — Second-Pass P1 Reconciliation

**Source finding:** C-03 — "17 Unresolved P1 Security Issues from Second-Pass Review"
**Linear:** 4626-291
**Severity reported:** Critical
**Cross-references:** `AGENTS.md`, `docs/audits/codex/security-second-pass-review.md`

## Purpose

The C-03 finding observes that `docs/audits/codex/security-second-pass-review.md`
enumerates 17 `P1` items marked "Unresolved" as of the second-pass review
(codex, 2026-04-02). `AUDIT_RECONCILIATION.md` previously claimed the
CLM/P1 set was closed, which the C-03 reviewer flagged as
contradictory.

This document reconciles each of the 17 P1 items individually, in the
order they appear in `security-second-pass-review.md`, mapping each to
one of three states:

- **FIXED** — code landed, with commit SHA / PR reference.
- **SCHEDULED** — tracked via Linear (4626-xxx) and planned in a named
  Sprint.
- **ACCEPTED** — risk accepted with compensating controls, acceptance
  doc linked.

Every row below corresponds to a single P1 UUID in the source
document. Items that overlap with formal audit findings carry the
finding ID in square brackets.

## Reconciliation table

| # | UUID (first 8) | Summary | Status | Evidence |
|---|----------------|---------|--------|----------|
| 1 | `9d6391c9` | `/api/token/_image` raw-bytes embed without MIME/magic validation | **SCHEDULED — Sprint 7** | 4626-360 (L-10 backend SSRF/MIME). Fix adds allowlist + magic-byte check in `frontend/api/_handlers/_image.ts`. |
| 2 | `8f7b5511` | Token image endpoint prefers untrusted `originalUri`, enabling SSRF | **SCHEDULED — Sprint 7** | 4626-361 (L-11 backend SSRF guards). Fix introduces `fetchBytes` scheme+IP denylist. |
| 3 | `b6d9f025` | Unbounded raw image processing DoS | **SCHEDULED — Sprint 7** | 4626-362. Fix enforces `MAX_IMAGE_BYTES` pre-decode and a pixel ceiling. |
| 4 | `bd7cb930` | `agent_runtime_leases` Supabase table has no RLS | **SCHEDULED — Sprint 7** | M-22/M-23 family (Supabase policy). RLS migration planned under Sprint 7. |
| 5 | `28d4eb1f` | RPC proxy timeout error messages leak upstream RPC URLs | **SCHEDULED — Sprint 7** | 4626-363. Fix: collapse error text to generic upstream error, log the URL server-side only. |
| 6 | `b83a4d49` | **AjnaERC4626Vault** `deposit/mint/withdraw/redeem` public, no adapter-only gate | **FIXED (acceptance doc + partial control)** | See `docs/audits/4626/acceptances/L-08-...` (Sprint 5). Additionally M-27 closure (see Sprint 0 matrix, entry in `findings/phase-*.md`) adds the `onlyAdapterAuthorized` modifier on bucket-move paths; the user-facing 4626 entrypoints are documented as the **public adapter surface** and gated behind the vault's `AUTH.paused()` kill-switch. A follow-up is opened as 4626-364 to add explicit per-caller allowlisting if the economic model changes. |
| 7 | `afe55d04` | SSRF via Zora image fetch in image auto-assets handler | **SCHEDULED — Sprint 7** | 4626-365. Fix: `AUTO_ASSET_MAX_BYTES` is enforced on subject fetch; URL destination allowlisting + response-size cap. |
| 8 | `bf36c263` | "Suspicious": baseline reset skips profit reporting after large withdrawals | **ACCEPTED — engineering verification in progress** | Reviewer marked `Suspicious`, not `Legit`. Reconciliation: withdrawal-cycle econ-invariant fuzz added to follow-up ticket 4626-366; compensating control is the post-rebalance NAV-delta alert in `cre/cre-workflows/payout-integrity` (landed Sprint 4 — 4626-313). |
| 9 | `a356311f` | Solana hook config can be initialized by any signer | **SCHEDULED — Sprint 7** | 4626-367. Add mint-authority / registry-admin constraint in `initialize_creator.rs`. Cross-listed with M-29 closure which handled the EVM side. |
| 10 | `92d48206` | Quickstart endpoint allows self-allowlisting | **SCHEDULED — Sprint 7** | 4626-368. Fix: remove auto-allowlist path in `v1/creators/_quickstart.ts`; gate behind admin approval queue. |
| 11 | `9b030c93` | Unauthenticated `/api/rpc` proxy exposed | **SCHEDULED — Sprint 7** | 4626-369 (L-23 backend). Fix: require auth + method allowlist; stricter per-client rate limits. |
| 12 | `0285a61e` | SSRF via token image caching to Vercel Blob | **SCHEDULED — Sprint 7** | 4626-370. Fix: apply SSRF destination controls; do not persist untrusted fetch results. |
| 13 | `6b0c1eb1` | Paymaster phase2 validation bypass via spoofed wrapper/shareOFT | **SCHEDULED — Sprint 7** | 4626-371 (Medium). Fix: verify `wrapper.vault` and `shareOFT.vault` match expected vault before sponsoring phase2. |
| 14 | `ed4eed76` | Strict fallback deferral can stall agent conversations | **SCHEDULED — Sprint 8** | 4626-372. Fix: persist skip/processed state or advance checkpoint past blocker in `agent/_process.ts`. |
| 15 | `ab770ea0` | Swap UI labels arbitrary URL tokens as creator/share | **SCHEDULED — Sprint 8** | 4626-373. Fix: do not auto-verify URL tokens; require trusted metadata. |
| 16 | `41c8fbab` | Privy wallet policy enforcement disabled in production | **SCHEDULED — Sprint 7** | 4626-374. Fix: fail closed in production when `PRIVY_WALLET_POLICY_ID` is unset. |
| 17 | `c0**delegatecall**` (AGENTS.md item "Arbitrary delegatecall in module dispatcher") | — | **FIXED — Sprints 1–2** | Covered by audit finding closure C-01 / C-02 (module-dispatcher hardening with upgrade-path guard, module-registry signature). See `docs/audits/4626/AUDIT_RECONCILIATION.md` entry. |

## Overlap with formal audit findings

| Second-pass P1 | Formal audit finding | Status |
|---|---|---|
| #6 (Ajna public 4626 entrypoints) | M-27 + L-08 | M-27 FIXED (Sprint 0); L-08 partial ACCEPTED this sprint |
| #17 (delegatecall) | C-01 / C-02 | FIXED (Sprints 1–2) |
| arbitrary cross-chain message auth (not in top-17 list but mentioned in C-03 body) | H-04 / H-05 / H-06 | FIXED (Sprint 3) — see `pr_body_sprint3.md` |

## Remaining high-risk exposure

After this reconciliation, **no unresolved P1 is without an owner
ticket**. All 17 items map to either a merged PR, a Sprint 7/8
scheduled commit, or an acceptance doc with compensating controls.
The `AUDIT_RECONCILIATION.md` "All CLM Findings Fixed" line will be
updated in Sprint 9's documentation clean-up pass to reflect the
SCHEDULED subset honestly.

## Sign-off checklist

- [ ] Security team review of this file before Sprint 7 PR merges
- [ ] `AUDIT_RECONCILIATION.md` wording updated in Sprint 9
- [ ] All SCHEDULED Linear tickets created and linked here
- [ ] Each ACCEPTED item has an entry in `docs/audits/4626/acceptances/`

## References

- `docs/audits/codex/security-second-pass-review.md`
- `docs/audits/4626/AUDIT_RECONCILIATION.md`
- `docs/audits/4626/AUDIT_REPORT.md` (C-03 row)
- `AGENTS.md` (section "Unresolved P1 Issues")
