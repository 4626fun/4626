# 4626 Connection Methods & Passkey Ceremony Architecture

**Internal Documentation — 4626 Project Team**

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) is the single source of truth for the 4626 account model — user populations, invariants, schema. This doc covers the *batched passkey ceremony* mechanics in detail; for the higher-level account model read ACCOUNT_MODEL.md first.

:::warning Current model — sub-accounts are dormant

The default user path is the **parent CSW + Privy embedded-owner signer** (`legacy-owner-install`), and signup is **email-only Privy**. Onboarding does **not** create a Base sub-account, and deploy **never** sends from one.

The Base sub-account lane described in the deeper sections below (the two-popup "batched ceremony", Phase 2 sub-account creation, etc.) is a **flag-gated, swap-only fallback** that only activates when both `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` and `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` are set. Treat those sections as reference for that optional lane, not the live default flow.

:::

---

## Table of Contents

1. [Overview](#1-overview)
2. [The Two Execution Paths](#2-the-two-execution-paths)
3. [Why Two Paths Exist](#3-why-two-paths-exist)
4. [The Batched Ceremony](#4-the-batched-ceremony)
5. [The Self-Call Constraint](#5-the-self-call-constraint)
6. [Detailed Flow: What Happens During Account Setup](#6-detailed-flow-what-happens-during-account-setup)
7. [Server Endpoint: provision-agent-owner](#7-server-endpoint-provision-agent-owner)
8. [Client Orchestration: useAccountSetupController](#8-client-orchestration-useaccountsetupcontroller)
9. [Fallback Behavior](#9-fallback-behavior)
10. [The Cursor Question: Sub-Account vs Direct Owner Delegation](#10-the-cursor-question-sub-account-vs-direct-owner-delegation)
11. [Architecture Diagram](#11-architecture-diagram)
12. [Invariants and Rules](#12-invariants-and-rules)
13. [Key Files Reference](#13-key-files-reference)
14. [PR History](#14-pr-history)

---

## 1. Overview

4626 uses Coinbase Smart Wallets (CSW) as the canonical user account. A CSW is a smart contract wallet on Base that signs transactions via WebAuthn passkeys — every transaction triggers a browser popup (Touch ID, Face ID, or hardware key).

For the **4626 canonical account**, `profiles.csw_address` === **`CANONICAL_CSW_ADDRESS`** (`0xAb6d5C10b03300326cd7fab7267ae192842967b5` in `frontend/src/wallet/canonicalWalletPolicy.ts`). XMTP agent 4626 inbox, Railway Keepr ERC-4337 sender, AKITA vault owner, sponsored swaps, and owner-install are **roles on that one wallet** — not a parallel "agent CSW." Runtime env: `CANONICAL_CSW_*` / optional `VITE_CANONICAL_CSW_ADDRESS` via `canonicalCswEnv.ts` and `agentXmtpAddress.ts`. Retired: `XMTP_AGENT_CSW_*`, `VITE_AGENT_XMTP_ADDRESS`.

This is secure but disruptive for an app that sends frequent transactions. 4626 solves this differently for two distinct contexts:

- **User-initiated sponsored swaps** use the **parent CSW** as the ERC-4337 sender, signed silently by a Privy embedded EOA that is a CSW owner.
- **Optional app-scoped transactions** may use a **sub-account** derived from the CSW when a route explicitly opts into that provider.
- **Server-side agent operations** (XMTP messaging, ERC-8004 identity, deploy-session automation) use the **CSW directly** as the ERC-4337 sender, signed by a Privy server-managed wallet added as a CSW owner via `addOwnerAddress`.

Both require a one-time authorization from the user. In the **current default flow**, the user signs in with email-only Privy and the embedded EOA is installed as a parent-CSW owner (`legacy-owner-install`) — no sub-account is created. The **batched two-popup ceremony** documented below (sub-account creation + agent owner install back-to-back) belongs to the flag-gated sub-account lane and is not part of standard onboarding.

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

The sub-account remains optional infrastructure for future app-scoped execution, but the proven production swap path uses the parent CSW directly through `canonical4337` so balances, approvals, and swap receipts stay on the same canonical account.

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
| **Base Sub-Account** | Execution-only child wallet (flag-gated) | Sub-account contract | Swap-only fallback lane when `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` | Silent day-to-day signing after one-time setup | Not usable for headless server execution; not the deploy default |
| **Privy Embedded EOA** | Signer identity (not canonical) | Signs parent CSW path (direct owner via `legacy-owner-install`) | User UX signer for sponsored canonical swaps | Fast UX with no repeated passkeys | Must not replace canonical CSW identity |
| **Privy Server Wallet** | Delegated signer (not canonical) | Signs parent CSW UserOps | XMTP agent, deploy-session automation, ERC-8004 operations | Headless reliable server signing | Requires one-time CSW owner install (`addOwnerAddress`) |
| **Privy Smart Wallet (4626)** | Optional helper signer surface | ERC-4337 smart wallet lane | Compatibility lane for owner setup / fallback signing only | Useful fallback when available | Do not silently promote to canonical wallet |

### Per-user wallet inventory (function + reason)

| Wallet | Primary Function | Why it exists in this setup |
|---|---|---|
| **Canonical CSW (parent)** | Identity + custody source of truth | Keeps ownership, balances, and canonical account continuity across Base/Zora |
| **Base sub-account** | Flag-gated swap-only fallback lane | App-scoped execution with silent signing; not the default user lane |
| **Privy embedded EOA** | Primary signer for parent CSW path (direct owner) | Removes repeated passkey friction for sponsored canonical swaps |
| **Connected external EOA** | Fallback/override signer path | Gives resilience and user-controlled manual signing when needed |
| **Privy server wallet** | Server-side delegated signer on parent CSW | Enables headless automation (XMTP/deploy/session) without changing canonical identity |

Design rule:

- **Canonical identity/custody stays on CSW.**
- **User execution defaults to parent CSW + embedded signer (`legacy-owner-install`). Sub-account is flag-gated swap-only fallback.**
- **External EOA is fallback/override, not the default primary signer lane.**

---

## 3. Why Two Paths Exist

These are not interchangeable. Each path exists because the other cannot serve its use case.

### Why sub-accounts can't serve server operations

Sub-accounts are scoped to a browser domain (`app.4626.fun`) and controlled by the Privy embedded EOA, which lives in the user's browser session. Server-side processes (XMTP agent, deploy-session) run headless — they have no browser, no embedded EOA access, and no sub-account context. They need to sign as the CSW directly using a server-held key.

### Why direct owner delegation isn't ideal for user transactions

While `addOwnerAddress` works at the contract level, the Base Account infrastructure (SDK, wallet provider, RPC layer) is designed around sub-accounts as the path for app-level signing. Sub-accounts give 4626:

- **Domain scoping** — isolated from other apps using the same CSW.
- **Silent signing** — the embedded EOA signs without any popup.
- **SDK integration** — `wallet_prepareCalls` / `wallet_sendPreparedCalls` handle nonces, gas, and submission.

### The result: a dual-path model

```
                    CSW (Base Account)
                    ┌──────────────────┐
                    │  MultiOwnable    │
                    │  owners:         │
                    │   [0] passkey    │
                    │   [1] agent EOA  │  ← server wallet (addOwnerAddress)
                    └────────┬─────────┘
                             │
               ┌─────────────┼─────────────┐
               │                           │
        Sub-Account                   CSW Direct
    (user-side execution)         (server-side execution)
               │                           │
     Privy embedded EOA            Privy server wallet
      (silent, browser)             (API, headless)
               │                           │
    swaps, vaults, deposits     XMTP, ERC-8004, deploy
```

---

## 4. The Batched Ceremony

### Before (two separate ceremonies)

Previously, the two owner installations happened at different times:

1. **Sub-account creation** — during account setup (passkey popup).
2. **Agent owner installation** — lazily, when the user first triggered a deploy-session or XMTP action (separate passkey popup, potentially days later).

This meant users encountered an unexpected passkey popup mid-flow when they tried to use agent features for the first time.

### After (one batched ceremony)

Both installations now happen during account setup, back-to-back:

1. **Passkey popup 1** — `wallet_addSubAccount` creates the sub-account.
2. **Passkey popup 2** — `eth_sendTransaction` submits `addOwnerAddress(agentWalletAddress)` to install the server wallet as a CSW owner.

The user sees two popups in rapid succession during onboarding. After that, both execution paths are fully operational with zero further passkey prompts.

### Why they can't be one popup

`wallet_addSubAccount` is a **wallet-provider RPC method** — it talks to the Base Account SDK layer, not the blockchain directly. `addOwnerAddress` is a **contract call** on the CSW — it's an on-chain transaction. These are fundamentally different operations at different protocol layers. They cannot be merged into a single passkey authorization. But they can be sequenced back-to-back in the same user session so the experience feels cohesive.

---

## 5. The Self-Call Constraint

This is the most important implementation detail in the batched ceremony and the one most likely to cause regressions.

### The Problem

`addOwnerAddress` is a **self-call**: the CSW calls `addOwnerAddress` on itself. In the transaction, `from` (the sender) and `to` (the target contract) are the same address — both are the CSW.

The Coinbase Smart Wallet popup uses an internal function called `eGe` that explicitly blocks `wallet_sendCalls` when `target === sender`:

```
"Self calls are not allowed"
```

This is documented in `onboardingWallet.ts` (lines 464–478):

```typescript
// WHY: The popup's eGe function blocks wallet_sendCalls when target === sender
// ("Self calls are not allowed").  addOwnerAddress is inherently a self-call.
```

### The Solution

Use `eth_sendTransaction` instead of `wallet_sendCalls`. Both methods route through the Coinbase popup, but they use different internal handlers:

| Method | Popup Handler | Self-Call Check |
|---|---|---|
| `wallet_sendCalls` | Batch handler with `eGe` guard | **Blocked** when `target === sender` |
| `eth_sendTransaction` | Standard transaction approval UI | **No self-call guard** |

The standard transaction approval UI that `eth_sendTransaction` uses does not have the `eGe` self-call check. The CSW popup internally handles passkey signing for `eth_sendTransaction` just as it would for any other transaction.

### The Fallback Chain

The existing codebase in `onboardingWallet.ts` uses a cascading fallback for self-authenticated CSW sessions:

```
eth_sendTransaction (primary — no self-call guard)
  → UserOp with EIP-712 typed signing (fallback 1)
    → UserOp with non-typed signing (fallback 2)
```

The batched ceremony in `useAccountSetupController.ts` uses the primary path (`eth_sendTransaction`) directly. If it fails, the entire agent owner installation is treated as non-fatal — deploy-session will handle it on first use.

### Why This Matters

If someone changes the batched ceremony code back to `wallet_sendCalls` (which looks more "correct" because it's the newer EIP-5792 method), the owner installation will silently fail every time. The catch block logs a warning but does not surface an error to the user. The sub-account setup still succeeds, so account setup appears complete. The user only discovers the problem later when deploy-session or XMTP prompts for a separate passkey ceremony — the exact UX problem the batched ceremony was built to eliminate.

---

## 6. Detailed Flow: What Happens During Account Setup

### Phase 1: Authentication and CSW Detection

```
1. User authenticates via Privy email login
   → Privy creates embedded EOA (secp256k1 key pair)
   → DB: profiles.primary_embedded_eoa = <embedded_address>

2. User connects Coinbase Smart Wallet (Base Account)
   → Detected via walletClientType === 'base_account'
   → DB: profiles.csw_address = <csw_address>

3. resolveCanonicalCsw() establishes canonical identity
   → Syncs linked accounts into profile_wallets
   → Sets is_canonical_smart_wallet = true
   → COALESCE sets base_sub_account = csw_address (temporary default)
```

### Phase 2: Sub-Account Creation (Passkey Popup 1)

```
4. useSubAccountSetup detects both wallets are present
   → canSetup = true

5. wallet_getSubAccounts checks for existing sub-account
   → If found: reuse it, skip creation
   → If not found: proceed to creation

6. wallet_addSubAccount creates the sub-account
   → PASSKEY POPUP — user authorizes via WebAuthn
   → Returns: { address: <sub_account_address> }

7. configureSubAccountSigner routes signing to embedded EOA
   → baseAccountSdk.subAccount.setToOwnerAccount()

8. POST /api/onboarding/register-sub-account
   → Server writes base_sub_account = <sub_account_address>
   → Overwrites the COALESCE default
```

### Phase 3: Agent Owner Installation (Passkey Popup 2)

```
9. POST /api/onboarding/provision-agent-owner
   → Server provisions Privy agent wallet (idempotent)
   → Server checks on-chain: is agent wallet already a CSW owner?
   → If already owner: returns { alreadyOwner: true }, done
   → If not owner: returns { alreadyOwner: false, txRequest }
       where txRequest = addOwnerAddress(agentWalletAddress) calldata

10. Client sends addOwnerAddress via eth_sendTransaction
    → cswProvider.request({
        method: 'eth_sendTransaction',
        params: [{
          from: canonicalCswAddress,
          to: cswAddress,            // SAME as from — self-call
          data: addOwnerAddress calldata,
          value: '0x0'
        }]
      })
    → PASSKEY POPUP — user authorizes the owner addition
    → Transaction submitted to Base mainnet

    ⚠ MUST use eth_sendTransaction, NOT wallet_sendCalls
      (see Section 5: The Self-Call Constraint)

11. Agent wallet is now a CSW owner
    → Server-side operations (XMTP, deploy-session) can sign as CSW
    → No further passkey prompts needed
```

### After Both Phases

```
CSW state:
  owners[0] = passkey (original, WebAuthn)
  owners[1] = agent server wallet (Privy-managed EOA)

Sub-account state:
  address = <sub_account_address>
  signer = Privy embedded EOA

User experience going forward:
  - Frontend transactions → sub-account → silent signing
  - Server agent operations → CSW direct → API signing
  - Zero passkey popups for either path
```

---

## 7. Server Endpoint: provision-agent-owner

**File:** `frontend/api/_handlers/onboarding/_provision-agent-owner.ts`

**Route:** `POST /api/onboarding/provision-agent-owner`

This endpoint is called by the client during account setup, immediately after sub-account creation succeeds.

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

## 8. Client Orchestration: useAccountSetupController

**File:** `frontend/src/features/accountSetup/useAccountSetupController.ts`

The agent owner installation executes immediately after successful sub-account registration (approximately lines 1005–1076).

### Execution Logic

1. After `register-sub-account` completes (or even if registration fails — the sub-account is on-chain regardless), the controller proceeds to agent owner installation.

2. Calls `POST /api/onboarding/provision-agent-owner` with auth headers.

3. Parses the response:
   - If `alreadyOwner === true` → logs and moves on.
   - If `alreadyOwner === false` and `txRequest` is present → proceeds to submit.

4. Resolves the CSW provider from the Base Account wallet:
   ```typescript
   const cswProvider = wallet.provider ?? wallet.getEthereumProvider()
   ```

5. Submits the `addOwnerAddress` call via `eth_sendTransaction`:
   ```typescript
   await cswProvider.request({
     method: 'eth_sendTransaction',  // NOT wallet_sendCalls — see Section 5
     params: [{
       from: canonicalCswAddress,
       to: agentJson.data.txRequest.to,   // === canonicalCswAddress (self-call)
       data: agentJson.data.txRequest.data,
       value: '0x0',
     }],
   })
   ```

6. This triggers **passkey popup 2** — the user approves adding the server wallet as a CSW owner.

### Error Handling

The entire agent owner installation block is wrapped in `try/catch` and is **non-fatal**:

- If the user cancels the passkey popup → warning logged, setup continues.
- If the API call fails → warning logged, setup continues.
- If the provider is unavailable → skipped silently.

The sub-account setup always completes regardless of whether agent owner installation succeeds.

---

## 9. Fallback Behavior

The batched ceremony is an optimization, not a hard requirement. If any part of phase 3 fails, the system degrades gracefully:

| Failure Point | What Happens | Recovery Path |
|---|---|---|
| `provision-agent-owner` API returns error | Warning logged, sub-account setup still completes | Deploy-session installs owner on first use |
| User cancels passkey popup 2 | Warning logged, sub-account works fine | Deploy-session installs owner on first use |
| `eth_sendTransaction` fails | Warning logged | Deploy-session installs owner on first use |
| Agent wallet already installed | No popup shown, logged as info | No action needed |
| CSW provider unavailable | Skipped silently | Deploy-session installs owner on first use |

In every failure case, the sub-account (user-side execution) remains fully functional. Only the server-side execution path is deferred — and it self-heals on first use through deploy-session's existing owner-installation flow.

### Deploy-Session Idempotency Check

**File:** `frontend/api/_handlers/deploy/session/_create.ts`

Deploy-session already checks `isOwnerOnChain()` before attempting to add the server wallet. If the batched ceremony succeeded, deploy-session finds the wallet is already an owner and skips installation entirely. If the batched ceremony was skipped or failed, deploy-session falls back to its original flow.

---

## 10. The Cursor Question: Sub-Account vs Direct Owner Delegation

### The Question

When asked about the relationship between the sub-account model and the direct-owner-delegation model, the correct answer is:

### Answer: C — Sub-account replaces delegation only for user-initiated frontend transactions. Server-side agent operations still use direct owner delegation on the parent CSW.

### Why C

The sub-account and direct owner delegation are **not alternatives** — they serve different purposes and coexist:

- **Sub-account** handles user-initiated transactions (swaps, vaults) via the Privy embedded EOA. The sub-account is the execution address and `msg.sender` on-chain. No passkey popups after initial setup.

- **Direct owner delegation** handles server-initiated operations (XMTP, ERC-8004, deploy-session) via a Privy server-managed wallet. The CSW itself is the execution address and `msg.sender` on-chain. The server wallet signs via Privy's API.

### How to Think About It

```
Before sub-accounts:
  User txs  → addOwnerAddress(embeddedEOA) → EOA signs for CSW
  Agent ops → addOwnerAddress(serverWallet) → server signs for CSW

After sub-accounts:
  User txs  → wallet_addSubAccount → embedded EOA signs for sub-account  ✓ CHANGED
  Agent ops → addOwnerAddress(serverWallet) → server signs for CSW       ✓ UNCHANGED
```

---

## 11. Architecture Diagram

### Full Account Setup Ceremony

```
User arrives at app.4626.fun
         │
         ▼
   Privy email login
   → embedded EOA created
   → CSW detected
         │
         ▼
┌─────────────────────────────────────────────┐
│  PHASE 1: Sub-Account Creation              │
│                                             │
│  wallet_getSubAccounts → none found         │
│  wallet_addSubAccount                       │
│  ┌──────────────────────────────┐           │
│  │  🔐 PASSKEY POPUP 1         │           │
│  │  "Allow app.4626.fun to     │           │
│  │   create a sub-account?"    │           │
│  └──────────────────────────────┘           │
│  configureSubAccountSigner                  │
│  POST /onboarding/register-sub-account      │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────┐
│  PHASE 2: Agent Owner Installation          │
│                                             │
│  POST /onboarding/provision-agent-owner     │
│  → server provisions agent wallet           │
│  → server checks on-chain ownership         │
│  → returns addOwnerAddress calldata         │
│                                             │
│  eth_sendTransaction (NOT wallet_sendCalls) │
│  ┌──────────────────────────────┐           │
│  │  🔐 PASSKEY POPUP 2         │           │
│  │  "Confirm transaction to    │           │
│  │   add owner on your wallet" │           │
│  └──────────────────────────────┘           │
│                                             │
│  ⚠ Self-call constraint:                   │
│    from === to === CSW address              │
│    wallet_sendCalls blocked by eGe guard    │
│    eth_sendTransaction has no such guard    │
└─────────────────┬───────────────────────────┘
                  │
                  ▼
         Setup complete.
         Both paths operational.
         Zero passkeys from here on.
```

### Post-Setup Execution Paths

```
┌─────────────────────────────────────────────────────────┐
│                    CSW (Base Account)                     │
│                    MultiOwnable contract                  │
│                                                          │
│  owners[0]: passkey (original WebAuthn credential)       │
│  owners[1]: agent server wallet (Privy-managed EOA)      │
│                                                          │
│  Sub-accounts:                                           │
│    app.4626.fun → sub-account (signer: embedded EOA)     │
└────────────────────┬────────────────────┬────────────────┘
                     │                    │
          ┌──────────┘                    └──────────┐
          │                                          │
          ▼                                          ▼
┌───────────────────────┐              ┌───────────────────────┐
│  USER-SIDE PATH       │              │  SERVER-SIDE PATH     │
│                       │              │                       │
│  Trigger: user clicks │              │  Trigger: XMTP msg,  │
│  swap/deposit/vault   │              │  deploy, ERC-8004     │
│                       │              │                       │
│  Execution address:   │              │  Execution address:   │
│  sub-account          │              │  CSW (parent)         │
│                       │              │                       │
│  Signer:              │              │  Signer:              │
│  Privy embedded EOA   │              │  Privy server wallet  │
│  (browser, silent)    │              │  (API, headless)      │
│                       │              │                       │
│  Flow:                │              │  Flow:                │
│  wallet_prepareCalls  │              │  Build UserOp         │
│  → EOA signs          │              │  → Privy API signs    │
│  → wallet_send...     │              │  → CDP Bundler sends  │
│                       │              │                       │
│  msg.sender:          │              │  msg.sender:          │
│  sub-account addr     │              │  CSW address          │
│                       │              │                       │
│  Passkey needed: NO   │              │  Passkey needed: NO   │
└───────────────────────┘              └───────────────────────┘
```

---

## 12. Invariants and Rules

These invariants are enforced in `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` and `.cursor/rules/csw-agent-lifecycle.mdc`.

### Identity Invariants

- The user's Coinbase Smart Wallet is the canonical account and universal identity (`profiles.csw_address`).
- For the **4626 canonical account**, `profiles.csw_address` === `CANONICAL_CSW_ADDRESS` (`0xAb6d5…967b5`) — XMTP inbox, AKITA vault owner, and Keepr sender are roles on that wallet, not separate accounts.
- Do not automatically create a new CSW.
- Do not silently switch to a Privy Smart Wallet.
- Privy EOAs and Privy Smart Wallets are signer/owner identities only.
- Do not reintroduce retired env `XMTP_AGENT_CSW_*` / `VITE_AGENT_XMTP_ADDRESS`; CI guard `pnpm -C frontend guard:canonical-csw` blocks regressions.

### Execution Path Invariants

- User-initiated frontend execution defaults to the **parent CSW** (`profiles.csw_address`) via `legacy-owner-install` / `canonical4337`, signed by the Privy embedded EOA.
- Optional **sub-account** (`sendCalls`) is flag-gated and **swap-only** — not the deploy default.
- Server-side Railway XMTP / Keepr / ERC-8004 uses **`CANONICAL_CSW_ADDRESS`** (same as that account's `profiles.csw_address`).
- Deploy-session automation uses the **creator's** `profiles.csw_address` with a temporary delegated owner.
- Code changes must respect which path applies — do not mix tracks silently.

### Owner Installation Invariants

- `wallet_addSubAccount` creates the sub-account (passkey popup 1) and is the readiness gate for user-initiated frontend execution.
- `addOwnerAddress(agentWalletAddress)` via **`eth_sendTransaction`** can opportunistically install the server wallet in the same session (passkey popup 2), but it must not block sub-account readiness.
- **Never use `wallet_sendCalls` for `addOwnerAddress`** — the Coinbase popup's `eGe` function blocks self-calls.
- Deploy-session and XMTP agent rely on the server wallet already being an owner.
- If popup 2 fails or is canceled, deploy-session handles installation on first use (non-blocking fallback).

### Security Invariants

- Never extract private keys from Privy; always use `secp256k1_sign` or `eth_sendTransaction` RPCs.
- XMTP agent must present as the CSW address, not the Privy EOA address.
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

## 13. Key Files Reference

### Account Setup (Batched Ceremony)

| File | Description |
|---|---|
| `frontend/src/features/accountSetup/useAccountSetupController.ts` | Orchestrator for the full account setup flow. After sub-account creation, calls `provision-agent-owner` and submits `addOwnerAddress` via `eth_sendTransaction`. |
| `frontend/api/_handlers/onboarding/_provision-agent-owner.ts` | Server endpoint: provisions agent wallet, checks on-chain ownership, returns `addOwnerAddress` calldata. |
| `frontend/api/_handlers/_routes.ts` | Static route registration — includes `onboarding/provision-agent-owner`. |

### Sub-Account (User-Side Path)

| File | Description |
|---|---|
| `frontend/src/lib/wallet/subAccountSetup.ts` | Core sub-account creation and signer configuration. `wallet_getSubAccounts`, `wallet_addSubAccount`, `configureSubAccountSigner`. |
| `frontend/src/hooks/useSubAccountSetup.ts` | React hook wrapping subAccountSetup. Exposes `canSetup`, `isSetUp`, and the setup trigger. |
| `frontend/api/_handlers/onboarding/_register-sub-account.ts` | Persists sub-account address to `profiles.base_sub_account`. |

### Agent Owner Delegation (Server-Side Path)

| File | Description |
|---|---|
| `frontend/server/_lib/wallet/privyWalletApi.ts` | `createAgentWallet()` — provisions Privy-managed EOA via Privy Wallet API. |
| `frontend/server/_lib/wallet/coinbaseSmartWalletOwner.ts` | `isOwner()` and `prepareAddOwnerTx()` — on-chain ownership check and `addOwnerAddress` calldata encoding. |
| `frontend/server/_lib/wallet/canonicalCswDelegation.ts` | `bootstrapCanonicalDelegationState()` — Privy auth verification and canonical CSW resolution. |

### Self-Call Documentation

| File | Description |
|---|---|
| `frontend/src/lib/wallet/onboardingWallet.ts` | Lines 464–478: documents the `eGe` self-call guard. Lines 812–916: `eth_sendTransaction` fallback chain for self-authenticated CSW sessions. |

### Agent Consumers (Use the Installed Owner)

| File | Description |
|---|---|
| `frontend/server/_lib/privyXmtpSigner.ts` | XMTP agent signer — signs messages via Privy API, presents as CSW address. |
| `frontend/server/_lib/agentRegistration.ts` | ERC-8004 agent registration — binds CSW as the verified agent wallet. |
| `frontend/api/_handlers/deploy/session/_create.ts` | Deploy-session — validates CSW ownership, uses Privy wallet as `sessionOwner`. |

### Cursor Rules

| File | Description |
|---|---|
| `.cursor/rules/ERC-4337-Wallet-Invariants.mdc` | Canonical wallet invariants. Documents the user-side vs server-side execution split, batched ceremony, and self-call constraint. |
| `.cursor/rules/csw-agent-lifecycle.mdc` | CSW-to-agent lifecycle. Documents the delegation model, `eth_sendTransaction` requirement, XMTP, ERC-8004, and deploy-session. |

---

## 14. PR History

| PR | Title | Status | Description |
|---|---|---|---|
| [#282](https://github.com/wenakita/4626/pull/282) | feat: batch agent owner installation into account setup ceremony | Merged | Created `provision-agent-owner` endpoint, wired into `useAccountSetupController`, updated Cursor rules. Initial implementation used `wallet_sendCalls`. |
| [#283](https://github.com/wenakita/4626/pull/283) | fix: use eth_sendTransaction for agent owner install (self-call guard) | Open | Fixed the self-call bug: switched from `wallet_sendCalls` to `eth_sendTransaction`. The Coinbase popup's `eGe` function blocks `wallet_sendCalls` when `target === sender`. Documented the constraint in both Cursor rules files. |

---

*Last updated: April 2026 — 4626 internal documentation. Covers PR #282 and PR #283.*
