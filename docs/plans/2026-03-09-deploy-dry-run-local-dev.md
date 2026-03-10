# Deploy Dry-Run Local Dev Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-command local workflow that starts a Base fork and the frontend dev server with the right env overrides for `/deploy` dry-run testing.

**Architecture:** Use a checked-in env preset example plus a shell script that validates an upstream Base RPC, starts Anvil in the background, exports localhost RPC settings and safe contract-override flags into the current process, then launches `pnpm dev` in the foreground. Document the command in the frontend README and `.env.example`.

**Tech Stack:** Bash, pnpm scripts, Vite env loading, Vitest

---

### Task 1: Add failing tests for the workflow wiring

**Files:**
- Create: `frontend/scripts/deployDryRunLocalDev.test.ts`

**Step 1: Write the failing test**

Add assertions that:

- `frontend/package.json` exposes a `dev:deploy-dry-run` script
- `frontend/scripts/dev-deploy-dry-run.sh` exists and references `anvil`, `BASE_FORK_UPSTREAM_RPC_URL`, `BASE_RPC_URL`, and `VITE_BASE_RPC`
- `frontend/.env.deploy-dry-run.example` exists and includes the fork variables and override safety flags
- `frontend/README.md` mentions the new command

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: FAIL because the script, preset, and docs do not exist yet.

**Step 3: Write minimal implementation**

Add only the files and text needed to satisfy the assertions.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: PASS.

### Task 2: Add the fork-plus-app runner

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/scripts/dev-deploy-dry-run.sh`

**Step 1: Write the failing test**

Extend the test to require:

- foreground `pnpm dev`
- background Anvil startup
- basic readiness wait
- cleanup trap for the Anvil child process

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: FAIL because the script does not yet implement the full lifecycle.

**Step 3: Write minimal implementation**

Implement the shell script with:

- upstream RPC validation
- `anvil --fork-url ... --host ... --port ... --chain-id 8453`
- exported `BASE_RPC_URL` + `VITE_BASE_RPC` pointed at localhost
- `VITE_ALLOW_CONTRACT_OVERRIDES=0` + `ALLOW_API_CONTRACT_OVERRIDES=0`
- trap-based cleanup

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: PASS.

### Task 3: Add the preset and docs

**Files:**
- Create: `frontend/.env.deploy-dry-run.example`
- Modify: `frontend/.env.example`
- Modify: `frontend/README.md`

**Step 1: Write the failing test**

Require the docs to explain:

- which env var supplies the upstream RPC
- which command starts the full workflow
- that localhost RPC values override local `.env` drift for the process

**Step 2: Run test to verify it fails**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: FAIL until the docs and preset reflect the new workflow.

**Step 3: Write minimal implementation**

Add a concise section and keep it dry-run-specific.

**Step 4: Run test to verify it passes**

Run: `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts`

Expected: PASS.

### Task 4: Verify the local workflow wiring

**Files:**
- No new production files required

**Step 1: Run focused tests**

Run:

- `pnpm -C frontend exec vitest run scripts/deployDryRunLocalDev.test.ts src/pages/DeployVaultDryRun.test.ts api/__tests__/deploySessionDryRun.test.ts`

Expected: PASS.

**Step 2: Run lint on touched files**

Run:

- `pnpm -C frontend exec eslint scripts/deployDryRunLocalDev.test.ts src/pages/DeployVaultDryRun.test.ts api/__tests__/deploySessionDryRun.test.ts package.json README.md`

If shell-script linting is not available, inspect the script manually and report that limitation.

**Step 3: Commit**

Only if explicitly requested by the user.
