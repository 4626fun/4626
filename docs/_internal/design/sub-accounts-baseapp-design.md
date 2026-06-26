# Sub Accounts on the Waitlist — Base App user flow

Status: **fully implemented (Tracks C1 + C2); ships dark behind `WAITLIST_SUBACCOUNT_FLOW_ENABLED`** · Author: computer · Date: 2026-05-05 · Updated: 2026-05-06
Related: [ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md), [arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md), [owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) §5.3 records this flow as wired into the waitlist signup. Read ACCOUNT_MODEL.md before changing anything in this design.

> **Server half (Track C1)** landed in `feat/waitlist-baseapp-subaccount-server` —
> migration 039 (`provisioning_source` column on
> `command_issuer_execution_context`) and `POST
> /api/arch-b/sub-account/baseapp/register`. Server gate:
> `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` (default off).
>
> **Frontend half (Track C2)** lands in `feat/waitlist-baseapp-subaccount-frontend` —
> waitlist `connect-base-app` step, `WaitlistConnectBaseApp`
> component, additive Privy/Base App connection. Frontend gate:
> `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` (default off). Both flags
> must be set for the user-visible flow.

## TL;DR

When a user lands on `/waitlist` and connects their Base App, we provision a per-app **sub-account** on their parent Coinbase Smart Wallet, with the user's Privy embedded EOA as the sub-account's signer. After provisioning, all 4626.fun-side transactions go through the sub-account and are signed by the embedded EOA — no further passkey prompts. The parent CSW remains untouched (no `addOwnerAddress`).

## Why this is the right primitive

Confirmed in [`owner-mutation-decision-2026-05.md`](./owner-mutation-decision-2026-05.md): Base App's session-key middleware refuses to construct UserOps for owner-mutating selectors from third-party dapps. Sub Accounts are the [official Coinbase pattern](https://blog.base.dev/subaccounts) for app-scoped accounts owned by the parent CSW. They give us:

- App-scoped execution surface (only 4626.fun can call into it)
- Frictionless signing (Privy embedded EOA, no passkey prompts after creation)
- Fund flow from parent via Spend Permissions (added in a later PR; v1 ships without)
- No writes to the parent CSW; auditable boundary

## What already exists in the repo

| Piece | Location |
|---|---|
| `setupSubAccount()` orchestrator (get-or-create + configure signer) | `frontend/src/lib/wallet/subAccountSetup.ts` |
| `useSubAccountSetup` React hook | `frontend/src/hooks/useSubAccountSetup.ts` |
| Tests | `frontend/src/lib/wallet/subAccountSetup.test.ts` |
| DB columns for sub-accounts | `frontend/db/migrations/028_arch_b_sub_accounts.sql` |
| April spend-permission server flow | `frontend/api/_handlers/arch-b/_subAccountProvisionPrepare.ts`, `_subAccountProvisionCommit.ts` |

The April server flow is **for a different use case** (server-side, agent commands, requires a parent EOA owner key). We won't use it for the waitlist. We need a new, simpler server endpoint that just persists the (parent, sub-account, embedded-EOA) triple after the browser SDK does the on-chain work.

## What's missing for v1

1. **Privy login config** on `/waitlist`: enable `wallet` login method alongside `email`, with `walletConnectorVariant: 'base'` (or whatever the SDK calls Base App). Currently waitlist is `loginMethods: ['email']`.
2. **Waitlist step machine**: extend `WaitlistStep` to include a `connect-base-app` step (optional; users can skip and continue email-only).
3. **Setup component** that calls `useSubAccountSetup()`, renders the stage events, handles errors, and on success POSTs the result to a new server endpoint.
4. **Server endpoint** `POST /api/arch-b/sub-account/baseapp/register` — auth-gated by Privy session, validates the sub-account exists on chain (sanity), writes the row.
5. **DB write semantics** — see schema section below.

## User flow

```
Waitlist page
 │
 ├─ Step 1: auth (existing)
 │    User enters email, Privy creates embedded EOA. Profile row is created.
 │
 ├─ Step 2 (NEW, optional): connect-base-app
 │    "Already have a Base App wallet? Connect it to unlock <X>."
 │    [Skip] or [Connect Base App]
 │
 │    On Connect:
 │      a. Privy opens Base App connector (passkey prompt).
 │      b. useSubAccountSetup.setupSubAccount() runs:
 │         - wallet_getSubAccounts({ account: parentCSW, domain: 4626.fun })
 │         - if none: wallet_addSubAccount({ keys: [embeddedEOA] }) → passkey popup
 │         - configureSubAccountSigner(...) — silent, no popup
 │      c. POST /api/arch-b/sub-account/baseapp/register
 │         { parentAddress, subAccountAddress, embeddedEoaAddress }
 │      d. Server verifies + writes DB row
 │
 └─ Step 3: done (existing)
      "You're on the list."
```

The "connect-base-app" step is **opt-in**. Users without Base App skip and stay email-only — they get a fully functional embedded EOA but no parent-CSW relationship.

## Schema

Migration 028 (`frontend/db/migrations/028_arch_b_sub_accounts.sql`) already added these columns to `command_issuer_execution_context`. Storage shapes copied verbatim from the migration so this doc doesn't drift:

- `sub_account_address` `TEXT` — 0x-hex execution address
- `parent_csw_address` `TEXT` — 0x-hex funding CSW
- `spend_permission_payload` `JSONB` — EIP-712 SpendPermission struct
- `spend_permission_signature` `TEXT` — 0x-hex signature from a parent-CSW owner EOA (NOT bytea)
- `spend_permission_hash` `TEXT` — 0x-hex EIP-712 hash for dedupe / lookup (NOT bytea)
- `spend_allowance_wei` `NUMERIC(78, 0)` — wei budget per period
- `spend_period_seconds` `INTEGER`
- `spend_permission_end_at` `TIMESTAMPTZ`
- `spend_permission_revoked_at` `TIMESTAMPTZ`

For the waitlist Base App flow we **only fill the first three identity columns**:
- `parent_csw_address` = the Base App CSW
- `sub_account_address` = the per-app sub-account
- `spend_permission_*` columns stay NULL until a future PR adds Spend Permission UX

To make this difference explicit, add a new column in a small follow-up migration:
```sql
ALTER TABLE command_issuer_execution_context
  ADD COLUMN provisioning_source TEXT
    CHECK (provisioning_source IN ('arch_b_admin','baseapp_waitlist'));
```
Existing rows: NULL or `'arch_b_admin'` (backfill if desired). New waitlist rows: `'baseapp_waitlist'`.

The submitter logic in `userOperationSubmitter.ts` already handles `sub_account_address NOT NULL` — for `baseapp_waitlist` rows, the spend-permission path is bypassed and the sub-account simply executes with its own balance (or future spend-permission). No submitter changes for v1.

## Server endpoint: register

`POST /api/arch-b/sub-account/baseapp/register`

**Auth:** Privy session (the user must be logged in). No SIWE — the user's authority comes from Base App's confirmation in the browser SDK call.

**Body** (max 4 KB):
```json
{
  "parentAddress":     "0x...",
  "subAccountAddress": "0x...",
  "embeddedEoaAddress":"0x..."
}
```

**Validations** (in order, all hard-fail with typed codes):

1. `parentAddress`, `subAccountAddress`, `embeddedEoaAddress` are valid 20-byte addresses.
2. `embeddedEoaAddress` matches the Privy embedded wallet address recorded for this profile (defense-in-depth; client could lie).
3. Sanity: read `subAccountAddress.code` from Base RPC. If `0x` (counterfactual, not yet deployed) that's fine — sub-accounts are deployed lazily via initCode on first UserOp. If non-`0x`, optionally read `ownerAtIndex(0)` to verify the parent matches; non-fatal.
4. No existing row in `command_issuer_execution_context` for this profile with a different `parent_csw_address` (a profile binds to one parent CSW; reject conflicts).

**Effects:**
- Upsert one row in `command_issuer_execution_context` keyed by `profile_id`, with:
  - `smart_wallet_address = subAccountAddress`
  - `parent_csw_address = parentAddress`
  - `sub_account_address = subAccountAddress`
  - `owner_eoa_address = embeddedEoaAddress`
  - `owner_index = 0` (the sub-account has only the embedded EOA as a signer key in the v1 shape; if Base App injects the parent as owner[0] automatically, this becomes `1` — verify against the SDK response)
  - `provisioning_source = 'baseapp_waitlist'`
- **Canonical wallet stays the parent CSW**, consistent with [`arch-b-sub-account-design-addendum.md`](./arch-b-sub-account-design-addendum.md) ("Canonical CSW remains the parent. Sub-account is a child record.") and [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) ("the parent CSW remains the canonical asset-holding account"). The waitlist flow should:
  - Insert/upsert the parent CSW into `profile_wallets` with `is_canonical_smart_wallet = true`.
  - Keep the embedded EOA recorded in `profile_wallets.privy_embedded_eoa_address` (it is the *signer*, not the canonical asset-holding account).
  - The sub-account address lives only on `command_issuer_execution_context` as the execution lane — not promoted to canonical.
  - Existing sub-account-aware code (`resolveCommandIssuerContextByAddress`, `userOperationSubmitter`, etc.) already assumes parent-as-canonical and sub-account-as-execution; this preserves that contract.

**Response:**
```json
{
  "success": true,
  "data": {
    "profileId": "...",
    "parentAddress": "0x...",
    "subAccountAddress": "0x...",
    "ownerIndex": 0,
    "provisioningSource": "baseapp_waitlist"
  }
}
```

**Error codes:**
- 400 `invalid_body` | `invalid_address` | `embedded_eoa_mismatch`
- 401 `unauthenticated`
- 409 `parent_csw_conflict` (profile already bound to a different parent)
- 503 `db_unavailable` | `rpc_unavailable`

## Component surface

New file: `frontend/src/features/waitlist/WaitlistConnectBaseApp.tsx`

Props (rough shape):
```ts
type Props = {
  onSkip: () => void
  onComplete: (result: { parentAddress: Address; subAccountAddress: Address }) => void
}
```

Renders three states using the existing `setupStage` + `error` from `useSubAccountSetup`:
- **idle** — explanation copy + `[Skip]` and `[Connect Base App]` buttons.
- **provisioning** — stage badge (`check_existing` → `create_sub_account` → `configure_signer`), with the existing `SubAccountSetup` component if there is one (look for it; otherwise inline minimal UI).
- **complete** — sub-account address + tx receipt link, then auto-advance via `onComplete()`.
- **error** — show the error from the hook, `[Try again]` and `[Skip]` buttons.

Wired into `WaitlistFlow.tsx`:
- New step `'connect-base-app'` in `WaitlistStep` union.
- New transition: from `'auth'`, when the profile is created and there's an embedded EOA, route to `'connect-base-app'` instead of `'done'`.
- From `'connect-base-app'`: `onSkip → 'done'`, `onComplete → POST register → 'done'`.

## Privy login config change

`frontend/src/lib/privy/client.tsx`:

```ts
// Currently:
const loginMethods = mode === 'waitlist-email-only' ? (['email'] as const) : (['email', 'wallet'] as const)

// Proposed: keep the mode but allow opt-in wallet connect via a separate API,
// not by changing waitlist's primary auth method.
```

The simplest move is to **keep email as the primary login** (email-only at the auth step) and use Privy's `useConnectWallet` or the Base Account SDK directly *after* email signup, when the user reaches the new `'connect-base-app'` step. That way the auth step stays clean and Base App is treated as an additive identity, not a competing one. Need to confirm Privy supports this composition — believed yes.

## Out of scope for v1

- **Spend Permissions.** v1 sub-accounts execute against their own balance (zero, until the user funds them). Funding UX is the next PR. The server's `command_issuer_execution_context` row simply has NULL spend-permission columns.
- **Sub-account deletion / revoke.** Add later.
- **Migrating existing profile_wallets rows.** v1 only handles new waitlist signups.
- **Mobile-only Base App flows.** v1 is browser-only. Base App's mobile native app launches the dapp in an in-app browser; same SDK calls work there.
- **The April flow's spend-permission provisioning.** Stays separate; it's for a different population (agent commands).

## Test plan

1. `subAccountSetup.test.ts` (already passing) covers the SDK orchestrator.
2. New `WaitlistConnectBaseApp.test.tsx` for the component rendering.
3. New `register.test.ts` for the server endpoint with `getDb` mocked.
4. Manual E2E on a Base App test passkey:
   - Email signup creates embedded EOA.
   - Click "Connect Base App", get passkey popup, approve.
   - Sub-account created on chain (verify on Basescan if deployed; otherwise verify counterfactual address matches).
   - DB row written with all three addresses.
   - Refresh page; reconnect; sub-account is reused (not recreated).

## Rollout

- Land migration adding `provisioning_source` column.
- Land server endpoint behind `BASEAPP_WAITLIST_SUBACCOUNT_ENABLED` flag (default off).
- Land component + flow change behind same flag.
- Deploy preview, manual E2E.
- Flip flag in preview, run a few real signups.
- Promote to production behind same flag, then enable.

## Open questions for the next session

1. ~~Does the canonical `profile_wallets.is_canonical_smart_wallet` get flipped…~~ **Resolved by codex review on PR #526:** parent CSW is canonical; sub-account is execution lane. Matches existing repo invariants in `arch-b-sub-account-design-addendum.md` and `frontend/docs/account-auth-invariants.md`. Updated above.
2. What's the correct `owner_index` for the embedded EOA on a freshly created sub-account from `wallet_addSubAccount`? The SDK should return it in the create response; we should record what it actually returns, not guess.
3. UX: do we offer "Connect Base App" only on first signup, or also as a "link an existing wallet" action on the account page later? (Likely both, but v1 is signup-only.)
