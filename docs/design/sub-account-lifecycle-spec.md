# Sub-account lifecycle spec — user-facing surface

**Status:** proposed · **Author:** computer · **Date:** 2026-04-19
**Predecessor:** [arch-b-sub-account-design-addendum.md](../arch-b-sub-account-design-addendum.md) (backend design)
**Successor:** [identity-surface-spec.md](./identity-surface-spec.md) (identity card design this builds on)

## Problem

The sub-account model is fully designed and partly implemented in the
backend, but users have no surface to see or manage it. Today:

- The sub-account address is invisible. When a user runs `/coin buy` in
  chat, they have no idea which address actually spent their ETH.
- The SpendPermission caps (0.5 ETH/day, 0.1 ETH/tx) are invisible.
  Users can't check "how much have I spent today" or "how much headroom
  do I have left."
- Revoking consent requires an admin. The only path to stop bot-initiated
  spending is flipping `spend_permission_revoked_at` in Postgres by hand.
- Provisioning requires the operator CLI (`frontend/provision-sub-account.mjs`)
  or the admin endpoint. New creators can't self-serve.

The net effect: the sub-account is a power-user affordance for us, not
a product surface for our users.

## What already exists

Found during this spec's scoping pass:

| Piece | Path | Status |
|---|---|---|
| EIP-712 prepare endpoint | `api/_handlers/arch-b/_subAccountProvisionPrepare.ts` | SIWE-gated, live |
| EIP-712 commit endpoint | `api/_handlers/arch-b/_subAccountProvisionCommit.ts` | SIWE-gated, live |
| Admin-bypass provision | `api/_handlers/admin/arch-b/_subAccountProvision.ts` | live |
| DB columns | `command_issuer_execution_context` has `sub_account_address`, `parent_csw_address`, `spend_permission_payload`, `spend_permission_signature`, `spend_permission_end_at`, `spend_permission_revoked_at`, etc. | live |
| Feature flag | `ARCH_B_SUB_ACCOUNTS_ENABLED` | live (off in prod by default) |
| Base Account SDK sub-accounts | `frontend/src/lib/wallet/subAccountSetup.ts`, `useSubAccountSetup()` | live (different mechanism — app-domain-scoped) |
| `SpendPermissionManager` on Base | `0xf85210B21cC50302F477BA56686d2019dC9b67Ad` | live |

## What's missing (4 concrete gaps)

1. **Status endpoint doesn't return sub-account fields.** `GET /api/arch-b/status`
   today returns `{ profileId, delegated, executionReady, caps, revokedAt, quorumId }`.
   It does *not* return `subAccountAddress`, `parentCswAddress`,
   `spendPermissionEndAt`, `currentPeriodSpendWei`, or `spendPermissionRevokedAt`.
2. **No user-facing spend-permission revoke endpoint.** `/api/arch-b/revoke`
   revokes the Privy *delegation* (quorum), not the *spend permission*.
3. **No `ExecutionScopeCard` UI component.** The two existing Arch B
   components (`ArchBEnrollmentCard`, `ArchBRevokeControl`) treat the
   delegation — not the sub-account — as the user-visible concept.
4. **No auto-provisioning hook.** `provision-sub-account.mjs` is an
   operator CLI. Auto-provisioning on sign-in doesn't exist.

## Decisions (from design review, 2026-04-19)

1. **Revoke semantics:** DB-first, on-chain optional.
   - v1 (PR 2, shipped): DB-only revoke via
     `POST /api/arch-b/sub-account/revoke`. The submitter preflight
     already refuses UserOps whose issuer has `spend_permission_revoked_at`
     set, so the DB flip fully stops in-chat spending. Instant, free,
     reversible via re-provision.
   - v1.1 (follow-up): "Also revoke on-chain" secondary button. Because
     `SpendPermissionManager.revoke(permission)` is access-controlled to
     `msg.sender == permission.account || msg.sender == permission.spender`,
     a plain relayer EOA cannot revoke directly; we'd need to submit a
     UserOp from the sub-account (reusing the existing Arch B submitter
     path). Deferred to keep PR 2 scoped. Users who want stronger-than-DB
     revoke today can use the broader `/api/arch-b/revoke` endpoint,
     which also kills the Privy quorum delegation.
2. **Auto-provisioning trigger:** once per sign-in session, silently via
   Privy's headless `signTypedData`. Preconditions: authed CSW, embedded
   EOA is an owner of that CSW, and no existing sub-account row.
3. **Signer rotation:** deferred to v1.1 follow-up. v1 exposes only
   revoke + re-provision.

## Shape of the user-facing card

```
EXECUTION SCOPES
┌────────────────────────────────────────────────────────────────┐
│ 4626.fun in-chat commands                                      │
│ Sub-account  0xabc…123          [Copy]                         │
│ Funded by    your CSW via signed SpendPermission (1 day cap)   │
│                                                                │
│ Cap          0.1 ETH / tx · 0.5 ETH / 24h                      │
│ This window  0.18 ETH used · 0.32 ETH remaining                │
│ Permission   Active · expires Dec 2125                         │
│                                                                │
│ [ Revoke ]   [ Also revoke on-chain ]                          │
└────────────────────────────────────────────────────────────────┘
```

Location: `/accounts` page, directly under `YourIdentityHero`. NOT in
the nav header (execution scopes are a technical concept; keeping them
off the header preserves the "who am I" focus established by the
identity card).

## Rollout — three PRs

### PR 1 — Read-only visibility (~3–4 hrs)

1. Extend `GET /api/arch-b/status` response:
   ```ts
   {
     profileId, delegated, executionReady, caps, revokedAt, quorumId,
     subAccount: null | {
       address: `0x${string}`
       parentCsw: `0x${string}`
       spendPermission: {
         allowanceWei: string   // stringified bigint
         periodSeconds: number
         endAt: string          // ISO 8601
         revokedAt: string | null
         currentPeriodSpendWei: string   // read from chain at request time
         periodRemainingWei: string      // computed: allowance − currentPeriodSpend
       } | null
     }
   }
   ```
2. Add a `viemReadSpendPermissionCurrentPeriodSpend(...)` helper backed by
   `SpendPermissionManager.getCurrentPeriodSpend(permission)`.
3. New `useExecutionScope()` client hook over the extended endpoint.
4. New `ExecutionScopeCard` component in
   `frontend/src/features/executionScope/` handling states:
   - `loading` — skeleton
   - `not_provisioned` — empty state with note ("in-chat spending not enabled")
   - `active` — full card as drawn above, no write buttons yet
   - `revoked` — grayed card, "Re-provision" button (placeholder; lands in PR 2)
   - `expired` — grayed card, "Re-provision" button (placeholder)
5. Wire into `/accounts` above the `AdvancedDisclosure`.

No write actions in PR 1. Low risk, immediate user value ("I can see
what I'm consenting to").

### PR 2 — Revoke + re-provision (shipped)

1. New endpoint `POST /api/arch-b/sub-account/revoke`:
   - SIWE-gated, rate-limited.
   - Body: `{ reason?: string }` (256-char cap for audit).
   - Flips `spend_permission_revoked_at = NOW()` in DB via the new
     `revokeSubAccountSpendPermission` helper in `commandIssuerContext.ts`.
   - Idempotent: returns `{ alreadyRevoked: true }` on repeat calls.
   - On-chain revoke deferred (see Decisions § 1 above).
2. Revoke button wired into `ExecutionScopeCard`. Click-to-confirm UX:
   first click turns the button red and changes copy to "Confirm revoke";
   second click fires the request. Cancel is always one click away.
3. Re-provision flow uses `/prepare` → `walletClient.signTypedData` →
   `/commit`. New `useReprovisionSubAccount()` hook surfaces phase
   (`preparing` / `signing` / `committing` / `done` / `error`) so the
   button label tracks progress.
4. `ArchBRevokeControl` removed from `/accounts` (its role is absorbed
   by the new card). `ArchBEnrollmentCard` stays in the waitlist flow
   for now — it will be obsoleted when PR 3 (auto-provisioning) lands.

### PR 3 — Auto-provisioning on sign-in (~4–6 hrs)

1. New `useAutoProvisionSubAccount()` hook, called once per session from
   a top-level auth-aware layout.
2. Preconditions (all must hold):
   - SIWE session active
   - Canonical CSW resolved
   - Privy embedded EOA is `CoinbaseSmartWallet.isOwner(csw, eoa)` ✓
   - No existing `command_issuer_execution_context` row with `sub_account_address IS NOT NULL`
3. Flow: prepare → sign (via Privy `signTypedData`, silent) → commit.
4. On failure (non-owner, signature rejection, network error): fall back
   silently to the opt-in `ExecutionScopeCard` CTA. No toast noise.
5. Flip `ARCH_B_SUB_ACCOUNTS_ENABLED=1` in prod env.

## Out of scope for v1

- Multi-sub-account per profile (only one `sub_account_address` per
  `command_issuer_execution_context` row)
- ERC-20 / creator-coin spend permissions (native ETH only in v1)
- Signer rotation (swap Privy embedded EOA for a different key)
- Cross-chain sub-accounts (Base only; Solana has its own trust model)

## Dependencies

- Viem for on-chain `getCurrentPeriodSpend` read
- Privy's `signTypedData` for silent sub-account provisioning
- Existing `resolveCommandIssuerContextByProfileId` to read sub-account fields

## Risks

- **`getCurrentPeriodSpend` on status endpoint adds an RPC hop per request.**
  Mitigation: cache for 15 s inside the handler; fall back to `allowance` if
  the RPC fails. Non-fatal.
- **Silent auto-provisioning signatures could surprise users.** Mitigation:
  show a one-time explanation toast the first time a user's sub-account is
  provisioned. Copy: "4626 set up a 0.5 ETH/day spend scope on your smart
  wallet so in-chat trading works. Manage in /accounts."
- **Privy embedded EOA not being a CSW owner for Zora cross-app users.**
  Mitigation: explicit preflight check in the auto-provision hook; those
  users stay on the opt-in card path.

## Follow-ups after v1

- Per-token spend permissions (USDC, specific creator coins)
- Signer rotation UI
- Audit log section on the card ("last 10 spends from this sub-account")
- Operator-visible sub-account dashboard (list all active sub-accounts +
  aggregate spend; useful for capacity planning and fraud detection)
