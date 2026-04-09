# Frontend Testing Structure

This document defines where frontend tests should live in this repository.

## Goals

- Keep tests close to the code they verify.
- Make file moves/refactors low-friction.
- Keep broad integration coverage discoverable.

## Placement Rules

### 1) Feature and component tests are colocated

Put `*.test.ts` / `*.test.tsx` next to the source file they validate.

Examples:

- `src/features/waitlist/WaitlistFlow.tsx`
- `src/features/waitlist/WaitlistFlow.test.ts`
- `src/features/home/vault-flow/VaultFlowScroll.tsx`
- `src/features/home/vault-flow/VaultFlowScroll.test.tsx`

### 2) Route-level tests stay with route modules

If a test validates route behavior (routing, redirects, route guards, page composition), keep it in the route module area (usually `src/pages/**`).

Examples:

- `src/pages/Home.test.ts`
- `src/pages/telegram/TelegramLink.test.tsx`

### 3) API handler tests stay under `api/__tests__`

Vercel/API route integration and handler behavior tests belong under:

- `frontend/api/__tests__/`

### 4) Shared pure-model tests stay with the model

For deterministic model/state utilities, colocate tests in the same model folder.

Examples:

- `src/features/home/vault-flow/model/storyClock.ts`
- `src/features/home/vault-flow/model/storyClock.test.ts`

## Naming Convention

- Unit/component/model: `*.test.ts` or `*.test.tsx`
- Keep one test file per source module unless a broader integration test is clearer.

## What To Avoid

- Do not create a new top-level catch-all test directory for frontend unit/component tests.
- Do not put feature tests in unrelated route folders.
- Do not mix API handler tests into `src/**`; keep them in `api/__tests__`.

## Commands

Run all frontend tests:

```bash
pnpm -C frontend test
```

Run a focused subset:

```bash
pnpm -C frontend test src/features/waitlist/WaitlistFlow.test.ts
pnpm -C frontend test src/features/home/vault-flow/VaultFlowScroll.test.tsx
pnpm -C frontend test api/__tests__/waitlistJoin.test.ts
```

Typecheck after test-path refactors:

```bash
pnpm -C frontend typecheck
```

Run the placement guard (checks only newly added test files):

```bash
pnpm -C frontend guard:test-file-placement
```

## Repository Note

Keep new and updated tests aligned with this structure. When touching older test locations, move them toward these placement rules when practical.
