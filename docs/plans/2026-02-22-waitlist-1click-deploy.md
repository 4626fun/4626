# Waitlist + 1-Click Deploy Hardening Implementation Plan
 
> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.
 
**Goal:** Make the waitlist "Done" step smooth and bounded, and make vault deploy truly 1-click using the canonical Zora Coinbase Smart Wallet (CSW) as sender without requiring an external owner wallet for new creators.
 
**Architecture:** Fix waitlist UI state machines so they never hang or show scary errors when the user is unauthenticated. For deploy, keep the existing server-continue architecture (one user signature, server executes the rest), but change the deploy-session signer installation to use a sponsored ERC-4337 UserOp signed by a Privy-owned signer (embedded EOA or Privy smart wallet) when available. Update the paymaster proxy validator to allow deploy-session "self-call only" UserOps tied to an active deploy session.
 
**Tech Stack:** Vite + React Router (SPA), TypeScript, Privy, Coinbase Smart Wallet (ERC-4337 / EntryPoint v0.6), viem + viem/account-abstraction, Vercel serverless handlers under `frontend/api/`, Vitest.
 
---
 
## Scope / Non-Goals
 
- In scope: waitlist UX hardening (Done step), paymaster proxy validation for deploy-session setup, client deploy flow updates in `DeployVault.tsx`.
- Out of scope: rewards ecosystem deploy, spoke work, changing URLs/routes, any canonical wallet invariant violations.
 
## Current Known Issues
 
- `frontend/src/components/waitlist/WaitlistFlow.tsx` can leave `deployAccessState='checking'` forever when the Done step has no verified wallet address, causing the CTA area to show a perpetual skeleton.
- `frontend/src/components/waitlist/steps/DoneStep.tsx` shows "Account prep will retry later" for `401/403` responses from `/api/waitlist/preprovision` (noisy for unauthenticated users).
- `frontend/src/pages/DeployVault.tsx` server-continue mode requires installing the deploy-session signer via an external owner EOA transaction (`sendTransaction`), breaking "Privy-only" onboarding for new creators.
- `frontend/api/_handlers/_paymaster.ts` rejects UserOps that contain *only* deploy-session self-calls (add/remove owner) with `missing_primary_call(...)`, so even an ERC-4337 install attempt is not sponsorable unless bundled with a batcher call.
 
## Desired Behavior (Acceptance Criteria)
 
- Waitlist Done step never hangs in "Checking access..." indefinitely; it degrades to a stable state within seconds.
- `/api/waitlist/preprovision` failure is quiet for `401/403/404` (card hidden), but can still show a retry message for real server errors (5xx).
- "Enter App" CTA is shown only when allowlist check confirms access (or admin bypass), and is hidden otherwise.
- Deploy remains canonical-CSW-sender: all sponsored UserOps execute from the canonical CSW; Privy wallets are signer identities only.
- Deploy is 1-click for new creators: no external owner wallet connect required if the Privy embedded EOA (or Privy smart wallet) is already an onchain owner of the canonical CSW.
- Existing creators can still deploy via a one-time external owner linking/transaction when Privy signers are not onchain owners (clear error message).
 
---
 
## Task 0: Setup (Worktree + Baseline)
 
**Files:** none
 
**Step 1: (Optional) Create a dedicated worktree**
 
Run:
 
```bash
git status
git worktree add ../4626-waitlist-1click -b waitlist-1click-2026-02-22
```
 
Expected: new worktree created; no errors about the branch being checked out elsewhere.
 
**Step 2: Install frontend deps**
 
Run:
 
```bash
pnpm -C frontend install
```
 
Expected: install completes successfully.
 
**Step 3: Confirm baseline tests**
 
Run:
 
```bash
pnpm -C frontend test
pnpm -C frontend lint
pnpm -C frontend typecheck
```
 
Expected: all pass (or capture failures before proceeding).
 
---
 
## Task 1: Waitlist Done Deploy Access Check Is Bounded
 
**Files:**
- Modify: `frontend/src/components/waitlist/WaitlistFlow.tsx`
- Test: `frontend/src/components/waitlist/WaitlistFlow.deployAccessState.test.ts`
 
**Step 1: Write the failing test**
 
Create `frontend/src/components/waitlist/WaitlistFlow.deployAccessState.test.ts`:
 
```ts
import { describe, expect, it } from 'vitest'
import { resolveDoneStepDeployAccessState } from './_waitlistDeployAccess'

describe('resolveDoneStepDeployAccessState', () => {
  it('returns ready for bypass admin even without wallet', () => {
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: true, verifiedWallet: null })).toEqual({
      state: 'ready',
      addressToCheck: null,
    })
  })

  it('returns waitlist when verified wallet is missing', () => {
    expect(resolveDoneStepDeployAccessState({ isBypassAdmin: false, verifiedWallet: null })).toEqual({
      state: 'waitlist',
      addressToCheck: null,
    })
  })

  it('normalizes verified wallet to lowercase address', () => {
    expect(
      resolveDoneStepDeployAccessState({
        isBypassAdmin: false,
        verifiedWallet: '0xB05Cf01231cF2fF99499682E64D3780d57c80FdD',
      }),
    ).toEqual({
      state: 'checking',
      addressToCheck: '0xb05cf01231cf2ff99499682e64d3780d57c80fdd',
    })
  })
})
```
 
**Step 2: Run test to verify it fails**
 
Run:
 
```bash
pnpm -C frontend test -- src/components/waitlist/WaitlistFlow.deployAccessState.test.ts
```
 
Expected: FAIL because `./_waitlistDeployAccess` does not exist.
 
**Step 3: Write minimal implementation helper**
 
Create `frontend/src/components/waitlist/_waitlistDeployAccess.ts`:
 
```ts
import { isValidEvmAddress } from '@/lib/chainAddress'

export type DeployAccessState = 'checking' | 'ready' | 'waitlist'

export function resolveDoneStepDeployAccessState(params: {
  isBypassAdmin: boolean
  verifiedWallet: string | null | undefined
}): { state: DeployAccessState; addressToCheck: string | null } {
  if (params.isBypassAdmin) return { state: 'ready', addressToCheck: null }
  const addr =
    typeof params.verifiedWallet === 'string' && isValidEvmAddress(params.verifiedWallet)
      ? params.verifiedWallet.toLowerCase()
      : null
  if (!addr) return { state: 'waitlist', addressToCheck: null }
  return { state: 'checking', addressToCheck: addr }
}
```
 
**Step 4: Run test to verify it passes**
 
Run:
 
```bash
pnpm -C frontend test -- src/components/waitlist/WaitlistFlow.deployAccessState.test.ts
```
 
Expected: PASS.
 
**Step 5: Wire helper into `WaitlistFlow.tsx` and bound the effect**
 
In `frontend/src/components/waitlist/WaitlistFlow.tsx`, update the `deployAccessState` effect to:
 
- Always set a terminal state for Done step even when wallet is missing.
- Prefer admin bypass to immediately set `ready`.
- Abort the allowlist fetch after a short timeout (e.g. 6-8s) and fall back to `waitlist`.
 
Concrete patch shape (illustrative; keep minimal):
 
```ts
import { resolveDoneStepDeployAccessState } from './_waitlistDeployAccess'

useEffect(() => {
  let cancelled = false
  const run = async () => {
    if (step !== 'done') return

    const intent = resolveDoneStepDeployAccessState({ isBypassAdmin, verifiedWallet })
    if (!cancelled) setDeployAccessState(intent.state)
    if (intent.state !== 'checking' || !intent.addressToCheck) return

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 8_000)
    try {
      const res = await apiFetch(`/api/creator-allowlist?address=${encodeURIComponent(intent.addressToCheck)}`, {
        method: 'GET',
        signal: ctrl.signal as any,
      } as any)
      const json = (await res.json().catch(() => null)) as any
      const data = json?.success ? json?.data : null
      const mode = typeof data?.mode === 'string' ? String(data.mode) : null
      const allowed = data?.allowed === true
      const ok = mode === 'disabled' || allowed
      if (!cancelled) setDeployAccessState(ok ? 'ready' : 'waitlist')
    } catch {
      if (!cancelled) setDeployAccessState('waitlist')
    } finally {
      clearTimeout(t)
    }
  }
  void run()
  return () => {
    cancelled = true
  }
}, [apiFetch, isBypassAdmin, step, verifiedWallet])
```
 
**Step 6: Run full frontend tests**
 
Run:
 
```bash
pnpm -C frontend test
```
 
Expected: PASS.
 
**Step 7: Commit**
 
```bash
git add frontend/src/components/waitlist/WaitlistFlow.tsx frontend/src/components/waitlist/_waitlistDeployAccess.ts frontend/src/components/waitlist/WaitlistFlow.deployAccessState.test.ts
git commit -m "fix(waitlist): bound deploy access check on Done step"
```
 
---
 
## Task 2: Make Preprovision Status Quiet on 401/403/404
 
**Files:**
- Modify: `frontend/src/components/waitlist/steps/DoneStep.tsx`
- Test: `frontend/src/components/waitlist/preprovisionStatus.test.ts`
 
**Step 1: Write failing tests**
 
Create `frontend/src/components/waitlist/preprovisionStatus.test.ts`:
 
```ts
import { describe, expect, it } from 'vitest'
import { classifyPreprovisionResponse } from './preprovisionStatus'

describe('classifyPreprovisionResponse', () => {
  it('hides card for 401/403/404', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 401, json: null })).toBe('idle')
    expect(classifyPreprovisionResponse({ httpStatus: 403, json: null })).toBe('idle')
    expect(classifyPreprovisionResponse({ httpStatus: 404, json: null })).toBe('idle')
  })

  it('shows error for non-quiet failures', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 500, json: null })).toBe('error')
  })

  it('returns done when success payload present', () => {
    expect(classifyPreprovisionResponse({ httpStatus: 200, json: { success: true, data: { serverWalletAddress: '0x1' } } })).toBe('done')
  })
})
```
 
**Step 2: Run test to verify it fails**
 
Run:
 
```bash
pnpm -C frontend test -- src/components/waitlist/preprovisionStatus.test.ts
```
 
Expected: FAIL because `preprovisionStatus.ts` does not exist.
 
**Step 3: Write minimal implementation**
 
Create `frontend/src/components/waitlist/preprovisionStatus.ts`:
 
```ts
export type PreprovisionUiStatus = 'idle' | 'loading' | 'done' | 'error'

export function classifyPreprovisionResponse(params: { httpStatus: number; json: any }): PreprovisionUiStatus {
  const quiet = params.httpStatus === 401 || params.httpStatus === 403 || params.httpStatus === 404
  if (params.json?.success === true && params.json?.data) return 'done'
  if (quiet) return 'idle'
  return 'error'
}
```
 
**Step 4: Run test to verify it passes**
 
Run:
 
```bash
pnpm -C frontend test -- src/components/waitlist/preprovisionStatus.test.ts
```
 
Expected: PASS.
 
**Step 5: Update `DoneStep.tsx` to use the classifier**
 
In `frontend/src/components/waitlist/steps/DoneStep.tsx` inside `PreprovisionStatus.run()`:
 
- Replace `setStatus(res.status === 404 ? 'idle' : 'error')` with classifier-based behavior.
- Treat `401/403/404` as `idle` (return null / hide card).
 
Concrete patch shape:
 
```ts
import { classifyPreprovisionResponse } from '../preprovisionStatus'

// ...
const next = classifyPreprovisionResponse({ httpStatus: res.status, json })
if (!cancelled && next === 'done') { /* existing done path */ }
else if (!cancelled) setStatus(next)
```
 
**Step 6: Run full frontend tests**
 
Run:
 
```bash
pnpm -C frontend test
pnpm -C frontend lint
pnpm -C frontend typecheck
```
 
Expected: PASS.
 
**Step 7: Commit**
 
```bash
git add frontend/src/components/waitlist/steps/DoneStep.tsx frontend/src/components/waitlist/preprovisionStatus.ts frontend/src/components/waitlist/preprovisionStatus.test.ts
git commit -m "fix(waitlist): hide preprovision status on unauthenticated responses"
```
 
---
 
## Task 3: Paymaster Proxy Allows Deploy-Session Self-Call Only Setup
 
**Files:**
- Modify: `frontend/api/_handlers/_paymaster.ts`
- Test: `frontend/api/__tests__/paymasterDeploySessionSetup.test.ts`
 
**Step 1: Write a failing test that expects self-call-only to be allowed**
 
Create `frontend/api/__tests__/paymasterDeploySessionSetup.test.ts`:
 
```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { encodeFunctionData, getAddress } from 'viem'
import handler from '../_handlers/_paymaster'
import { createMockReq, createMockRes } from './helpers'

const { readRequestPrincipalAddressMock, getActiveDeploySessionForSenderMock, getApiContractsMock } = vi.hoisted(() => ({
  readRequestPrincipalAddressMock: vi.fn(),
  getActiveDeploySessionForSenderMock: vi.fn(),
  getApiContractsMock: vi.fn(),
}))

// Prevent real RPC usage inside the paymaster handler (it uses a Base public client).
vi.mock('viem', async (importOriginal) => {
  const actual = await importOriginal<typeof import('viem')>()
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getBytecode: vi.fn(async () => '0x1234'),
      readContract: vi.fn(async () => true),
      getLogs: vi.fn(async () => []),
    })),
    http: vi.fn(() => ({} as any)),
  }
})

vi.mock('../../server/_lib/requestPrincipal.js', () => ({
  readRequestPrincipalAddress: readRequestPrincipalAddressMock,
}))

vi.mock('../../server/_lib/deploySessions.js', () => ({
  getActiveDeploySessionForSender: getActiveDeploySessionForSenderMock,
  getDeploySessionByTokenHash: vi.fn(),
  hashDeployToken: vi.fn(),
  signDeployToken: vi.fn(),
}))

vi.mock('../../server/_lib/contracts.js', () => ({
  getApiContracts: getApiContractsMock,
}))

// Keep auth shared small
vi.mock('../../server/auth/_shared.js', () => ({
  handleOptions: vi.fn(() => false),
  readJsonBody: vi.fn(async (req: any) => req.body),
  setCors: vi.fn(),
  setNoStore: vi.fn(),
}))

describe('paymaster deploy-session setup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CDP_PAYMASTER_URL = 'https://example.invalid'
    readRequestPrincipalAddressMock.mockReturnValue('0x00000000000000000000000000000000000000aa')
    getActiveDeploySessionForSenderMock.mockResolvedValue({
      sessionOwner: '0x00000000000000000000000000000000000000bb',
    })
    getApiContractsMock.mockReturnValue({
      creatorVaultBatcher: '0x0000000000000000000000000000000000000010',
      vaultActivationBatcher: '0x0000000000000000000000000000000000000011',
      permit2: '0x0000000000000000000000000000000000000012',
      universalCreate2DeployerFromStore: '0x0000000000000000000000000000000000000013',
      universalBytecodeStore: '0x0000000000000000000000000000000000000014',
    })
  })

  it('accepts a self-call only addOwnerAddress UserOp for an active deploy session', async () => {
    // We intentionally do NOT validate upstream; just ensure we pass local validation.
    vi.stubGlobal('fetch', vi.fn(async () => ({ status: 200, ok: true, text: async () => JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }) })) as any)

    const sender = getAddress('0x0000000000000000000000000000000000000002')
    const sessionOwner = getAddress('0x00000000000000000000000000000000000000bb')

    const addOwnerData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'addOwnerAddress',
          stateMutability: 'nonpayable',
          inputs: [{ name: 'owner', type: 'address' }],
          outputs: [],
        },
      ] as const,
      functionName: 'addOwnerAddress',
      args: [sessionOwner],
    })
    const callData = encodeFunctionData({
      abi: [
        {
          type: 'function',
          name: 'execute',
          stateMutability: 'nonpayable',
          inputs: [
            { name: 'target', type: 'address' },
            { name: 'value', type: 'uint256' },
            { name: 'data', type: 'bytes' },
          ],
          outputs: [],
        },
      ] as const,
      functionName: 'execute',
      args: [sender, 0n, addOwnerData],
    })

    const userOp = { sender, callData, initCode: '0x' }
    const req = createMockReq({
      method: 'POST',
      body: { jsonrpc: '2.0', id: 1, method: 'pm_getPaymasterStubData', params: [userOp, '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789', 8453] },
    })
    const res = createMockRes()
    await handler(req as any, res as any)

    expect(res.statusCode).toBe(200)
    // If local validation rejects, it returns jsonrpc error with "request denied".
    const msg = String((res.body as any)?.error?.message ?? '')
    expect(msg.toLowerCase()).not.toContain('request denied')
  })
})
```
 
**Step 2: Run the test to verify it fails**
 
Run:
 
```bash
pnpm -C frontend test -- api/__tests__/paymasterDeploySessionSetup.test.ts
```
 
Expected: FAIL with `missing_primary_call(...)` (current behavior).
 
**Step 3: Update `_paymaster.ts` validation to allow deploy-session setup-only**
 
In `frontend/api/_handlers/_paymaster.ts`, inside `validateInnerCalls(...)`:
 
- After decoding `innerCalls` and validating `value===0`, detect `selfCallOnly`:
  - Every inner call target is `params.sender`
  - Every selector is in `ALLOWED_SELF_SELECTORS`
- If `selfCallOnly`, validate each self-call matches the active deploy session (same logic as existing self-call validation), and then return early:
  - `return { expectedCreatorToken: null, mode: 'deploy_session_setup' }`
 
**Step 4: Re-run the test**
 
Run:
 
```bash
pnpm -C frontend test -- api/__tests__/paymasterDeploySessionSetup.test.ts
```
 
Expected: PASS.
 
**Step 5: Run full frontend tests**
 
Run:
 
```bash
pnpm -C frontend test
```
 
Expected: PASS.
 
**Step 6: Commit**
 
```bash
git add frontend/api/_handlers/_paymaster.ts frontend/api/__tests__/paymasterDeploySessionSetup.test.ts
git commit -m "feat(paymaster): sponsor deploy-session setup selfcalls"
```
 
---
 
## Task 4: Install Deploy-Session Signer via Sponsored ERC-4337 (Privy-Only When Possible)
 
**Files:**
- Modify: `frontend/src/pages/DeployVault.tsx`
 
**Step 1: Add a failing guard test (optional, minimal)**
 
If adding UI tests is too heavy without a React test harness, skip this and rely on manual test plan in Task 5. If you do add a unit test, keep it pure (extract a helper).
 
**Step 2: Implement ERC-4337 install path inside `ensureDeploySessionSignerInstalled`**
 
In `frontend/src/pages/DeployVault.tsx`, update `ensureDeploySessionSignerInstalled(sessionSigner)`:
 
- Keep the initial `isCoinbaseSmartWalletOwner` short-circuit.
- Before requiring `connectedAddress`, attempt ERC-4337 install when:
  - `publicClient` exists
  - canonical `owner` exists
  - one of these signer paths is available:
    - `privyEmbeddedEoaIsCanonicalOwner && privyEmbeddedEoaCanSign && privyEmbeddedEoaAddress`
    - `privySmartWalletIsCanonicalOwner && privySmartWalletCanSign && smartWalletClient && privySmartWalletAddress`
- Use `sendCoinbaseSmartWalletUserOperation` with a single call:
  - `to: owner` (canonical CSW)
  - `data: addOwnerAddress(sessionSigner)`
  - `value: 0n`
- Call `ensurePaymasterSession()` before sending to reduce `not authenticated` failures.
- Set `txId` from the returned `transactionHash` so the UI can show something while server-continue runs.
- After the UserOp, re-check `isCoinbaseSmartWalletOwner` and throw `session_owner_not_installed` if still false.
- Only if both Privy ERC-4337 paths are unavailable (or they fail), fall back to the current external owner wallet transaction flow.
 
**Step 3: Run frontend tests**
 
Run:
 
```bash
pnpm -C frontend test
pnpm -C frontend lint
pnpm -C frontend typecheck
```
 
Expected: PASS.
 
**Step 4: Commit**
 
```bash
git add frontend/src/pages/DeployVault.tsx
git commit -m "fix(deploy): install deploy-session signer via ERC-4337 when available"
```
 
---
 
## Task 5: Manual End-to-End Smoke Test (Waitlist -> Enter App -> Deploy)
 
**Files:** none
 
**Step 1: Run dev server**
 
```bash
pnpm -C frontend dev
```
 
Expected: Vite dev server starts.
 
**Step 2: Waitlist Done step behaviors**
 
- As a non-signed-in user: confirm Done step does NOT show the preprovision card error state (card should be hidden).
- Confirm the CTA area does not stay in "Checking access..." forever. It should settle into:
  - "Enter App" when allowlist passes, or
  - Waitlisted CTA when not approved.
 
**Step 3: Deploy (Privy-only path)**
 
- Use an account where the Privy embedded EOA is already an onchain owner of the canonical CSW.
- Click Deploy:
  - Expect a single signature prompt for the setup (install deploy-session signer).
  - After that, the server continuation should proceed without additional user prompts.
 
**Step 4: Deploy (existing creator fallback)**
 
- Use an account where Privy signers are NOT owners of the canonical CSW.
- Confirm UI guides to connect an owner EOA (Coinbase Wallet) for the one-time add-owner transaction.
 
---
 
## Rollout Notes
 
- This change intentionally narrows sponsorship risk: deploy-session setup UserOps are only sponsorable if they match an active deploy session owner (`getActiveDeploySessionForSender`) and only for `addOwnerAddress/removeOwnerAtIndex`.
- If sponsorship fails in production, capture the paymaster debug context by setting `VITE_PAYMASTER_DEBUG=true` and sending `X-CV-Paymaster-Debug: 1`.
 
