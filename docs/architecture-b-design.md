# Architecture B — Smart-Wallet UserOperation Routing for Agent Writes

Status: draft · owner: wallet/runtime · follow-up to [PR #290](https://github.com/wenakita/4626/pull/290)

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](./ACCOUNT_MODEL.md) is the canonical account-model doc. The schema in §4.1 below shows the *original* `command_issuer_execution_context` design; the as-shipped schema (including the sub-account columns added later) is in [`frontend/db/migrations/028_arch_b_sub_accounts.sql`](../frontend/db/migrations/028_arch_b_sub_accounts.sql) and is documented in ACCOUNT_MODEL.md §4.

## 1. Problem Statement

Every Privy-backed `eth_sendTransaction` path in the keepr / Zora agent runtime
currently signs as a per-creator Privy-managed EOA (`creator_agent_wallets.address`).
Those EOAs are never funded, so production users hit:

```
privy_http_400: The total cost (gas * gas fee + value) of executing this transaction
exceeds the balance of the account. Details: insufficient funds for gas * price + value:
have 0 want 1244
```

At the same time, the user's Coinbase Smart Wallet (CSW) — the wallet that
actually holds their ETH — is never reached by agent writes. A real production
example: user wallet `0xab6d5c10b03300326cd7fab7267ae192842967b5` holds ~0.0498 ETH,
has a Privy-managed owner EOA at index 0 (`0x6c0e...f9b3`, 0 ETH), and that owner
is what Privy signs with when the agent sends a transaction — so even a funded
smart wallet cannot pay for the call.

PR #290 is the defensive unblock: friendly-refuse before we hit Privy when the
signing EOA can't cover gas. This document specifies the correct fix.

## 2. Goals and Non-Goals

### Goals

1. Agent writes consume ETH from the **user's** smart wallet, not a per-creator EOA.
2. Signing authority is the Privy-managed **owner EOA** of that smart wallet, keyed to the **command issuer** (the Telegram user who typed the command).
3. Gas and paymaster routing reuse the existing Coinbase-ERC4337 helpers (`sendCoinbaseSmartWalletUserOperation`, `sendPrivyCoinbaseSmartWalletUserOperation`).
4. Hard-fail (not silent fallback) when the issuer is not execution-ready.
5. Per-tx and per-day spend caps are enforced server-side before any submission.
6. Canonical identity invariants are preserved — smart-wallet address is looked up, never trusted from client input.

### Non-Goals

- Rewriting Zora / Uniswap swap math. The call payload is unchanged — only its submission path changes.
- Replacing Privy as the signer. Privy still holds the owner-EOA key; only the execution context moves to UserOperation.
- Trend-funnel automation (see §7 — deferred product decision).

## 3. Invariants Preserved

| ID | Invariant | Mechanism |
| --- | --- | --- |
| I1 | Verified email is canonical identity | Telegram → profile resolution goes through existing `telegram_user_links` + `profiles` |
| I2 | Linked/onboarded ≠ execution-ready | New `isExecutionReady()` gate, hard-fails if smart wallet + Privy owner walletId + paymaster are not all provisioned |
| I3 | API keys server-side only | Paymaster + bundler URLs stay in `frontend/server/_lib/**`; never exposed to client |
| I4 | Token-kind separation (Creator vs Share) | Untouched — payload encoding is unchanged |
| I5 | Trust boundary on mutations | Resolution runs inside the same request authority check that exists today for `/keepr` commands |
| I6 | Preflight is read-only | Unchanged; preflight helper from PR #290 now reads the **smart wallet** balance |

## 4. Resolution Chain (new)

Today's `resolveSenderWalletWithSource(userId)` in
`frontend/api/_handlers/telegram/webhook/env.ts` reads from a **static env JSON
blob** (`userWalletMapJsonRaw`). That is fine for ops bootstrapping but is not a
canonical account lookup.

Arch B introduces a dedicated resolver:

```
telegramUserId
    └─ telegram_user_links (existing table)
        └─ profileId
            └─ profiles / profile_wallets (existing)
                └─ canonical smart wallet address (existing canonicalWalletResolver)
                    └─ privy_owner_wallet_id  ← NEW column / table
                        └─ sendPrivyCoinbaseSmartWalletUserOperation(...)
```

### 4.1 Schema Changes

New table (keeps the resolution auditable and reversible — we never mutate
`telegram_user_links` or `profiles`):

```sql
CREATE TABLE command_issuer_execution_context (
  profile_id              BIGINT PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  smart_wallet_address    TEXT   NOT NULL,                 -- lowercased 0x...
  privy_owner_wallet_id   TEXT   NOT NULL,                 -- Privy walletId for the owner EOA
  owner_eoa_address       TEXT   NOT NULL,                 -- cached, lowercased 0x...
  paymaster_policy        TEXT   NOT NULL DEFAULT 'cdp_default',
  caps_version            INT    NOT NULL DEFAULT 1,
  per_tx_cap_wei          NUMERIC(78, 0) NOT NULL,
  daily_cap_wei           NUMERIC(78, 0) NOT NULL,
  provisioned_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at              TIMESTAMPTZ NULL,
  CONSTRAINT ck_addresses_lowercase CHECK (
    smart_wallet_address = LOWER(smart_wallet_address) AND
    owner_eoa_address    = LOWER(owner_eoa_address)
  )
);

CREATE INDEX idx_issuer_exec_ctx_smart_wallet ON command_issuer_execution_context(smart_wallet_address);
```

Per-day usage tracking reuses the existing `recordDailySpend` machinery in
`frontend/server/keepr/sendCommand.ts`, but **also** gains a new counter keyed
by `(profile_id, ymd)` so caps apply across vaults, not only per vault.

### 4.2 Module Layout

- `frontend/server/_lib/wallet/commandIssuerContext.ts` (new)
  - `resolveCommandIssuerContext({ telegramUserId }): Promise<IssuerContext | null>`
  - `isExecutionReady(ctx): boolean`
  - `provisionCommandIssuerContext({...})` — called only from admin/onboarding endpoints, never from the hot path
- `frontend/server/_lib/wallet/userOperationSubmitter.ts` (new)
  - `submitUserOpOrRefuse({ issuer, call, caps, context }): Promise<SubmitResult>`
  - Internally calls `sendPrivyCoinbaseSmartWalletUserOperation` (already in `privyCoinbaseSmartWallet.ts`).
  - Returns a typed refusal (`insufficient_funds`, `cap_exceeded`, `not_execution_ready`) so callers render friendly copy.

Call sites migrated (`trendFunnel.ts` stays on the deferred list — see §7):

| Call site | Before | After |
| --- | --- | --- |
| `zora/commands.ts` buy / sell / create | `walletRpc(eth_sendTransaction)` on creator EOA | `submitUserOpOrRefuse` from issuer's CSW |
| `zora/trends.ts` `reserveTrendTicker` | same | same |
| `keepr/sendCommand.ts` ETH + ERC-20 transfer | same | same |

## 5. Spend Caps

Per §7.1 of the session discussion the cap model was **deferred to this doc**.
Recommended v1 defaults, configurable per-profile:

| Cap | Default | Scope | Env override |
| --- | --- | --- | --- |
| Per-tx value | 0.01 ETH | `command_issuer_execution_context.per_tx_cap_wei` | `ARCH_B_DEFAULT_PER_TX_CAP_WEI` |
| Daily value | 0.05 ETH | `command_issuer_execution_context.daily_cap_wei` | `ARCH_B_DEFAULT_DAILY_CAP_WEI` |
| Daily tx count | 50 | hard-coded constant v1 | — |
| Gas buffer | 300k × 10 gwei | reuses `DEFAULT_GAS_BUFFER_WEI` | `ARCH_B_GAS_BUFFER_WEI` |

Cap checks happen **after** quote but **before** UserOp submission, so the user
sees the same friendly refusal shape as the insufficient-funds path:

```
This trade can't be executed right now — it exceeds the per-transaction cap
of 0.01 ETH. Adjust the amount or contact setup to raise your limit.
```

Reservation is durable via the same `recordDailySpend` pattern (keyed on
`profile_id`), with rollback on refusal (already prototyped in PR #290's
`sendCommand.ts` preflight block).

## 6. Trust Boundary Analysis

| Input | Source | Trust | Validation |
| --- | --- | --- | --- |
| `telegramUserId` | Telegram webhook payload | **Untrusted** until HMAC-verified | Existing `TelegramWebhookConfig` zod gate |
| `profileId` from `telegram_user_links` | Server DB | Trusted | Linked only via proof→OTP→sync→bind→persist sequence |
| `smartWalletAddress` from `profile_wallets` | Server DB | Trusted | Written only through canonical wallet resolver |
| `privyOwnerWalletId` from `command_issuer_execution_context` | Server DB | Trusted | Written only by admin `provisionCommandIssuerContext` |
| `call.value`, `call.data`, `call.target` | Constructed server-side from quote response | Trusted | Unchanged; existing guard in `frontend/server/uniswap/guards.ts` still runs |
| Bundler / paymaster URLs | `process.env` | Server-only | Never crosses trust boundary |

**Explicit hard-fail cases** (no silent fallback):

1. No `telegram_user_links` row → refuse with "link your account first".
2. No `command_issuer_execution_context` row → refuse with "execution not enabled".
3. `revoked_at IS NOT NULL` → refuse.
4. Smart-wallet balance < value + gas buffer → refuse (existing PR #290 preflight, now reading CSW not EOA).
5. Cap exceeded → refuse with cap-specific copy.

## 7. Migration Plan (4 phases)

### Phase 1 — Design landed, schema only
- Land this doc.
- Ship schema migration for `command_issuer_execution_context`.
- Backfill **nothing** — the table is empty until onboarding writes to it.
- No behavior change. PR #290's preflight stays as the user-facing safety net.

### Phase 2 — `/keepr send` only
- Migrate `frontend/server/keepr/sendCommand.ts` to `submitUserOpOrRefuse`.
- Add an admin UI entry in `frontend/src/pages/admin/AdminAgentSetup.tsx` to provision a profile's execution context (generates / reuses the owner walletId, writes caps).
- Regression coverage: add `sendCommand.userOp.test.ts` mirroring the existing `sendCommand.test.ts`.
- Acceptance: a user with a provisioned profile can `/keepr send 0.001 eth 0xDest`; no creator agent wallet is touched.

### Phase 3 — Zora coin create / buy / sell
- Migrate `frontend/server/zora/commands.ts` buy / sell / create.
- Migrate `frontend/server/zora/trends.ts` `reserveTrendTicker`.
- Keep PR #290's fallback catch block — it becomes defense-in-depth.
- Acceptance: a production buy that fails today with `have 0 want 1244` succeeds from the user's CSW.

### Phase 4 — Trend funnel (product decision)
The trend funnel has **no command issuer**. It runs as automation on a schedule.
Options, to be chosen before Phase 4 lands:

1. **Dedicated treasury smart wallet** with capped daily spend, bound to a group admin.
2. **Skip funnel writes** until a human command issuer initiates them (`/coin trend funnel` already works).
3. **Keep the current EOA model for funnel only**, explicitly fund the EOA, and document it as a treasury-managed wallet.

This decision was deferred by the user during the session that produced PR #290.
Recommended: option 2 until the funnel's business value is re-validated.

## 8. Required Env Vars

All already wired into the repo (verified in `privyCoinbaseSmartWallet.ts` and
`xmtpQueueExecutor.ts`). No new secrets required:

- `CDP_PAYMASTER_URL` / `CDP_PAYMASTER_AND_BUNDLER_URL`
- `BUNDLER_URL`
- `KPR_ERC4337_BUNDLER_URL` (legacy alias: `KPR_ERC4337_BUNDLER_URL`)
- `PRIVY_APP_ID` / `PRIVY_APP_SECRET`
- `BASE_RPC_URL`

New optional env for caps (defaults from §5):

- `ARCH_B_DEFAULT_PER_TX_CAP_WEI`
- `ARCH_B_DEFAULT_DAILY_CAP_WEI`
- `ARCH_B_GAS_BUFFER_WEI`

## 9. Verification Plan

For each phase, the union of:

- `pnpm -C frontend lint`
- `pnpm -C frontend typecheck`
- `pnpm -C frontend test` (new + existing suites in `server/_lib/wallet`, `server/keepr`, `server/zora`)
- `pnpm security:local` on Phase 2 and Phase 3 (trust-boundary changes)
- Manual: one smoke transaction on a preview environment against the user's actual CSW before each phase reaches production.

## 10. Rollback

Each phase is independently revertable because the resolution chain is additive:

- Phase 1: drop the migration; no code paths depend on it yet.
- Phase 2 / 3: feature-flag via `ARCH_B_SEND_VIA_USEROP` (default off in production until ready). When disabled, the existing `walletRpc` path plus PR #290's preflight remain authoritative.
- Phase 4: product decision — no rollback plan needed until a path is chosen.

## 11. Residual Risks

1. **Paymaster policy drift**: CDP paymaster terms can change; caps partially protect spend, but we should alert on any paymaster rejection and pause that profile's execution.
2. **Owner EOA compromise**: if Privy is compromised, the attacker can drain up to `daily_cap_wei` per profile per day. Caps are the mitigation, not the cure.
3. **Resolver cache staleness**: `command_issuer_execution_context` is read on every command. Cache invalidation must happen on `revoked_at` writes. Recommended: short TTL (60s) in-process cache, revocations also broadcast via the existing `telegramLinkTelemetry` channel.
4. **Funnel deferral**: Phase 4 leaves trend-funnel writes broken (they stay on the defensive-refusal path). Acceptable if the product decision is "pause funnel" but must be communicated.

## 12. References

- Defensive unblock PR: [#290](https://github.com/wenakita/4626/pull/290)
- Helper already in place: `frontend/server/_lib/wallet/privyCoinbaseSmartWallet.ts` (`sendPrivyCoinbaseSmartWalletUserOperation`)
- Canonical resolver: `frontend/server/_lib/wallet/canonicalWalletResolver.ts` (`resolveCanonicalSmartWalletAddress`)
- Existing UserOp consumer (keeper queue): `frontend/server/keepr/xmtpQueueExecutor.ts`
- Balance preflight (reused as CSW balance check in Arch B): `frontend/server/_lib/wallet/walletBalancePreflight.ts`
