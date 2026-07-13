---
title: 4626 Connection Methods
sidebar_position: 1
id: connection-methods
slug: /4626-connection-methods
---

# 4626 Connection Methods

**Internal Documentation — 4626 Project Team**

> **Canonical reference:** [docs/_internal/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) is the single source of truth for the 4626 account model — user populations, invariants, schema. This doc covers how user-initiated and server-side execution connect to the canonical parent CSW.

:::note Current model

The default user path is **parent CSW + Privy embedded-owner signer** (`legacy-owner-install`), with **email-only Privy** signup. Sponsored swaps use the parent CSW as ERC-4337 sender via `canonical4337`. `resolveExecutionTrack` returns only `legacy-owner-install` | `base-app-direct` | `none-yet`.

:::

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Two Execution Paths](#2-the-two-execution-paths)
3. [Why Two Paths Exist](#3-why-two-paths-exist)
4. [Agent Owner Install And The Self-Call Constraint](#4-agent-owner-install-and-the-self-call-constraint)
5. [Server Endpoint: provision-agent-owner](#5-server-endpoint-provision-agent-owner)
6. [Fallback Behavior](#6-fallback-behavior)
7. [How User And Server Paths Relate](#7-how-user-and-server-paths-relate)
8. [Architecture Diagram](#8-architecture-diagram)
9. [Invariants and Rules](#9-invariants-and-rules)
10. [Key Files Reference](#10-key-files-reference)
11. [PR History](#11-pr-history)

---

## 1. Overview

4626 uses Coinbase Smart Wallets (CSW) as the canonical user account. A CSW is a smart contract wallet on Base that signs transactions via WebAuthn passkeys — every transaction triggers a browser popup (Touch ID, Face ID, or hardware key).

The protocol and operator wallets are intentionally distinct. **`PROTOCOL_CSW_ADDRESS`** (`0x793ca28123cba3ca3c20b9c6c67f37510c89c145`) is Agent 4626's XMTP inbox, ERC-8004 identity, and Railway Keepr sender. **`CANONICAL_CSW_ADDRESS`** (`0xAb6d5C10b03300326cd7fab7267ae192842967b5`) remains the operator account's `profiles.csw_address` for custody, sponsored swaps, the AKITA vault, and owner-install. Runtime env uses `PROTOCOL_CSW_*` for the agent and `CANONICAL_CSW_*` for the operator wallet; client agent resolution optionally uses `VITE_PROTOCOL_CSW_ADDRESS`.

This is secure but disruptive for an app that sends frequent transactions. 4626 solves this differently for two distinct contexts:

- **User-initiated sponsored swaps** use the **parent CSW** as the ERC-4337 sender, signed silently by a Privy embedded EOA that is a CSW owner (`canonical4337`).
- **Server-side agent operations** use the applicable CSW directly, signed by a Privy server-managed wallet added as an owner: Railway XMTP/ERC-8004 uses `PROTOCOL_CSW_ADDRESS`, while deploy-session automation uses the creator's `profiles.csw_address`.

Both require a one-time authorization from the user. In the default flow, the user signs in with email-only Privy and the embedded EOA is installed as a parent-CSW owner (`legacy-owner-install`).

---

## 2. The Two Execution Paths

### User-Side: Parent CSW Sponsored Path

| Aspect | Detail |
|---|---|
| **Purpose** | Frontend-initiated sponsored swaps |
| **Execution address** | Canonical parent CSW |
| **Signer** | Privy embedded EOA confirmed as a CSW owner |
| **On-chain `msg.sender`** | Parent CSW address |
| **UX after setup** | Fully silent — no popups, no passkey prompts |
| **Setup mechanism** | CSW owner/signing authority for the embedded EOA |
| **DB column** | `profiles.csw_address`, `profiles.primary_embedded_eoa` |

Production swaps use the parent CSW directly through `canonical4337` so balances, approvals, and swap receipts stay on the same canonical account.

Transaction flow after setup:
```
eth_sendUserOperation
  → owner.sign()   ← Privy embedded EOA (silent, no popup)
  → EntryPoint + paymaster
  → parent CSW executes WETH deposit / approval / swap
```

### Server-Side: Direct Owner Delegation

| Aspect | Detail |
|---|---|
| **Purpose** | Server-initiated operations (XMTP agent, ERC-8004, deploy-session) |
| **Execution address** | CSW directly (the user's canonical Base Account) |
| **Signer** | Privy server-managed wallet (created via Privy Wallet API) |
| **On-chain `msg.sender`** | CSW address |
| **UX after setup** | Invisible — server signs via API, no user involvement |
| **Setup mechanism** | `addOwnerAddress` (contract call on the CSW's MultiOwnable) |
| **DB tracking** | `profile_wallets.privy_is_owner` |

The server wallet is added as an owner on the CSW's `MultiOwnable` contract. Once installed, the server can construct ERC-4337 UserOps where the CSW is the sender and the server wallet signs — the CSW validates the signature against its owner list.

Transaction flow after setup:
```
Server constructs UserOp (sender = CSW address)
  → Privy API: secp256k1_sign(userOpHash)
  → CDP Bundler submits to Base
  → CSW.validateUserOp() checks owner list → valid
  → CSW executes the operation
```

### Wallet-Type Decision Matrix

| Wallet Type | Canonical Role | Where It Signs | Default Usage in 4626 | Key Advantage | Key Constraint |
|---|---|---|---|---|---|
| **Zora/Base Coinbase Smart Wallet (CSW)** | Canonical identity + asset holder | Parent CSW (direct) | Source of truth for identity, balances, ownership, and server-side sender | Strong continuity across Zora/Base surfaces | Passkey UX is too heavy for frequent frontend execution |
| **Privy Embedded EOA** | Signer identity (not canonical) | Signs parent CSW path (direct owner via `legacy-owner-install`) | User UX signer for sponsored canonical swaps | Fast UX with no repeated passkeys | Must not replace canonical CSW identity |
| **Privy Server Wallet** | Delegated signer (not canonical) | Signs parent CSW UserOps | XMTP agent, deploy-session automation, ERC-8004 operations | Headless reliable server signing | Requires one-time CSW owner install (`addOwnerAddress`) |
| **Privy Smart Wallet (4626)** | Optional helper signer surface | ERC-4337 smart wallet lane | Compatibility lane for owner setup / fallback signing only | Useful fallback when available | Do not silently promote to canonical wallet |

### Per-user wallet inventory (function + reason)

| Wallet | Primary Function | Why it exists in this setup |
|---|---|---|
| **Canonical CSW (parent)** | Identity + custody source of truth | Keeps ownership, balances, and canonical account continuity across Base/Zora |
| **Privy embedded EOA** | Primary signer for parent CSW path (direct owner) | Removes repeated passkey friction for sponsored canonical swaps |
| **Connected external EOA** | Fallback/override signer path | Gives resilience and user-controlled manual signing when needed |
| **Privy server wallet** | Server-side delegated signer on parent CSW | Enables headless automation (XMTP/deploy/session) without changing canonical identity |

Design rule:

- **Canonical identity/custody stays on CSW.**
- **User execution defaults to parent CSW + embedded signer (`legacy-owner-install` / `canonical4337`).**
- **External EOA is fallback/override, not the default primary signer lane.**

---

## 3. Why Two Paths Exist

These are not interchangeable. Each path exists because the other cannot serve its use case.

### Why the user-side path uses the parent CSW directly

The default user-side execution path installs the Privy embedded EOA as a **direct owner** of the parent CSW (`legacy-owner-install`). The embedded EOA then signs `canonical4337` UserOps where the parent CSW is the sender — fully silent, no passkey popups after the one-time owner install. This keeps balances, approvals, and swap receipts on the same canonical account and is the proven production swap path.

### Why server operations need direct owner delegation

Server-side processes (XMTP agent, deploy-session) run headless — they have no browser and no access to the user's embedded EOA session. They need to sign as the CSW directly using a server-held key added via `addOwnerAddress`.

### The result: a dual-path model

```
                    CSW (Base Account)
                    ┌──────────────────┐
                    │  MultiOwnable    │
                    │  owners:         │
                    │   [0] passkey    │
                    │   [1] embedded   │  ← legacy-owner-install (default user signer)
                    │   [2] agent EOA  │  ← server wallet (addOwnerAddress)
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │                           │
        Parent CSW (direct)           CSW Direct
    (user-side execution)         (server-side execution)
    legacy-owner-install
               │                           │
     Privy embedded EOA            Privy server wallet
      (silent, browser)             (API, headless)
               │                           │
    swaps, vaults, deposits     XMTP, ERC-8004, deploy
```

---

## 4. Agent Owner Install And The Self-Call Constraint

Server-side automation installs a Privy server wallet as a CSW owner via `addOwnerAddress`. That call is a **self-call**: the CSW calls `addOwnerAddress` on itself (`from` and `to` are both the CSW).

The Coinbase Smart Wallet popup uses an internal function called `eGe` that explicitly blocks `wallet_sendCalls` when `target === sender`:

```
"Self calls are not allowed"
```

Use `eth_sendTransaction` instead of `wallet_sendCalls` for this owner-mutation path:

| Method | Popup Handler | Self-Call Check |
|---|---|---|
| `wallet_sendCalls` | Batch handler with `eGe` guard | **Blocked** when `target === sender` |
| `eth_sendTransaction` | Standard transaction approval UI | **No self-call guard** |

Fallback ladder used by onboarding wallet modules (`onboardingWalletPrepared.ts`, `onboardingWalletReplayable.ts`):

```
eth_sendTransaction (primary — no self-call guard)
  → UserOp with EIP-712 typed signing (fallback 1)
    → UserOp with non-typed signing (fallback 2)
```

If agent owner installation fails during setup, treat it as non-fatal — deploy-session installs the owner on first use when needed.

---

## 5. Server Endpoint: provision-agent-owner

**File:** `frontend/api/_handlers/onboarding/_provision-agent-owner.ts`

**Route:** `POST /api/onboarding/provision-agent-owner`


### Responsibilities

**1. Bootstrap Canonical Delegation State**

Calls `bootstrapCanonicalDelegationState()` to verify the Privy auth token and resolve the user's canonical CSW address.

**2. Provision the Agent Wallet**

Calls `createAgentWallet()` with an idempotency key tied to the canonical CSW:

```
idempotencyKey = "agent-owner:<csw_address>"
```

This ensures the same agent wallet is returned on retry — if the user refreshes or the ceremony is interrupted, the same wallet is provisioned again.

**3. Check On-Chain Ownership and Return Calldata**

Creates a public client against Base mainnet and calls `isOwnerOnChain()`:

- **If already owner:** Returns `{ alreadyOwner: true, agentWalletAddress }`. The client skips the second passkey popup.
- **If not owner:** Returns `{ alreadyOwner: false, agentWalletAddress, txRequest }` where `txRequest` contains the encoded `addOwnerAddress(agentWalletAddress)` calldata.

### Response Shape

```typescript
// Agent wallet already installed
{
  success: true,
  data: {
    alreadyOwner: true,
    agentWalletAddress: "0x..."
  }
}

// Agent wallet needs installation — client submits txRequest via eth_sendTransaction
{
  success: true,
  data: {
    alreadyOwner: false,
    agentWalletAddress: "0x...",
    txRequest: {
      chainId: 8453,
      to: "0x...",        // CSW address (same as from — self-call)
      data: "0x...",      // addOwnerAddress calldata
      value: "0x0"
    }
  }
}
```

### Rate Limiting and Error Handling

- Rate-limited using `RATE_LIMITS.cswLink`.
- Auth errors (missing/invalid Privy token) → 401.
- Setup state errors (no Base Account, no embedded wallet) → 409.
- Service configuration errors → 503.

---


---

## 6. Fallback Behavior

### Deploy-Session Idempotency Check

**File:** `frontend/api/_handlers/deploy/v2/session/_create.ts`

Deploy-session already checks `isOwnerOnChain()` before attempting to add the server wallet. If the batched ceremony succeeded, deploy-session finds the wallet is already an owner and skips installation entirely. If the batched ceremony was skipped or failed, deploy-session falls back to its original flow.

---

## 7. How User And Server Paths Relate

- **Parent CSW + embedded-owner signer** (`legacy-owner-install`) handles user-initiated transactions (swaps, vaults) via the Privy embedded EOA installed as a direct owner of the parent CSW. The parent CSW is the execution address and `msg.sender` on-chain via `canonical4337`.
- **Direct owner delegation** handles server-initiated operations (XMTP, ERC-8004, deploy-session) via a Privy server-managed wallet. The CSW itself is the execution address and `msg.sender` on-chain.

```
Default user-side path (legacy-owner-install):
  User txs  → embedded EOA installed as direct owner of parent CSW → EOA signs canonical4337 → CSW is sender
  Agent ops → addOwnerAddress(serverWallet) → server signs for CSW
```

---

## 8. Architecture Diagram

### Default Account Setup (legacy-owner-install)

```
User arrives at app.4626.fun
         │
         ▼
   Privy email login
   → embedded EOA created
   → CSW detected / linked
         │
         ▼
┌─────────────────────────────────────────────┐
│  EMBEDDED-OWNER INSTALL                     │
│                                             │
│  Privy embedded EOA installed as direct     │
│  owner of parent CSW (legacy-owner-install) │
│  → canonical4337 sender = parent CSW        │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
         Setup complete.
         Parent CSW operational for user-side
         canonical4337 execution.

  Server-side owner (agent wallet) installed
  lazily via deploy-session / XMTP first use.
```

### Post-Setup Execution Paths

```
┌─────────────────────────────────────────────────────────┐
│                    CSW (Base Account)                     │
│                    MultiOwnable contract                  │
│                                                          │
│  owners[0]: passkey (original WebAuthn credential)       │
│  owners[1]: embedded EOA (legacy-owner-install)          │
│  owners[2]: agent server wallet (Privy-managed EOA)      │
└────────────────────┬────────────────────┬────────────────┘
                     │                    │
          ┌──────────┘                    └──────────┐
          │                                          │
          ▼                                          ▼
┌───────────────────────┐              ┌───────────────────────┐
│ User-initiated        │              │ Server-initiated      │
│ canonical4337         │              │ UserOps               │
│ (embedded EOA signs)  │              │ (server wallet signs) │
└───────────────────────┘              └───────────────────────┘
```

---

## 9. Invariants and Rules

These invariants are enforced in `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` and `.cursor/rules/csw-agent-lifecycle.mdc`.

### Identity Invariants

- The user's Coinbase Smart Wallet is the canonical account and universal identity (`profiles.csw_address`).
- `PROTOCOL_CSW_ADDRESS` (`0x793c…c145`) is the public Agent 4626 XMTP/ERC-8004 identity and Railway Keepr sender.
- `CANONICAL_CSW_ADDRESS` (`0xAb6d5…967b5`) remains the operator account's `profiles.csw_address`, custody account, AKITA vault owner, and sponsored execution sender.
- Do not automatically create a new CSW.
- Do not silently switch to a Privy Smart Wallet.
- Privy EOAs and Privy Smart Wallets are signer/owner identities only.
- Do not reintroduce retired env `XMTP_AGENT_CSW_*` / `VITE_AGENT_XMTP_ADDRESS`; CI guard `pnpm -C frontend guard:canonical-csw` blocks regressions.

### Execution Path Invariants

- User-initiated frontend execution defaults to the **parent CSW** (`profiles.csw_address`) via `legacy-owner-install` / `canonical4337`, signed by the Privy embedded EOA.
- Server-side Railway XMTP / Keepr / ERC-8004 uses **`PROTOCOL_CSW_ADDRESS`**.
- Deploy-session automation uses the **creator's** `profiles.csw_address` with a temporary delegated owner.
- Code changes must respect which path applies — do not mix tracks silently.

### Owner Installation Invariants

- The default user-side readiness gate is the **parent CSW owner confirmation** — Privy embedded EOA installed as a direct owner of the parent CSW via `legacy-owner-install`. Once confirmed, the parent CSW is operational for `canonical4337` user-initiated frontend execution.
- `addOwnerAddress(agentWalletAddress)` via **`eth_sendTransaction`** can opportunistically install the server wallet in the same session (passkey popup 2 in the optional batched ceremony), but it must not block parent-CSW readiness.
- **Never use `wallet_sendCalls` for `addOwnerAddress`** — the Coinbase popup's `eGe` function blocks self-calls.
- Deploy-session and XMTP agent rely on the server wallet already being an owner.
- If the server-wallet install fails or is canceled, deploy-session handles installation on first use (non-blocking fallback).

### Security Invariants

- Never extract private keys from Privy; always use `secp256k1_sign` or `eth_sendTransaction` RPCs.
- XMTP agent must present as `PROTOCOL_CSW_ADDRESS`, not the delegated Privy EOA address.
- Deploy-session temporary owners must be removed after deployment completes.
- ERC-8004 `agentWallet` must point to the CSW address, not any Privy wallet.

### Upgrade Ambiguity Policy (Zora/Base)

If wallet metadata changes after Zora/Base app upgrades or cross-app relinking, treat canonical resolution as a verification flow, not an assumption:

1. **Detect**: refresh cross-app signals and canonical candidates from profile/auth sources.
2. **Verify**: confirm candidate has contract bytecode and re-check owner set before enabling signing.
3. **Confirm**: if a different CSW candidate appears, require explicit user-confirmed migration before switching canonical identity.

Guardrails:

- Never auto-migrate canonical CSW because a new candidate appears.
- Keep existing canonical CSW as identity anchor until user approval is recorded.
- Re-run owner checks after migration confirmation before enabling deploy/agent flows.

---

---

## 10. Key Files Reference

### Account Setup (Batched Ceremony)

| File | Description |
|---|---|
| `frontend/api/_handlers/onboarding/_provision-agent-owner.ts` | Server endpoint: provisions agent wallet, checks on-chain ownership, returns `addOwnerAddress` calldata. |
| `frontend/api/_handlers/_routes.ts` | Static route registration — includes `onboarding/provision-agent-owner`. |


| File | Description |
|---|---|

### Agent Owner Delegation (Server-Side Path)

| File | Description |
|---|---|
| `frontend/server/_lib/wallet/privyWalletApi.ts` | `createAgentWallet()` — provisions Privy-managed EOA via Privy Wallet API. |
| `frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts` | `isOwner()` and `prepareAddOwnerTx()` — on-chain ownership check and `addOwnerAddress` calldata encoding. |
| `frontend/server/_lib/wallet/canonicalCswDelegation.ts` | `bootstrapCanonicalDelegationState()` — Privy auth verification and canonical CSW resolution. |

### Self-Call Documentation

| File | Description |
|---|---|
| `frontend/src/lib/wallet/onboardingWalletPrepared.ts` · `onboardingWalletReplayable.ts` · `onboardingWalletDelegation.ts` | Formerly `onboardingWallet.ts` (split into three modules). `onboardingWalletPrepared.ts` handles `wallet_sendCalls`/self-call submission; `onboardingWalletReplayable.ts` handles signature parsing and `addOwnerAddress` calldata; `onboardingWalletDelegation.ts` handles owner-delegation flags/errors. |

### Agent Consumers (Use the Installed Owner)

| File | Description |
|---|---|
| `frontend/server/_lib/wallet/privyXmtpSigner.ts` | XMTP agent signer — signs messages via Privy API, presents as CSW address. |
| `frontend/server/_lib/agent/agentRegistration.ts` | ERC-8004 agent registration — binds CSW as the verified agent wallet. |
| `frontend/api/_handlers/deploy/v2/session/_create.ts` | Deploy-session — validates CSW ownership, uses Privy wallet as `sessionOwner`. |

### Cursor Rules

| File | Description |
|---|---|
| `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` | Canonical wallet invariants. Documents the user-side vs server-side execution split, batched ceremony, and self-call constraint. |
| `.cursor/rules/csw-agent-lifecycle.mdc` | CSW-to-agent lifecycle. Documents the delegation model, `eth_sendTransaction` requirement, XMTP, ERC-8004, and deploy-session. |

---

## 11. PR History

| PR | Title | Status | Description |
|---|---|---|---|
| [#282](https://github.com/wenakita/4626/pull/282) | feat: batch agent owner installation into account setup ceremony | Merged | Created `provision-agent-owner` endpoint, wired into `useAccountSetupController`, updated Cursor rules. Initial implementation used `wallet_sendCalls`. |
| [#283](https://github.com/wenakita/4626/pull/283) | fix: use eth_sendTransaction for agent owner install (self-call guard) | Open | Fixed the self-call bug: switched from `wallet_sendCalls` to `eth_sendTransaction`. The Coinbase popup's `eGe` function blocks `wallet_sendCalls` when `target === sender`. Documented the constraint in both Cursor rules files. |

---

*Last updated: April 2026 — 4626 internal documentation. Covers PR #282 and PR #283.*
