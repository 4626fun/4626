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

| # | Population | Connected wallet | Canonical CSW | Signer | Spend permission? | What works on 4626.fun today |
|---|---|---|---|---|---|---|
| (a) | **Privy email-only** — signed up via email on 4626.fun | Privy embedded EOA only | none (no parent CSW) | Privy embedded EOA | No | All EOA-friendly flows: vault deposits, swaps, gauge votes. No CSW-gated flows. |
| (b) | **Base App user** — signed in via Base App | Parent CSW (passkey at `owner[0]`) | The Base App CSW | Frontend: Privy embedded EOA as direct owner of parent CSW (`legacy-owner-install`). Server automation: Privy server wallet delegated directly on the parent CSW. | No | Parent-CSW canonical flows use `canonical4337`. |
| (c) | **Zora CSW user with EOA owner in our Supabase mapping** | The user-controlled EOA from `zora_csw_owners.current_owners` (often the Privy-embedded EOA from Zora's own onboarding) | The Zora-deployed CSW | EOA owner of the Zora CSW | No | March-9 owner-`executeBatch` lane works for owner-mutating calls on the Zora CSW (e.g. `addOwnerAddress`). Signed UserOps via the EOA owner work for `setPayoutRecipient` / `transferOwnership` on the creator coin (this is **what the deploy flow already does** — see §5). |
| (d) | **Zora CSW user with no EOA owner** | The Zora CSW (Coinbase-managed signers only — passkeys) | The Zora-deployed CSW | None we can use from a third-party dapp | No | Read paths only. Pre-flight simulation in the deploy flow detects this and surfaces a clear error before any signature prompt. The user must complete owner-gated actions from inside Zora / Base App's own UI. |

Sources for the population taxonomy:

- [docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md](./wallet-notes/owner-mutation-decision-2026-05.md)
  established (a)–(d) and the "no add-owner from third-party dapp" decision.
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


- **The parent CSW is the default execution address for user-initiated
  frontend writes** (`profiles.csw_address`). Sponsored swaps use
  `canonical4337` with the parent CSW as ERC-4337 sender and the Privy
  embedded EOA as signer (installed as a direct owner via
  `legacy-owner-install`).
  Source: [`docs/_internal/4626-connection-methods.md`](./4626-connection-methods.md) §12,
  `frontend/server/_lib/wallet/executionTrack.ts`.


- **The Privy embedded EOA is installed as a direct owner on the parent
  CSW for the user-initiated frontend track** (`legacy-owner-install`).
  This is the default setup path.
  Source: [`docs/_internal/4626-connection-methods.md`](./4626-connection-methods.md) §12,
  `frontend/server/_lib/wallet/executionTrack.ts`.

- **For server-side automation only** (XMTP agent, ERC-8004 identity,
  deploy-session): a Privy *server* wallet (not the user's embedded
  EOA) is added to the parent CSW via `addOwnerAddress`. The parent CSW
  is the ERC-4337 sender on this track.
  Source: [`frontend/docs/account-auth-invariants.md`](../frontend/docs/account-auth-invariants.md) §"Server-side automation".

- **Daily spend ledger is profile-scoped.** A user's daily cap is a
  property of the issuer whose parent canonical CSW executes.

- **Hard-fail (not silent fallback) when the issuer is not
  execution-ready.** Trust boundaries: bundler URL, Privy wallet id,
  spend permission payload all server-side; never from client payload.
  Source: [docs/_internal/design/architecture-b-design.md](./design/architecture-b-design.md) §3.

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
  construct UserOps for owner-mutating selectors. The default user-side
  path for population (b) is **parent CSW + Privy embedded-owner signer**
  (`legacy-owner-install`) — the embedded EOA is installed as a direct
  owner of the parent CSW, which becomes the `canonical4337` sender.
  Use `addOwnerAddress` only for Zora-CSW users where an EOA owner is already known (population (c)).
  Source: [docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md](./wallet-notes/owner-mutation-decision-2026-05.md).

---

## 4. Schema — `command_issuer_execution_context`

Historical retired columns remain for schema compatibility but are retired
execution artifacts. Active rows must keep them NULL. The shared command-issuer
resolver fails closed if any artifact is present, if a spend permission was
revoked or expired, or if `smart_wallet_address` differs from
`profiles.csw_address`.

| Column | Type | Semantics |
|---|---|---|
| `parent_csw_address` | `TEXT` | Retired; canonical parent is `profiles.csw_address`; active rows must be NULL. |
| `spend_permission_payload` | `JSONB` | Retired; active rows must be NULL. |
| `spend_permission_signature` | `TEXT` | Retired; active rows must be NULL. |
| `spend_permission_hash` | `TEXT` | Retired; active rows must be NULL. |
| `spend_allowance_wei` | `NUMERIC(78, 0)` | Retired; active rows must be NULL. |
| `spend_period_seconds` | `INTEGER` | Retired; active rows must be NULL. |
| `spend_permission_end_at` | `TIMESTAMPTZ` | Retired validity residue; an expired value fails closed. |
| `spend_permission_revoked_at` | `TIMESTAMPTZ` | Retired revocation residue; any value fails closed as revoked. |

> **Drift watch.** An older draft of the design shows `CITEXT` and `BYTEA` for
> some of these columns. The migration that actually shipped uses `TEXT`
> everywhere and `JSONB` for the payload. Trust the migration, not historical
> design drafts.

How to keep this in sync: when the related migration is amended (or replaced by
a follow-up migration), update this section in the same PR. Don't ship schema
changes without touching this file.

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
([`contracts/creator/revenue/CreatorCoinPolicyController.sol`](../../contracts/creator/revenue/CreatorCoinPolicyController.sol))
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
flow. The default user-side path for population (b) is **parent CSW +
Privy embedded-owner signer** (`legacy-owner-install`) — the embedded EOA
installed as a direct owner of the parent CSW, which becomes the
`canonical4337` sender. Source:
[docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md](./wallet-notes/owner-mutation-decision-2026-05.md).

**Diagnostic lanes still exist.** `/dev/csw-signature-probe` retains
multiple owner-mutation lanes for low-level signing experiments —
including a passkey-direct UserOp lane that bypasses Base App entirely
via `navigator.credentials.get()`. These are dev-scoped diagnostics.
**Do not surface to end users.**


### 5.3 Canonical-parent XMTP (waitlist group + app messaging)

**Current decision.** Waitlist group chat and user-facing XMTP use the parent
canonical CSW (`profiles.csw_address`).

This describes the signed-in user's XMTP sender identity. The remote protocol
agent is a separate public identity: `PROTOCOL_CSW_ADDRESS`
(`0x793ca28123cba3ca3c20b9c6c67f37510c89c145`) is the Agent 4626 inbox,
ERC-8004 wallet, and Railway Keepr sender. The operator custody/execution wallet
remains `CANONICAL_CSW_ADDRESS` (`0xAb6d5…967b5`).

**Invariants preserved:**
- Parent CSW remains custody + public identity (leaderboard, Explore display).
- Waitlist group membership uses canonical parent-CSW addresses.
- Browser XMTP install state remains per-origin until a dedicated
  cross-origin handoff ships.

**Location.** Eligibility:
`frontend/server/_lib/waitlist/waitlistXmtpChatEligibility.ts`.
API: `GET /api/waitlist/xmtp-status`, `POST /api/waitlist/xmtp-join`.
Client identity resolution:
`frontend/src/lib/xmtp/identityResolver.ts` +
`frontend/src/lib/xmtp/provider.tsx` (reads `xmtpMemberAddress` from
status).

### 5.4 Agent commands — parent-CSW delegated-owner flow

**Location.** Shared resolver:
`frontend/packages/server-core/src/commandIssuerContext.ts`; submission:
`frontend/server/_lib/wallet/userOperationSubmitter.ts`.

**Current model.** Server command execution sends from the profile's parent
canonical CSW (`profiles.csw_address`) using its delegated Privy server-wallet
owner. The resolver requires `smart_wallet_address` to equal that canonical
CSW and rejects SpendPermission residue.

### 5.5 Indexer: `zora_csw_owners` (the (c) vs (d) discriminator)

**Location.** Server-side cron handlers at
`frontend/api/_handlers/v1/zora-csw/_scanCron.ts` and `_enrichCron.ts`.
Spec: [docs/zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md).

**What it produces.** A queryable map from CSW address to current
owner EOAs, refreshed via cron. This is how we identify population (c)
(`current_owners` array contains at least one EOA) vs population (d)
(`current_owners` is null or contains only Coinbase-managed signers).

### 5.6 AlfaClub Creator Coin linking — read-only proof

**Location.** Server verification and immutable claim persistence:
`frontend/server/_lib/alfaclub/creatorCoinLink.ts`. API:
`/api/v1/alfaclub/creator-coin/{status,challenge,verify}`. Room UI:
`frontend/src/components/alfaclub/CreatorCoinLinkPanel.tsx`.

**What it does.** A room creator can attach one Base Creator Coin to one
AlfaClub room without giving AlfaClub custody or payout authority. The server:

1. verifies that the authenticated live 4626 profile controls the FriendKey
   room and that the requested execution address belongs to the active
   canonical-CSW or EOA track;
2. reads contract code, Creator Coin metadata, owners, and the current
   `payoutRecipient()`;
3. proves direct authority with a read-only `eth_call` simulation of
   `setPayoutRecipient(currentPayoutRecipient)` from the real execution
   address, or recognizes the existing `CreatorCoinPolicyController` only
   when the settled keeper-vault binding matches the profile's canonical CSW,
   the profile's completed deployment granted that exact controller, and the
   controller's onchain immutables bind it to the same Creator Coin and payout
   router;
4. requires a short-lived, single-use EOA/EIP-1271 linking signature; and
5. writes an immutable room/coin claim with the verification block and method.

**Trust boundary.** Being the current `payoutRecipient()` is never ownership
proof. The linking flow never submits `setPayoutRecipient`, `addOwner`, or
`transferOwnership`, never installs an AlfaClub-controlled owner, and never
changes the parent CSW. LP inventory, factory approval, and pool creation are
separate readiness stages; LP fees remain in LP reserves.

---

## 6. Known gaps (not-yet-implemented)

Honest inventory of what isn't built:


- **User-facing copy for population (d) when the deploy pre-flight
  simulation fails.** Today the deploy throws a generic-ish "Cannot set
  CreatorCoin payout recipient ... from <owner>" error. Population (d)
  needs a friendly "Update this in Zora's UI before launching" message
  with a link out. This is the only remaining gap from the
  [zora-payout-recipient-design.md](./zora-payout-recipient-design.md)
  reference architecture.

---

## 7. How to use this doc

For PRs that touch the account model:

1. **Before writing a design doc** that touches who-signs-what, what
   address is canonical, owner-mutation lanes,
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
"wallet_sendCalls," or modifies command-issuer schema / the paymaster's allowed
selector list, expect to see this doc updated. If it isn't, ask why.

---

## 8. Sources / cross-links

Direct references used by this doc, kept here for one-click navigation:

- [docs/_internal/wallet-notes/owner-mutation-decision-2026-05.md](./wallet-notes/owner-mutation-decision-2026-05.md)
- [docs/zora-payout-recipient-design.md](./zora-payout-recipient-design.md) (now reference architecture; see §5.1)
- [docs/_internal/design/architecture-b-design.md](./design/architecture-b-design.md)
- [docs/_internal/4626-connection-methods.md](./4626-connection-methods.md)
- [docs/zora-csw-indexer-cron-spec.md](./zora-csw-indexer-cron-spec.md)
- [frontend/docs/account-auth-invariants.md](../frontend/docs/account-auth-invariants.md)
- `frontend/src/pages/deploy/DeployVault.tsx` (lines 4910-4972, 5707-5740)
- `frontend/api/_handlers/paymaster/_paymaster.ts` (lines 3285-3300)
- `frontend/server/_lib/wallet/userOperationSubmitter.ts`
- `contracts/creator/revenue/CreatorCoinPolicyController.sol`
- `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`
- `.cursor/rules/csw-agent-lifecycle.mdc`
