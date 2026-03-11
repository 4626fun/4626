# Deploy Dry-Run Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a safe operator-facing deploy dry-run that simulates the exact `/deploy` phased payload without creating a session or broadcasting transactions.

**Architecture:** Introduce a dedicated `deploy/session/dry-run` API handler that shares request validation with `deploy/session/create`, then simulates phase calls in order using read-only RPC calls. Wire `/deploy` to call that endpoint from a separate dry-run action and present a compact phase-by-phase result summary.

**Tech Stack:** TypeScript, Vercel API handlers, React 19, Vite, viem, Vitest

---

### Task 1: Add failing API tests for dry-run success and safety

**Files:**
- Modify: `frontend/api/__tests__/deploySession.test.ts`
- Create: `frontend/api/__tests__/deploySessionDryRun.test.ts` only if separating tests is cleaner

**Step 1: Write the failing test**

Add tests asserting that:

- a dry-run request reuses deploy-session validation and returns a phase summary when all phase calls simulate successfully
- a failing simulated call returns the failing phase and call index
- dry-run does not insert a deploy session, update a deploy session, or send a user operation
- dry-run does not call Solana registration write routes

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: FAIL because no dry-run route or handler exists yet.

**Step 3: Write minimal implementation**

Add the smallest handler surface needed for those tests to pass.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: PASS for the new dry-run coverage.

### Task 2: Extract shared validation from deploy-session create

**Files:**
- Modify: `frontend/api/_handlers/deploy/session/_create.ts`
- Modify: `frontend/api/_handlers/deploy/session/_dryRun.ts`

**Step 1: Write the failing test**

Add or extend a test that proves dry-run and create reject the same invalid ownership or creator-access state.

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: FAIL because dry-run and create do not yet share the same validation path.

**Step 3: Write minimal implementation**

Extract reusable request validation helpers from `_create.ts` so both handlers rely on the same auth, ownership, allowlist, and infra checks.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: PASS.

### Task 3: Implement phased read-only simulation

**Files:**
- Modify: `frontend/api/_handlers/deploy/session/_dryRun.ts`

**Step 1: Write the failing test**

Add tests for:

- ordered phase simulation across `phase1`, `phase2Core`, `phase2Finalize`, `phase3`, and `phase4`
- short-circuiting on the first simulated failure
- skipping empty phases while keeping result ordering stable

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: FAIL because phase simulation and failure shaping do not exist yet.

**Step 3: Write minimal implementation**

Implement a dry-run handler that:

- accepts the same payload shape as `DeploySessionCreateRequest`
- uses `publicClient.call(...)` to simulate each call with the canonical smart wallet as the caller
- records pass/fail per phase and returns the first failure cleanly

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: PASS.

### Task 4: Wire `/deploy` to the dry-run endpoint

**Files:**
- Modify: `frontend/src/pages/DeployVault.tsx`

**Step 1: Write the failing test**

Add a page-level test if one exists nearby; otherwise extend local component coverage or create a targeted UI test proving:

- the dry-run action posts the same `sessionCreatePayload`
- it targets `/api/deploy/session/dry-run`
- it reports dry-run results without starting session continuation

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts`

Expected: FAIL because the UI has no separate dry-run action yet.

**Step 3: Write minimal implementation**

Add a dry-run button and result state to `DeployVault.tsx` that:

- reuses the existing payload builder
- does not install session owners
- does not call `continue`, `status`, or `cancel`
- surfaces concise dry-run diagnostics to the operator

**Step 4: Run test to verify it passes**

Run the targeted frontend test command you added for this UI change.

Expected: PASS.

### Task 5: Verify the feature end-to-end at test level

**Files:**
- No new production files required

**Step 1: Run focused tests**

Run:

- `pnpm -C frontend exec vitest run api/__tests__/deploySession.test.ts api/__tests__/deploySessionStart.test.ts`

Expected: PASS.

**Step 2: Run lint/type checks for touched files**

Run:

- `pnpm -C frontend exec eslint api/__tests__/deploySession.test.ts api/_handlers/deploy/session/_create.ts api/_handlers/deploy/session/_dryRun.ts src/pages/DeployVault.tsx`

If practical after edits, also run:

- `pnpm -C frontend typecheck`

Report any unrelated pre-existing failures separately.

**Step 3: Commit**

Only if explicitly requested by the user.
