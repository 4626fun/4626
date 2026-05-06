# 4626 Account Model — canonical reference

Status: **canonical** · Author: computer · Date: 2026-05-06

This document is the single source of truth for the 4626 account / wallet
model. Every other doc that describes who-signs-what or which address is
"canonical" must reconcile to this one. If a design doc conflicts with the
invariants in §3, the design doc is the one that's wrong.

---

## 1. Why this exists

We have repeatedly shipped designs that were obsolete on arrival because
they didn't account for what was already in the codebase. The most recent
example: [docs/zora-payout-recipient-design.md](./zora-payout-recipient-design.md)
specced building a new "set payout recipient at vault launch" flow when
that exact call is *already* part of the deploy phase-2 batch
(`DeployVault.tsx:4910-4919` + paymaster validation in
`_paymaster.ts:3285-3300`).

This doc is the gate that prevents that class of drift: read it before
writing a new account-model design, and update it when you ship code that
changes the model.

---

## 2. User populations

We treat four populations distinctly. Acceptance criteria, signing material,
and what works on `4626.fun` today:

| # | Population | Connected wallet | Canonical CSW | Signer | Sub-account? | Spend permission? | What works on 4626.fun today |
|---|---|---|---|---|---|---|---|
| (a) | **Privy email-only** — signed up via email on 4626.fun | Privy embedded EOA only | none (no parent CSW) | Privy embedded EOA | No | No | All EOA-friendly flows: vault deposits, swaps, gauge votes. No CSW-gated flows. |
| (b) | **Base App user** — signed in via Base App | Parent CSW (passkey at `owner[0]`) | The Base App CSW | Frontend: Privy embedded EOA via sub-account `setToOwnerAccount()` (planned). Server: Privy server wallet added to parent CSW (separate track). | Planned (orchestrator built, not yet on a product surface — see §5.3) | Planned (Track C / waitlist scope; v1 ships without) | **Today:** EOA-friendly flows only — same surface as population (a). The sub-account orchestrator (`setupSubAccount` + `useSubAccountSetup`) is built and tested but no product page consumes it yet; Track C wires it into the waitlist signup. Base App-gated owner mutations on the parent CSW are **not** available and will not be (see §4). |
| (c) | **Zora CSW user with EOA owner in our Supabase mapping** | The user-controlled EOA from `zora_csw_owners.current_owners` (often the Privy-embedded EOA from Zora's own onboarding) | The Zora-deployed CSW | EOA owner of the Zora CSW | Possible but not the default | No | March-9 owner-`executeBatch` lane works for owner-mutating calls on the Zora CSW (e.g. `addOwnerAddress`). Signed UserOps via the EOA owner work for `setPayoutRecipient` / `transferOwnership` on the creator coin (this is **what the deploy flow already does** — see §5). |
| (d) | **Zora CSW user with no EOA owner** | The Zora CSW (Coinbase-managed signers only — passkeys) | The Zora-deployed CSW | None we can use from a third-party dapp | No (Base App middleware blocks owner-mutation UserOps from third-party dapps for this population — same constraint as (b) for owner mutations) | No | Read paths only. Pre-flight simulation in the deploy flow detects this and surfaces a clear error before any signature prompt. The user must complete owner-gated actions from inside Zora / Base App's own UI. |

Sources for the population taxonomy:

- [docs/owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)
  established (a)–(d) and the "no add-owner from third-party dapp" decision.
- [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md)
  defines the (b) sub-account-on-waitlist v1 scope (currently *not yet
  implemented* — see §6).
- `zora_csw_owners` table is the durable source for (c) vs (d). Indexer:
  [docs/zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md).

---

## 3. Identity invariants (load-bearing)

These are the rules every other doc must respect. If you propose
something that conflicts, either drop the proposal or open a separate
PR to change the invariant before shipping.

The phrasing here is verbatim from the source docs so this page can't
drift independently:

- **Verified email is canonical 4626 identity and recovery key.**
  No account is fully created until email OTP verification completes.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Core rules".

- **There is only one 4626 account. Different entry points attach
  different identities to it.** The system must not create separate
  mental models like "Telegram account" / "website account" / "Base App
  account."
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Entry-point model".

- **Canonical CSW remains the parent. Sub-account is a child record.**
  Sources:
  [docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md) §"Invariants preserved",
  and reaffirmed in [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md) §"Schema".

- **The parent CSW remains the canonical asset-holding account
  (`profiles.csw_address`) — visible on Basescan / Zora / Coinbase app —
  but it is not the execution address** for user-initiated frontend
  writes on the sub-account track.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"User-initiated frontend execution (CSW path, executionMode === 'canonical')".

- **The sub-account is the execution lane only; not promoted to
  canonical.** The sub-account address lives on
  `command_issuer_execution_context` as the execution surface — never on
  `profile_wallets.is_canonical_smart_wallet`.
  Sources: [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md) §"Schema",
  [docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md) §"Migration / backwards compat".

- **The Privy embedded EOA is *not* installed as a direct owner on the
  parent CSW for the user-initiated frontend track.** It is the
  sub-account's signer via `setToOwnerAccount()`.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"User-initiated frontend execution (CSW path)".

- **For server-side automation only** (XMTP agent, ERC-8004 identity,
  deploy-session): a Privy *server* wallet (not the user's embedded
  EOA) is added to the parent CSW via `addOwnerAddress`. The parent CSW
  is the ERC-4337 sender on this track.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Server-side automation".

- **Daily spend ledger is profile-scoped, not sub-account-scoped.** A
  user's daily cap is a property of the issuer, independent of which
  sub-account executes.
  Source: [docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md) §"Invariants preserved".

- **Hard-fail (not silent fallback) when the issuer is not
  execution-ready.** Trust boundaries: bundler URL, Privy wallet id,
  spend permission payload all server-side; never from client payload.
  Source: [docs/architecture-b-design.md](./architecture-b-design.md) §3.

- **Server-side owner-install runtime fallback ladder is fixed:**
  1. sponsored UserOp with typed-data signing
  2. sponsored UserOp without typed-data signing
  3. `wallet_sendCalls` fallback
  Do not reorder without a deliberate runtime decision.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Server-side owner-install runtime policy".

- **A connected owner EOA and a canonical CSW-backed app session are
  allowed to differ during canonical execution flows;** wallet/session
  mismatch alone is not a reason to force a new session.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Session implementation notes".

- **`addOwnerAddress` from a third-party dapp is dead** for Base
  App-managed CSWs. Base App's session-key middleware refuses to
  construct UserOps for owner-mutating selectors. Use Sub Accounts +
  Spend Permissions for that population. Use `addOwnerAddress` only for
  Zora-CSW users where an EOA owner is already known (population (c)).
  Source: [docs/owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md).

---

## 4. Schema — `command_issuer_execution_context`

Verbatim column types and semantics from
[`frontend/db/migrations/028_arch_b_sub_accounts.sql`](../frontend/db/migrations/028_arch_b_sub_accounts.sql).
The migration file is the source of truth; if you find this table
documented elsewhere with different types, that other doc is wrong:

| Column | Type | Semantics |
|---|---|---|
| `sub_account_address` | `TEXT` | 0x-hex execution address. When NULL, `smart_wallet_address` IS the execution surface (legacy direct-CSW execution). When non-NULL, `smart_wallet_address` is kept in sync with `sub_account_address`. |
| `parent_csw_address` | `TEXT` | 0x-hex funding CSW whose balance backs spend. |
| `spend_permission_payload` | `JSONB` | EIP-712 SpendPermission struct (full struct stored for replay). |
| `spend_permission_signature` | `TEXT` | 0x-hex signature from a parent-CSW owner EOA over the EIP-712 hash. Accepted by `SpendPermissionManager.approveWithSignature`. **Stored as TEXT, not bytea.** |
| `spend_permission_hash` | `TEXT` | 0x-hex EIP-712 hash for dedupe / lookup. **Stored as TEXT, not bytea.** |
| `spend_allowance_wei` | `NUMERIC(78, 0)` | Wei budget per period; denormalized from payload. |
| `spend_period_seconds` | `INTEGER` | Period length in seconds; denormalized from payload. |
| `spend_permission_end_at` | `TIMESTAMPTZ` | End of permission validity. |
| `spend_permission_revoked_at` | `TIMESTAMPTZ` | Soft-revocation timestamp; set ⇒ refuse. |

> **Drift watch.** An older draft of the design
> ([docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md))
> shows `CITEXT` and `BYTEA` for some of these columns. The migration
> that actually shipped uses `TEXT` everywhere and `JSONB` for the
> payload. Trust the migration, not the historical design doc.

How to keep this in sync: when migration 028 is amended (or replaced by
a follow-up migration), update this section in the same PR. Don't ship
schema changes without touching this file.

---

## 5. Existing flows inventory (do not re-spec these)

Flows that already exist in code. If you're about to design something
that overlaps any of these, stop and read the cited code first.

### 5.1 Vault deploy: creator-coin payout-recipient + ownership transfer

**Location.** `frontend/src/pages/deploy/DeployVault.tsx:4910-4919` (call
data construction) and `:5707-5732` (where the calls are appended to the
phase-2 UserOp batch). Paymaster validation:
`frontend/api/_handlers/paymaster/_paymaster.ts:3285-3300`.

**What it does.** As part of the phase-2 deploy batch, the page builds
two extra calls when needed:

1. `creatorCoin.setPayoutRecipient(expectedPayoutRouter)` — only when
   the current payout recipient differs from the deterministic router.
2. `creatorCoin.transferOwnership(expectedCreatorCoinPolicyController)`
   — only when the current coin owner differs from the deterministic
   `CreatorCoinPolicyController` (CREATE2-derived from the deploy
   parameters).

**Pre-flight gate.** Before adding the calls, the page runs
`publicClient.call({ ..., account: owner })` simulations against both
selectors. If either simulation reverts (i.e., the connected signer
cannot authorize the call), the deploy throws a clear `Cannot set
CreatorCoin payout recipient ... from <owner>` error before any
signature prompt is shown. This is what catches population (d): they hit
the pre-flight error and are routed to copy that tells them to update
the recipient inside Zora's UI.

**Paymaster.** Both selectors are explicitly allowlisted in the
paymaster (`SELECTOR_COIN_SET_PAYOUT_RECIPIENT`,
`SELECTOR_OWNABLE_TRANSFER_OWNERSHIP`) for `mode === 'deploy_phase2' || 'deploy_phase3'`.
The paymaster validates the new recipient is the expected router and
the new owner is the expected `CreatorCoinPolicyController`. Any other
target is rejected.

**Post-deploy ownership.** After this batch, the creator coin is owned
by the deterministic `CreatorCoinPolicyController`
([`contracts/utilities/routers/CreatorCoinPolicyController.sol`](../contracts/utilities/routers/CreatorCoinPolicyController.sol))
which only permits two operations going forward:
`enforcePayoutRouter()` (resets the recipient back to the configured
router) and a two-step ownership handoff
(`proposeCreatorCoinOwnershipTransfer` → `acceptCreatorCoinOwnership`).

**Implication.** There is no separate "set payout recipient at vault
launch" flow to build. The flow exists, is paymaster-sponsored, and has
a working pre-flight gate. The only thing left is copy for population
(d) — see §6.

### 5.2 Owner-mutation on parent CSW from third-party dapp — BLOCKED

**Decision.** Drop "add owner to a Base App-managed CSW" as a product
flow. Use Sub Accounts + Spend Permissions for population (b). Source:
[docs/owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md).

**Diagnostic lanes still exist.** `/dev/csw-signature-probe` retains
multiple owner-mutation lanes for low-level signing experiments —
including a passkey-direct UserOp lane that bypasses Base App entirely
via `navigator.credentials.get()`. These are dev-scoped diagnostics.
**Do not surface to end users.**

### 5.3 Sub-account orchestrator — exists, not yet wired into product

**Location.** `frontend/src/lib/wallet/subAccountSetup.ts`
(`setupSubAccount()` orchestrator) and `frontend/src/hooks/useSubAccountSetup.ts`
(React hook). Tests at `frontend/src/lib/wallet/subAccountSetup.test.ts`.

**What it does.** Three stages, idempotent:
1. `wallet_getSubAccounts({ account: parentCSW, domain })`.
2. If none: `wallet_addSubAccount({ keys: [embeddedEOA] })` (one passkey
   popup).
3. `setToOwnerAccount(...)` — silent, no popup; routes future signing
   through the embedded EOA.

**Status.** Working code with tests, but not wired into any product
surface. The waitlist integration (Track C) is the planned consumer —
see [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md).

### 5.4 Arch B agent commands — server-side spend-permission flow

**Location.** Server: `frontend/server/_lib/wallet/userOperationSubmitter.ts`,
`frontend/server/_lib/wallet/commandIssuerContext.ts`.
Provisioning endpoints:
`frontend/api/_handlers/arch-b/_subAccountProvisionPrepare.ts`,
`_subAccountProvisionCommit.ts`. Design:
[docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md).

**Different population than the waitlist sub-account flow.** This
server flow requires a parent EOA owner key that the *user controls* and
that the *server* can use to sign EIP-712 SpendPermissions. It is in
production for the agent command paths (`/coin buy`, `/coin sell`,
`/keepr send`, `/coin trend reserve`). It is **not** the right
infrastructure for the waitlist Base App connection — that path needs
its own simpler endpoint per
[docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md).

### 5.5 Indexer: `zora_csw_owners` (the (c) vs (d) discriminator)

**Location.** Server-side cron handlers at
`frontend/api/_handlers/v1/zora-csw/_scanCron.ts` and `_enrichCron.ts`.
Spec: [docs/zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md).

**What it produces.** A queryable map from CSW address to current
owner EOAs, refreshed via cron. This is how we identify population (c)
(`current_owners` array contains at least one EOA) vs population (d)
(`current_owners` is null or contains only Coinbase-managed signers).

---

## 6. Known gaps (not-yet-implemented)

Honest inventory of what isn't built:

- **Sub-accounts on the waitlist signup flow (Track C).** Designed in
  [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md);
  blocked on this canonical doc landing so that the waitlist component
  has a stable invariant set to reference. The orchestrator code (§5.3)
  exists and has tests, but the new waitlist step + register endpoint
  (`POST /api/arch-b/sub-account/baseapp/register`) are unbuilt.
- **User-facing copy for population (d) when the deploy pre-flight
  simulation fails.** Today the deploy throws a generic-ish "Cannot set
  CreatorCoin payout recipient ... from <owner>" error. Population (d)
  needs a friendly "Update this in Zora's UI before launching" message
  with a link out. This is the only remaining gap from the
  [zora-payout-recipient-design.md](./zora-payout-recipient-design.md)
  reference architecture.

- **Spend Permission UX for waitlist sub-accounts.** Sub-accounts in
  v1 of the waitlist flow execute against their own balance (zero,
  until funded). Funding via Spend Permissions is a follow-up.

---

## 7. How to use this doc

For PRs that touch the account model:

1. **Before writing a design doc** that touches who-signs-what, what
   address is canonical, sub-account behaviour, owner-mutation lanes,
   or paymaster-validated selectors: **read this file end-to-end**.
2. **If your design conflicts with an invariant in §3:** either abandon
   the design or propose an invariant change in a separate PR. Do not
   ship a code PR that quietly violates an invariant.
3. **When you ship**, if your PR changes anything described here:
   update this doc in the same PR. Reviewers will block on
   doc-vs-code drift.
4. **When you find drift in another doc** (claims that conflict with
   this file): either fix it in your current PR (preferred) or open a
   docs-only follow-up. Don't leave conflicts in the tree.

For reviewers: when a PR description mentions "canonical wallet,"
"sub-account," "addOwnerAddress," "setPayoutRecipient,"
"wallet_sendCalls," or modifies migration 028 / the paymaster's allowed
selector list, expect to see this doc updated. If it isn't, ask why.

---

## 8. Sources / cross-links

Direct references used by this doc, kept here for one-click navigation:

- [docs/owner-mutation-decision-2026-05.md](./owner-mutation-decision-2026-05.md)
- [docs/sub-accounts-baseapp-design.md](./sub-accounts-baseapp-design.md)
- [docs/zora-payout-recipient-design.md](./zora-payout-recipient-design.md) (now reference architecture; see §5.1)
- [docs/arch-b-sub-account-design-addendum.md](./arch-b-sub-account-design-addendum.md)
- [docs/architecture-b-design.md](./architecture-b-design.md)
- [docs/4626-connection-methods.md](./4626-connection-methods.md)
- [docs/zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md)
- [frontend/docs/account-auth-invariants.md](../frontend/docs/account-auth-invariants.md)
- [frontend/db/migrations/028_arch_b_sub_accounts.sql](../frontend/db/migrations/028_arch_b_sub_accounts.sql)
- `frontend/src/pages/deploy/DeployVault.tsx` (lines 4910-4972, 5707-5740)
- `frontend/api/_handlers/paymaster/_paymaster.ts` (lines 3285-3300)
- `frontend/src/lib/wallet/subAccountSetup.ts`
- `frontend/server/_lib/wallet/userOperationSubmitter.ts`
- `contracts/utilities/routers/CreatorCoinPolicyController.sol`
- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`
- `.cursor/rules/csw-agent-lifecycle.mdc`
