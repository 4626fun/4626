# Canonical Ajna Keeper Implementation Plan

> **Execution note:** Follow this plan task-by-task.
>
> Historical note (2026-03-20): this plan predates the current email-first account model. The verified email is now the canonical 4626 identity; this document is about canonical CSW execution only. See [Account Auth Invariants](https://github.com/wenakita/4626/blob/main/frontend/docs/account-auth-invariants.md).

**Goal:** Let Ajna automation run from each creator's canonical Coinbase Smart Wallet using that creator's Privy embedded EOA signer context, with explicit opt-in, revocation, and no non-canonical sender fallback.

**Architecture:** Persist a per-vault automation signer context in the frontend/backend data layer, expose that context through protected `keepr`/`cre` read models, and update both the frontend Keepr Action Queue path and CRE Ajna runtime to resolve sender context dynamically per vault. Start with `AjnaVaultAuth.setMinBucketIndex(...)` only, keep the allowlist vault-scoped, and hard-stop whenever canonical-wallet ownership cannot be revalidated.

**Tech Stack:** TypeScript, Vercel API handlers, Postgres/Supabase, Privy Wallet API, viem/account-abstraction, CRE workflows, Vitest

---

**Execution note:** Do not create git commits unless the user explicitly asks for them.

**Relevant references:** `@vault-deployment`; implementation examples already in-tree include `frontend/server/_lib/creatorXmtpAgents.ts`, `frontend/server/_lib/privyXmtpSigner.ts`, `frontend/server/keepr/xmtpQueueExecutor.ts`, and `cre/utils/onchain.ts`.

### Task 1: Persist vault-scoped canonical automation signer context

**Files:**
- Modify: `frontend/server/_lib/keeprSchema.ts`
- Create: `frontend/server/_lib/keeprAutomation.ts`
- Modify: `frontend/server/_lib/keeprRegistry.ts`
- Modify: `frontend/api/_handlers/cre/vaults/_active.ts`
- Modify: `frontend/api/_handlers/vaults/_active.ts`
- Test: `frontend/api/__tests__/creVaultsActive.test.ts`

**Step 1: Write the failing tests**

Add API tests that assert:

- protected `GET /api/cre/vaults/active` includes a vault-scoped automation block for opted-in vaults:
  - `automationEnabled`
  - `automationScope`
  - `canonicalCswAddress`
  - `embeddedEoaAddress`
  - `privyWalletId`
- public `GET /api/vaults/active` does **not** expose `privyWalletId`
- vaults without automation context still appear, but their Ajna automation state is explicitly disabled/absent

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm -C frontend exec vitest run api/__tests__/creVaultsActive.test.ts
```

Expected: FAIL because no vault-scoped Ajna automation signer table/read model exists yet.

**Step 3: Write the minimal implementation**

Implement the persistence layer:

- add a new table in `keeprSchema.ts` such as `keepr_vault_automation` with:
  - `vault_address`
  - `profile_id`
  - `canonical_csw_address`
  - `embedded_eoa_address`
  - `privy_wallet_id`
  - `authorization_source`
  - `automation_enabled`
  - `automation_scope`
  - `last_owner_check_at`
  - `revoked_at`
  - `metadata`
  - timestamps
- create `keeprAutomation.ts` with helpers to:
  - upsert automation context
  - fetch automation context by vault
  - disable/revoke automation
  - normalize/validate stored addresses
- extend `KeeprConfigV1.contracts` in `keeprRegistry.ts` so vault config can carry nested Ajna addresses needed later:
  - `ajnaAdapter`
  - `ajnaInnerVault`
  - `ajnaAuth`
  - `ajnaPool`
- extend `frontend/api/_handlers/cre/vaults/_active.ts` to include protected automation metadata for CRE
- extend `vaults/_active.ts` only with safe public fields like `automationEnabled` / `automationScope` if needed, but never `privyWalletId`

**Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: PASS.

### Task 2: Add owner-authenticated API endpoints for consent, enable, revoke, and status

**Files:**
- Create: `frontend/api/_handlers/keepr/vault/_automation.ts`
- Modify: `frontend/api/_handlers/_routes.ts`
- Modify: `frontend/server/_lib/canonicalWalletResolver.ts`
- Modify: `frontend/server/_lib/walletSync.ts`
- Test: `frontend/api/__tests__/keeprVaultAutomation.test.ts`

**Step 1: Write the failing tests**

Add handler tests that assert:

- only the canonical vault owner can enable or disable Ajna automation for a vault
- enabling requires:
  - `vaultAddress`
  - canonical `cswAddress`
  - creator `embeddedEoaAddress`
  - creator `privyWalletId`
- `cswAddress` must match the stored canonical smart wallet for the actor
- `embeddedEoaAddress` must match the stored embedded EOA for the actor
- enabling defaults to the narrow scope `ajna_min_bucket_only`
- disabling flips `automation_enabled=false` and sets `revoked_at`

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm -C frontend exec vitest run api/__tests__/keeprVaultAutomation.test.ts
```

Expected: FAIL because the route and validation logic do not exist yet.

**Step 3: Write the minimal implementation**

Add a dedicated owner-authenticated API surface:

- `POST /api/keepr/vault/automation` for enable/update
- `GET /api/keepr/vault/automation` for current status
- `DELETE /api/keepr/vault/automation` for revoke/disable

Implementation details:

- resolve canonical CSW with `canonicalWalletResolver.ts`
- use `walletSync.ts` persisted identity as the source of truth for the embedded EOA
- write the vault-scoped signer context only after canonical/embedded wallet validation passes
- keep scope narrow: `ajna_min_bucket_only`
- never infer or create a fallback signer when required fields are missing

**Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: PASS.

### Task 3: Wire launch/admin surfaces to capture explicit creator opt-in

**Files:**
- Modify: `frontend/src/pages/deploy/DeployVault.tsx`
- Modify: `frontend/src/components/deploy/DeploymentSuccess.tsx`
- Modify: `frontend/src/pages/admin/AdminAgentSetup.tsx`
- Modify: `frontend/api/_handlers/v1/creators/_quickstart.ts`
- Test: `frontend/src/pages/admin/AdminAgentSetup.test.tsx`

**Step 1: Write the failing UI test**

Add a focused React test that asserts:

- the UI offers an explicit Ajna automation opt-in using the creator's canonical CSW
- the submit payload sends the creator's own:
  - `cswAddress`
  - `embeddedEoaAddress`
  - `privyWalletId`
- the UI does not mention or rely on the existing protocol-owned "Keepr signer" owner-add flow for Ajna automation

**Step 2: Run the test to verify it fails**

Run:

```bash
pnpm -C frontend exec vitest run src/pages/AdminAgentSetup.test.tsx
```

Expected: FAIL because launch/admin UI does not yet expose vault-scoped canonical Ajna automation consent.

**Step 3: Write the minimal implementation**

Wire the explicit opt-in flow:

- in `DeployVault.tsx` / `DeploymentSuccess.tsx`, surface the opt-in immediately after a successful vault launch
- in `AdminAgentSetup.tsx`, add a status + revoke/debug surface for already-launched vaults
- capture the creator's **own** Privy wallet ID from the connected embedded EOA wallet
- call the new `/api/keepr/vault/automation` endpoint
- in `_quickstart.ts`, keep the response honest:
  - mark canonical Ajna automation as available only when the creator has the required canonical/embedded wallet context
  - do not silently activate Ajna automation through the existing XMTP server-signer path

**Step 4: Run the test to verify it passes**

Run the same command as Step 2.

Expected: PASS.

### Task 4: Execute queued Ajna actions from the creator's canonical CSW

**Files:**
- Create: `frontend/server/_lib/privyCoinbaseSmartWallet.ts`
- Modify: `frontend/server/_lib/privyXmtpSigner.ts`
- Modify: `frontend/server/keepr/xmtpQueueExecutor.ts`
- Modify: `frontend/api/_handlers/keepr/actions/_enqueue.ts`
- Test: `frontend/api/__tests__/xmtpQueueExecutor.test.ts`
- Test: `frontend/api/__tests__/keeprActionsEnqueue.test.ts`

**Step 1: Write the failing tests**

Expand the Keepr Action Queue tests so they assert:

- `strategy.ajna.rebucket` executes via a Privy-backed UserOp from the stored canonical CSW sender
- Ajna execution verifies that `AjnaVaultAuth.admin()` equals the canonical CSW, not the generic keeper EOA
- Ajna execution fails closed when:
  - no automation context exists
  - automation is disabled/revoked
  - the scope is wider/narrower than expected
  - owner revalidation fails
- `keepr/actions/enqueue` rejects Ajna actions for vaults without enabled canonical automation context

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm -C frontend exec vitest run \
  api/__tests__/xmtpQueueExecutor.test.ts \
  api/__tests__/keeprActionsEnqueue.test.ts
```

Expected: FAIL because Ajna queue execution still assumes a direct keeper wallet path.

**Step 3: Write the minimal implementation**

Implement the canonical send path:

- extract the generic Privy + Coinbase Smart Wallet owner-index/UserOp logic into `privyCoinbaseSmartWallet.ts`
- update `xmtpQueueExecutor.ts` so Ajna strategy actions:
  - load the vault automation signer context
  - revalidate the owner relationship on-chain before every send
  - simulate and submit the UserOp from `canonical_csw_address`
  - never fall back to `KEEPR_PRIVATE_KEY` or any other non-canonical sender
- keep the existing direct paths for unrelated XMTP/group actions unchanged
- make `keepr/actions/_enqueue.ts` do the cheapest possible Ajna-specific precheck against the stored automation context

**Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: PASS.

### Task 5: Refactor CRE Ajna runtime to use per-vault execution context and remove global Ajna fallback

**Files:**
- Modify: `cre/utils/onchain.ts`
- Modify: `cre/actions/ajna-bucket-manager.action.ts`
- Modify: `cre/cre-workflows/_shared/strategyQueue.ts`
- Modify: `cre/cre-workflows/_shared/ajnaManager.ts`
- Modify: `cre/actions/strategy-signal-listener.action.ts`
- Test: `cre/tests/ajna-bucket-manager.test.ts`
- Test: `cre/tests/strategy-signal-listener.test.ts`
- Create: `cre/tests/canonical-sender-context.test.ts`

**Step 1: Write the failing tests**

Add/extend CRE tests to assert:

- `writeContract` can accept an optional per-call execution context:
  - `smartWallet`
  - `ownerAddress`
  - `privyWalletId`
  - `version`
- Ajna workflows skip vaults whose active-vault feed does not include enabled canonical automation
- Ajna workflows never write through the global `CRE_ERC4337_SMART_WALLET` or keeper EOA when canonical context is missing
- strategy-event Ajna enqueue paths preserve the canonical-only assumption

**Step 2: Run the tests to verify they fail**

Run:

```bash
pnpm -C cre exec vitest run \
  tests/canonical-sender-context.test.ts \
  tests/ajna-bucket-manager.test.ts \
  tests/strategy-signal-listener.test.ts
```

Expected: FAIL because CRE still assumes a singleton signer config.

**Step 3: Write the minimal implementation**

Refactor the Ajna runtime only:

- extend `frontend/api/_handlers/cre/vaults/_active.ts` consumption in `strategyQueue.ts` so the vault record can carry the protected automation block
- add an optional `executionContext` parameter to `writeContract` / ERC-4337 helpers in `cre/utils/onchain.ts`
- for Ajna only, use the per-vault context returned by the API:
  - `canonicalCswAddress`
  - `embeddedEoaAddress`
  - `privyWalletId`
  - `automationScope`
- keep non-Ajna workflows on the existing global signer path for now
- if `cre/actions/ajna-bucket-manager.action.ts` cannot be safely run canonically for a vault, hard-stop with a `canonical_sender_required`-style error instead of using the old global sender

**Step 4: Run the tests to verify they pass**

Run the same command as Step 2.

Expected: PASS.

### Task 6: Final verification and operator docs

**Files:**
- Modify: `cre/README.md`
- Modify: `docs/guides/deploy-vault.md`
- Modify: `docs/operations/deployment/launch/verification.md`
- Verify all files touched above

**Step 1: Update docs**

Document the canonical Ajna keeper model:

- creator CSW is the sender
- Privy embedded EOA is the signer bridge
- automation is opt-in and revocable per vault
- no fallback keeper wallet exists for Ajna canonical execution

Be explicit that this is different from the existing XMTP server-signer flow.

**Step 2: Run frontend verification**

Run:

```bash
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend exec vitest run \
  api/__tests__/creVaultsActive.test.ts \
  api/__tests__/keeprVaultAutomation.test.ts \
  api/__tests__/keeprActionsEnqueue.test.ts \
  api/__tests__/xmtpQueueExecutor.test.ts \
  src/pages/AdminAgentSetup.test.tsx
```

Expected: PASS.

**Step 3: Run CRE verification**

Run:

```bash
pnpm -C cre exec vitest run \
  tests/canonical-sender-context.test.ts \
  tests/ajna-bucket-manager.test.ts \
  tests/strategy-signal-listener.test.ts
```

Expected: PASS.

**Step 4: Do a final no-fallback sweep**

Run:

```bash
rg "CRE_ERC4337_SMART_WALLET|getKeeperAddress\\(|KEEPR_PRIVATE_KEY" \
  cre frontend/server \
  -g '!**/docs/plans/**'
```

Expected:

- Ajna execution paths no longer depend on a global keeper sender
- remaining references are limited to:
  - non-Ajna workflows that intentionally still use the global signer
  - docs/config comments that explain the transition
