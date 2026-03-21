# Canonical CSW Sync (Historical Zora-Anchored) Implementation Plan

> Historical note (2026-03-20): this implementation plan predates the current email-first account model. The verified email is now the canonical 4626 identity. References below to canonical wallet selection are about the canonical execution wallet only. See [frontend/docs/account-auth-invariants.md](/home/akitav2/projects/4626/frontend/docs/account-auth-invariants.md).

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Historical goal:** Make server-side wallet sync resolve and persist the canonical Coinbase Smart Wallet using Zora-linked wallet intersection, so Swap/Deploy/Account agree automatically.

**Architecture:** Extend `syncUserWallets` to (1) read any persisted canonical CSW, (2) optionally fetch Zora profile and infer canonical via intersection, (3) apply "Zora wins when available" precedence, and (4) persist the resolved canonical into `profile_wallets` + legacy `profiles` columns.

**Tech Stack:** Vercel Node functions, TypeScript, Vitest, `@zoralabs/coins-sdk` (server key), Postgres (Supabase).

---

### Task 1: Add failing tests for Zora-anchored canonical selection

**Files:**
- Modify: `frontend/api/__tests__/walletSync.test.ts`

**Step 1: Write the failing test**

- Add a test where the Privy payload contains 2+ non-Privy EVM `smart_wallet` candidates.
- Mock the Zora profile fetch to return `linkedWallets` that includes exactly one of those candidates.
- Assert `syncUserWallets(...)` returns that candidate as `canonicalSmartWallet.address` and persists it (by observing SQL calls or returned result).

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test frontend/api/__tests__/walletSync.test.ts`

Expected: FAIL because wallet sync does not consult Zora yet.

---

### Task 2: Implement server-side Zora profile fetch helper

**Files:**
- Create: `frontend/server/_lib/zoraProfile.ts`

**Step 1: Write minimal implementation**

- Export `fetchZoraProfile(identifier: string): Promise<any | null>`
- Behavior:
  - If `process.env.ZORA_SERVER_API_KEY` is missing, return `null`.
  - Otherwise, dynamic-import `@zoralabs/coins-sdk`, set key, call `getProfile({ identifier })`, and return `response.data.profile ?? null`.

**Step 2: Add unit-test mocking path**

- Ensure `walletSync.test.ts` can `vi.mock('../../server/_lib/zoraProfile.js', ...)`.

---

### Task 3: Resolve canonical CSW in `syncUserWallets` with “Zora wins”

**Files:**
- Modify: `frontend/server/_lib/walletSync.ts`

**Step 1: Read persisted canonical CSW**

- Extend `readPersistedIdentity` to:
  - Prefer the canonical from `profile_wallets.is_canonical_smart_wallet=true` when present.
  - Fall back to legacy columns (`primary_smart_wallet`, `csw_address`, `base_sub_account`) only when profile_wallets canonical is absent.
  - Also read `preprov_zora_handle` for seeding Zora fetch.

**Step 2: Infer canonical from Zora**

- Add helper(s) in `walletSync.ts`:
  - `normalizeHandle(value) => string | null` (strip `@`)
  - `pickZoraSeedIdentifier(persisted, classification) => string | null`
  - `inferCanonicalFromZora(profile, classification) => string | null`

**Step 3: Apply precedence**

- If Zora inference returns a canonical candidate, use it.
- Else if persisted canonical exists, keep it.
- Else fall back to existing Privy-based `classification.canonicalSmartWallet`.

**Step 4: Persist as usual**

- Keep existing writes to `profiles` and `profile_wallets` so the chosen canonical becomes durable for all app pages.

**Step 5: Run tests**

Run: `pnpm -C frontend test frontend/api/__tests__/walletSync.test.ts`

Expected: PASS.

---

### Task 4: Add regression test for “keep persisted canonical when Zora unavailable”

**Files:**
- Modify: `frontend/api/__tests__/walletSync.test.ts`

**Test scenario:**
- Persisted canonical exists in DB (mock `db.sql` to return a canonical from `profile_wallets`).
- Privy payload contains a different canonical candidate.
- Zora fetch returns `null` (or throws).
- Expect `syncUserWallets` keeps persisted canonical.

---

### Task 5: Run full frontend test suite (sanity)

Run: `pnpm -C frontend test`

Expected: PASS.
