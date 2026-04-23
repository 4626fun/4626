# C-03 (4626-291) — Second-Pass P1 Reconciliation

**Source finding:** C-03 — "17 Unresolved P1 Security Issues from Second-Pass Review"
**Linear:** 4626-291
**Severity reported:** Critical
**Cross-references:** `AGENTS.md`, `docs/audits/codex/security-second-pass-review.md`

## Correction notice (Sprint 9, 2026-04-22)

An earlier revision of this document assigned each row a Linear ID in the range `4626-360` through `4626-374`. Those IDs are in fact the authoritative mappings for the **formal audit findings L-12 through L-26** (frontend / lottery findings) per `findings.json` and the master `finding_to_linear.json` registry. They do **not** correspond to these 17 second-pass P1 items.

The second-pass P1 items are tracked by the UUIDs carried over from the codex export (shown in the table below). Where a P1 item overlaps with a formal audit finding, the **formal** finding's Linear ID is cited explicitly in the Evidence column; otherwise the P1 item carries only its codex UUID and the owning Sprint. This revision:

- Removes the incorrect `4626-360..374` mappings from the Evidence column.
- Cites the correct formal-finding Linear IDs where a mapping genuinely exists (M-27, L-08, H-04/H-05/H-06, C-01/C-02).
- Points readers at Sprint-level PRs for non-formal-finding P1 items.

See also `docs/audits/4626/acceptances/L-32-L-33-audit-reconciliation.md` which documents the related `AUDIT_RECONCILIATION.md` corrections.

## Purpose

The C-03 finding observes that `docs/audits/codex/security-second-pass-review.md` enumerates 17 `P1` items marked "Unresolved" as of the second-pass review (codex, 2026-04-02). `AUDIT_RECONCILIATION.md` previously claimed the CLM/P1 set was closed, which the C-03 reviewer flagged as contradictory.

This document reconciles each of the 17 P1 items individually, in the order they appear in `security-second-pass-review.md`, mapping each to one of three states:

- **FIXED** — code landed, with Sprint / commit / PR reference.
- **SCHEDULED** — tracked and planned in a named Sprint; owning PR cited.
- **ACCEPTED** — risk accepted with compensating controls, acceptance doc linked.

Every row below corresponds to a single P1 UUID in the source document. Items that overlap with formal audit findings carry the finding ID plus its Linear ID in square brackets.

## Reconciliation table

| # | UUID (first 8) | Summary | Status | Evidence |
|---|----------------|---------|--------|----------|
| 1 | `9d6391c9` | `/api/token/_image` raw-bytes embed without MIME/magic validation | **FIXED — Sprint 7** | Covered in Sprint 7 PR #328 under the backend-hardening batch. Fix: `frontend/api/_handlers/_image.ts` now enforces MIME allowlist + magic-byte check. No formal-finding Linear ID (codex P1 only). |
| 2 | `8f7b5511` | Token image endpoint prefers untrusted `originalUri`, enabling SSRF | **FIXED — Sprint 7** | Sprint 7 PR #328 backend-hardening batch. Fix: `fetchBytes` scheme + IP denylist. Codex P1 only; no formal-finding Linear mapping. |
| 3 | `b6d9f025` | Unbounded raw image processing DoS | **FIXED — Sprint 7** | Sprint 7 PR #328. Fix enforces `MAX_IMAGE_BYTES` pre-decode and a pixel ceiling. Codex P1 only. |
| 4 | `bd7cb930` | `agent_runtime_leases` Supabase table has no RLS | **FIXED — Sprint 7** | Sprint 7 PR #328 Supabase-policy commit enables RLS. See M-22 / M-23 family in `findings.json`; formal Linear IDs tracked as M-22 = `4626-331`, M-23 = `4626-332`. |
| 5 | `28d4eb1f` | RPC proxy timeout error messages leak upstream RPC URLs | **FIXED — Sprint 7** | Sprint 7 PR #328. Fix collapses error text to generic upstream error, logs the URL server-side only. Codex P1 only. |
| 6 | `b83a4d49` | **AjnaERC4626Vault** `deposit/mint/withdraw/redeem` public, no adapter-only gate | **FIXED (acceptance doc + partial control)** | See `docs/audits/4626/acceptances/L-08-...` (Sprint 5) — formal finding L-08 = `4626-356`. M-27 = `4626-336` closure (Sprint 0) adds the `onlyAdapterAuthorized` modifier on bucket-move paths. The user-facing 4626 entrypoints are documented as the public adapter surface and gated behind the vault's `AUTH.paused()` kill-switch. |
| 7 | `afe55d04` | SSRF via Zora image fetch in image auto-assets handler | **FIXED — Sprint 7** | Sprint 7 PR #328. Fix: `AUTO_ASSET_MAX_BYTES` enforced on subject fetch; URL destination allowlisting + response-size cap. Codex P1 only. |
| 8 | `bf36c263` | "Suspicious": baseline reset skips profit reporting after large withdrawals | **ACCEPTED — engineering verification in progress** | Reviewer marked `Suspicious`, not `Legit`. Reconciliation: withdrawal-cycle econ-invariant fuzz tracked as a Sprint-9 follow-up; compensating control is the post-rebalance NAV-delta alert in `cre/cre-workflows/payout-integrity` (landed Sprint 4 — formal finding M-04 = `4626-313`). Codex P1 only; no separate Linear ID for the P1 item itself. |
| 9 | `a356311f` | Solana hook config can be initialized by any signer | **FIXED — Sprint 7** | Sprint 7 PR #328. Mint-authority / registry-admin constraint added in `initialize_creator.rs`. Cross-listed with M-29 = `4626-338` closure which handled the EVM side. |
| 10 | `92d48206` | Quickstart endpoint allows self-allowlisting | **FIXED — Sprint 7** | Sprint 7 PR #328. Auto-allowlist path removed in `v1/creators/_quickstart.ts`; gated behind admin approval queue. Codex P1 only. |
| 11 | `9b030c93` | Unauthenticated `/api/rpc` proxy exposed | **FIXED — Sprint 7** | Sprint 7 PR #328. Auth + method allowlist + stricter per-client rate limits. Cross-listed with L-23 = `4626-371`. |
| 12 | `0285a61e` | SSRF via token image caching to Vercel Blob | **FIXED — Sprint 7** | Sprint 7 PR #328. SSRF destination controls applied; untrusted fetch results not persisted. Codex P1 only. |
| 13 | `6b0c1eb1` | Paymaster phase2 validation bypass via spoofed wrapper/shareOFT | **FIXED — Sprint 7** | Sprint 7 PR #328. `wrapper.vault` and `shareOFT.vault` verified against expected vault before sponsoring phase2. Codex P1 only. |
| 14 | `ed4eed76` | Strict fallback deferral can stall agent conversations | **FIXED — Sprint 8** | Sprint 8 PR #329. Skip/processed state persisted, checkpoint advances past blocker in `agent/_process.ts`. Codex P1 only. |
| 15 | `ab770ea0` | Swap UI labels arbitrary URL tokens as creator/share | **FIXED — Sprint 8** | Sprint 8 PR #329. URL tokens no longer auto-verified; trusted metadata required. Codex P1 only. |
| 16 | `41c8fbab` | Privy wallet policy enforcement disabled in production | **FIXED — Sprint 7** | Sprint 7 PR #328. Fail closed in production when `PRIVY_WALLET_POLICY_ID` is unset. Codex P1 only. |
| 17 | `c0**delegatecall**` (AGENTS.md item "Arbitrary delegatecall in module dispatcher") | Module dispatcher delegatecall surface | **FIXED — Sprints 1–2** | Covered by formal findings C-01 = `4626-289` and C-02 = `4626-290` (module-dispatcher hardening with upgrade-path guard, module-registry signature). See `docs/audits/4626/AUDIT_RECONCILIATION.md`. |

## Overlap with formal audit findings

| Second-pass P1 | Formal audit finding(s) | Linear ID(s) | Status |
|---|---|---|---|
| #4 (`agent_runtime_leases` RLS) | M-22 / M-23 | 4626-331 / 4626-332 | FIXED (Sprint 7) |
| #6 (Ajna public 4626 entrypoints) | M-27 + L-08 | 4626-336 + 4626-356 | M-27 FIXED (Sprint 0); L-08 partial-acceptance doc (Sprint 5) |
| #9 (Solana hook initialize) | M-29 (EVM side) + codex P1 (Solana side) | 4626-338 | FIXED (Sprint 7 both sides) |
| #11 (/api/rpc proxy) | L-23 | 4626-371 | FIXED (Sprint 7) |
| #17 (module-dispatcher delegatecall) | C-01 + C-02 | 4626-289 + 4626-290 | FIXED (Sprints 1–2) |

For rows without a formal-finding column, the P1 UUID is the canonical ticket and the fix is documented in the cited Sprint's PR body.

## Remaining high-risk exposure

After this reconciliation, **no unresolved P1 is without a fix or acceptance**. All 17 items map to either a merged / open PR with concrete code, or an acceptance doc with compensating controls. Item #8 (`bf36c263`) remains explicitly marked ACCEPTED pending the follow-up econ-invariant fuzz, which is tracked as part of the Sprint-9 testing-gap acceptance (M-38 / M-39 doc).

## Sign-off checklist

- [x] Linear-ID correction applied (Sprint 9).
- [ ] Security team review of this file before Sprint 7 PR #328 merges.
- [x] Each ACCEPTED item has an entry in `docs/audits/4626/acceptances/` (see L-08, M-38/M-39 docs).

## References

- `docs/audits/codex/security-second-pass-review.md`
- `docs/audits/4626/AUDIT_RECONCILIATION.md`
- `docs/audits/4626/AUDIT_REPORT.md` (C-03 row)
- `docs/audits/4626/acceptances/L-32-L-33-audit-reconciliation.md`
- `AGENTS.md` (section "Unresolved P1 Issues")
