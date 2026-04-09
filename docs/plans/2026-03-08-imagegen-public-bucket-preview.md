# Imagegen Public Bucket Preview Implementation Plan

> **Execution note:** Follow this plan task-by-task.

**Goal:** Make the `/admin/imagegen` runtime assumption explicit: the Supabase image bucket should be public for direct preview URLs.

**Architecture:** Keep the current Supabase Storage runtime unchanged. Add a small UI note where previews render and align the env documentation with that same assumption so setup is obvious and there is no ambiguity about why preview URLs work.

**Tech Stack:** React, TypeScript, Vitest, ESLint

---

### Task 1: Admin UI note

**Files:**
- Modify: `frontend/src/pages/AdminImageGeneration.test.ts`
- Modify: `frontend/src/pages/AdminImageGeneration.tsx`

**Step 1: Write the failing test**

Add an assertion that the page renders copy explaining that preview URLs expect a public Supabase image bucket.

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/pages/AdminImageGeneration.test.ts`

Expected: FAIL because the note does not exist yet.

**Step 3: Write minimal implementation**

Add a short note near the output preview explaining that `/admin/imagegen` currently expects `SUPABASE_IMAGE_BUCKET` to be public for direct previews.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/pages/AdminImageGeneration.test.ts`

Expected: PASS.

### Task 2: Env setup note

**Files:**
- Modify: `frontend/.env.example`

**Step 1: Update the setup comment**

Clarify that the current admin preview flow expects `SUPABASE_IMAGE_BUCKET` to be public.

**Step 2: Verify project checks**

Run:
- `pnpm vitest run src/pages/AdminImageGeneration.test.ts`
- `pnpm typecheck`
- `pnpm lint`

Expected: all commands pass.
