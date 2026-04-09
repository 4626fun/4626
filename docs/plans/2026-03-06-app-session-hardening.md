# App Session Hardening Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Make `app.4626.fun` reliably reflect a restored 4626 session after cross-origin Privy handoff, without weakening stricter wallet-match checks used by admin/deploy flows.

**Architecture:** Split the auth model into two explicit concepts: session presence and wallet-session match. Keep session restoration and server gating based on the restored session address, while reserving wallet-match checks for flows that truly require the connected wallet to equal the session wallet. Add a hydration-aware navbar state so the UI never flashes the wrong CTA before `/api/auth/me` resolves.

**Tech Stack:** React 19, Vite, TypeScript, React Router, wagmi, Privy, Vitest

---

### Task 1: Define auth-session semantics

**Files:**
- Modify: `frontend/src/hooks/useSiweAuth.ts`
- Test: `frontend/src/hooks/useSiweAuth.test.ts`

**Step 1: Write the failing test**

Add tests for a small exported helper that derives:
- `hasSession` from `authAddress`
- `walletMatchesSession` from `address` + `authAddress`

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test src/hooks/useSiweAuth.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Export a pure helper from `useSiweAuth.ts` and return the derived values from the hook.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test src/hooks/useSiweAuth.test.ts`

Expected: PASS

### Task 2: Make navbar auth state hydration-aware

**Files:**
- Modify: `frontend/src/components/ConnectButtonWeb3.tsx`
- Create: `frontend/src/components/ConnectButtonWeb3.test.tsx`

**Step 1: Write the failing test**

Add tests for a small exported helper that derives navbar mode:
- `hydrating`
- `connected-wallet`
- `session-restored`
- `signed-out`

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend test src/components/ConnectButtonWeb3.test.tsx`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Use `sessionHydrated`, `hasSession`, and connected-wallet state to drive the top-right button without changing stricter wallet-match behavior inside wallet-specific flows.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test src/components/ConnectButtonWeb3.test.tsx`

Expected: PASS

### Task 3: Stabilize waitlist handoff effect dependencies

**Files:**
- Modify: `frontend/src/pages/AppContinue.tsx`
- Test: `frontend/src/lib/auth/appContinueGate.test.ts`

**Step 1: Write the failing test**

Add or tighten a test proving handoff navigation depends only on the restored session address, not client Privy auth.

**Step 2: Run test to verify it fails if behavior is missing**

Run: `pnpm -C frontend test src/lib/auth/appContinueGate.test.ts`

Expected: Either existing PASS (if already covered) or a targeted failing test for any new helper extracted from `AppContinue.tsx`.

**Step 3: Write minimal implementation**

Remove broad object dependencies from `AppContinue` effects and depend on stable fields/functions only.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend test src/lib/auth/appContinueGate.test.ts`

Expected: PASS

### Task 4: Verify and polish

**Files:**
- Modify: `frontend/src/hooks/useSiweAuth.ts`
- Modify: `frontend/src/components/ConnectButtonWeb3.tsx`
- Modify: `frontend/src/pages/AppContinue.tsx`
- Test: `frontend/src/hooks/useSiweAuth.test.ts`
- Test: `frontend/src/components/ConnectButtonWeb3.test.tsx`
- Test: `frontend/src/lib/auth/appContinueGate.test.ts`

**Step 1: Run focused tests**

Run:
- `pnpm -C frontend test src/hooks/useSiweAuth.test.ts`
- `pnpm -C frontend test src/components/ConnectButtonWeb3.test.tsx`
- `pnpm -C frontend test src/lib/auth/appContinueGate.test.ts`

**Step 2: Run static verification**

Run:
- `pnpm -C frontend typecheck`

**Step 3: Inspect lints**

Use IDE lints for changed files and fix any new issues.
