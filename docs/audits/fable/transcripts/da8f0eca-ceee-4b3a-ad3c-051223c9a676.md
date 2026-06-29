---
title: Analysis subagent
sidebar_label: da8f0eca…
sidebar_position: 99
hide_table_of_contents: true
last_updated: '2026-06-28'
audience:
  - developers
  - protocols
stage: use
owner: docs-team
last_reviewed: '2026-06-28'
status: current
---
<div class="audit-transcript-meta">
[← Source sessions](/audits/fable/key-sessions) · [Transcript archive](/audits/fable/transcripts) · [Executive summary](/audits/fable/findings-summary)
</div>
# Analysis subagent
| Field | Value |
| --- | --- |
| Session ID | `da8f0eca-ceee-4b3a-ad3c-051223c9a676` |
| Parent session | `059adbec-9820-45a8-9c18-399e4a7f9870` |
| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |
:::note Appendix record
Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## User

In the repo /home/akitav2/projects/4626, verify two frontend audit findings:

H-2 (DeployVault): In frontend/src/pages/deploy/DeployVault.tsx, find the submit() function (~line 4544) and the primary "1-Click Deploy" button (~line 8314). Report: (a) the exact guard condition in submit() (which busy flags it checks), (b) the deploy button's disabled prop expression, (c) where dryRunBusy state is declared and set, (d) line numbers for all three. Also check whether there are existing RTL/component tests for DeployVault (search for DeployVault test files).

H-3 (Swap auto-quote): In frontend/src/pages/Swap.tsx (~lines 903-913) find the debounced auto-quote effect and report its exact skip conditions. In frontend/src/hooks/useSwapExecution.ts (~lines 1737-1740) find quoteRunRef usage, handleReviewTrade, handleQuote, and the busy state values ('review', 'quote', 'executeSwap'). Report: (a) what conditions currently pause the auto-quote, (b) how quoteRunRef epoch-bumping causes review to bail (quote the runId check), (c) whether handleReviewTrade guards on busy, (d) what txState values exist. Also find existing tests for useSwapExecution (search for useSwapExecution.test or swap hook tests) and report how they set up the hook.

Be precise with file:line citations for everything.

## Assistant

Searching DeployVault and Swap code paths and related tests for precise line citations.

[REDACTED]

*Tools invoked:* UpdateCurrentStep, Grep, Grep, Grep, Read, Grep, Glob

## Assistant

[REDACTED]

*Tools invoked:* Grep, Read, Grep, Read, Read, Read, Read, Read

## Assistant

[REDACTED]

*Tools invoked:* Read, Read, Read, Grep, Grep, Glob

## Assistant

[REDACTED]

*Tools invoked:* Grep, Read, Grep, Grep

## Assistant

[REDACTED]

*Tools invoked:* Read, Grep, Read, Read, Grep

## Assistant

[REDACTED]

*Tools invoked:* Glob, Grep, Read

## Assistant

[REDACTED]

*Tools invoked:* Read, Grep, Grep

## Assistant

[REDACTED]

*Tools invoked:* UpdateCurrentStep

## Assistant

## H-2 — DeployVault (`DeployVault.tsx`)

### (a) `submit()` guard condition — line **4558**

```4555:4558:frontend/src/pages/deploy/DeployVault.tsx
  const submit = async (opts?: { planOnly?: boolean; validateDepositBalance?: boolean }): Promise<DeployPlanExport | null> => {
    const planOnly = opts?.planOnly === true
    const validateDepositBalance = !planOnly || opts?.validateDepositBalance === true
    if (busy || exportBusy) return null
```

**Checked:** `busy`, `exportBusy` only.  
**Not checked:** `dryRunBusy`.

(`planOnly` dry-run calls `submit({ planOnly: true })` at **7268** and does **not** set `busy` — see **4579–4580**.)

---

### (b) Primary “1-Click Deploy” button — lines **8347–8354**

```8347:8354:frontend/src/pages/deploy/DeployVault.tsx
          <Button
            type="button"
            variant="primary"
            className="w-full rounded-lg"
            onClick={() => void submit()}
            disabled={disabled || exportBusy}
          >
            {busy ? 'Deploying…' : '1‑Click Deploy (Gas-Free)'}
```

**Disabled expression:** `disabled || exportBusy`

`disabled` comes from `disabledReason` (**7307–7327**), which includes `busy` but **not** `dryRunBusy`:

```7307:7327:frontend/src/pages/deploy/DeployVault.tsx
  const disabledReason =
    busy
      ? 'Deployment in progress…'
      : rolePolicyOverride.error
        ? rolePolicyOverride.error
      : batcherInfraQueryLoading
        ? 'Reading deployment batcher infrastructure…'
      : batcherInfraError
        ? batcherInfraError
      : vanityPlanQueryLoading
        ? buildDeployVanityLoadingMessage({
            vaultVanityPrefix: vaultVanityPrefix ?? null,
            shareOftVanitySuffix: shareOftVanitySuffix ?? null,
          })
      : expectedAddressesQueryLoading
        ? 'Computing deployment addresses…'
        : !expected
          ? expectedError || 'Deployment addresses are not ready.'
          : null

  const disabled = Boolean(disabledReason)
```

**Contrast — dry-run / export buttons (lines 8141, 8150)** use  
`disabled={busy || exportBusy || dryRunBusy || expectedQueryLoading || !expected}`.

**Contrast — `exportPlan` / `runDryRun` entry guards (7234, 7262):**  
`if (busy || exportBusy || dryRunBusy) return`

---

### (c) `dryRunBusy` — declaration and setters

| Location | Code |
|----------|------|
| **2580** (declare) | `const [dryRunBusy, setDryRunBusy] = useState(false)` |
| **7263** (set true) | `setDryRunBusy(true)` in `runDryRun` |
| **7284** (set false) | `setDryRunBusy(false)` in `runDryRun` `finally` |

```7261:7284:frontend/src/pages/deploy/DeployVault.tsx
  const runDryRun = async () => {
    if (busy || exportBusy || dryRunBusy) return
    setDryRunBusy(true)
    ...
    } finally {
      setDryRunBusy(false)
```

---

### DeployVault tests

**No RTL/component tests** for `DeployVault.tsx` (no `@testing-library/react` render of the page).

Related tests:

| File | What it tests |
|------|----------------|
| `/home/akitav2/projects/4626/frontend/src/pages/deploy/DeployVaultDryRun.test.ts` | Source-string wiring (routes, env, dry-run copy) via `fs.readFileSync` on `DeployVault.tsx` |
| `deployVaultVanity.test.ts`, `deployVaultVanityPersistence.test.ts`, `deployVaultSignals.test.ts` | Helper/signal modules, not the page component |
| `deployVaultGreenfieldProbe.test.ts` | Greenfield probe lib |

---

## H-3 — Swap auto-quote (`Swap.tsx` + `useSwapExecution.ts`)

### (a) Auto-quote skip conditions — `Swap.tsx` **893–928**

**Effect early returns (before timer):**

```903:909:frontend/src/pages/Swap.tsx
  useEffect(() => {
    ...
    if (!executionAddress || !quoteReady || quoteCooldownActive) return
    if (txState === 'signing') return
    if (tokenInAmountExceedsBalance) return
```

**Inside 450ms timer callback:**

```910:913:frontend/src/pages/Swap.tsx
    const timer = window.setTimeout(() => {
      if (busyRef.current === 'executeSwap') return
      void handleQuote()
    }, 450)
```

**`busyRef` sync (897–898):** `busyRef.current = busy` — `busy` is intentionally **not** in the effect deps (893–896 comment).

**What pauses auto-quote today:**
- Missing `executionAddress` or `quoteReady`
- `quoteCooldownActive`
- `txState === 'signing'`
- `tokenInAmountExceedsBalance`
- At fire time only: `busy === 'executeSwap'`

**What does *not* pause auto-quote:**
- `busy === 'quote' | 'review' | 'approval' | 'buildSwap' | …`
- `txState === 'pending' | 'review' | 'idle' | …` (except signing)

Effect re-fires when inputs change: **916–927** (`tokenIn`, `tokenOut`, `amountInUnits`, slippage, `executionAddress`, `quoteReady`, `quoteCooldownActive`, `tokenInAmountExceedsBalance`, `txState`, `handleQuote`).

---

### (b) `quoteRunRef` epoch-bumping and review bail

**Declaration — line 803:**

```803:803:frontend/src/hooks/useSwapExecution.ts
  const quoteRunRef = useRef(0)
```

**Bump on reset — line 1469:**

```1468:1469:frontend/src/hooks/useSwapExecution.ts
  const resetTradeState = useCallback(() => {
    quoteRunRef.current += 1
```

**`handleQuote` — capture + bail pattern (1520–1563):**

```1520:1521:frontend/src/hooks/useSwapExecution.ts
    const runId = ++quoteRunRef.current
    setBusy('quote')
```

Stale-run checks at **1528, 1532, 1550, 1557**; `finally` clears busy only if still current (**1563**):

```1562:1563:frontend/src/hooks/useSwapExecution.ts
    } finally {
      if (runId === quoteRunRef.current) setBusy(null)
```

**`handleReviewTrade` — same pattern (1759+):**

```1759:1760:frontend/src/hooks/useSwapExecution.ts
    const runId = ++quoteRunRef.current
    setBusy('review')
```

Bail checks at **1769, 1797, 1819, 1833, 1852, 1862, 1880, 1889**; `finally` at **1893**.

**How review bails:** Any later `++quoteRunRef.current` (from `handleQuote`, `handleReviewTrade`, or `resetTradeState`) makes `runId !== quoteRunRef.current`, so review exits early at the next guard without updating state. A concurrent auto-quote `handleQuote()` therefore invalidates an in-flight review.

---

### (c) Does `handleReviewTrade` guard on `busy`?

**Partially — lines 1737–1739:**

```1737:1739:frontend/src/hooks/useSwapExecution.ts
    if (busy === 'executeSwap' || txState === 'signing' || txState === 'pending') {
      setStatus('Swap already in progress. Wait for the current transaction to finish.')
      return
```

**Does not block** when `busy === 'quote' | 'review' | 'approval' | 'buildSwap' | 'executeApproval' | 'executeOrder'`.

---

### (d) `txState` values

**Type definition — line 99:**

```99:99:frontend/src/hooks/useSwapExecution.ts
type TxLifecycleState = 'idle' | 'review' | 'signing' | 'pending' | 'success' | 'error'
```

**Initial state — line 763:** `useState<TxLifecycleState>('idle')`

---

### `busy` string values set in the hook

| Value | Line(s) |
|-------|---------|
| `'quote'` | 1521 |
| `'approval'` | 1612 |
| `'buildSwap'` | 1681 |
| `'review'` | 1760 |
| `'executeApproval'` | 2063 |
| `'executeSwap'` | 2137 |
| `'executeOrder'` | 2801 |

Type: `useState<string | null>(null)` at **753**.

---

### `useSwapExecution` tests

**File:** `/home/akitav2/projects/4626/frontend/src/hooks/useSwapExecution.test.ts`

**No hook mounting** — no `renderHook`, no `useSwapExecution()` calls. Tests import **exported pure helpers** only:

```3:12:frontend/src/hooks/useSwapExecution.test.ts
import {
  assertSwapSpendBalancePreflight,
  deriveSwapExecutionReadiness,
  evaluateCanonicalSubmitSession,
  evaluateSwapSessionGate,
  resolveCanonicalSubmitSession,
  shouldDisablePermit2ForSwap,
  shouldSimulateSwapBuild,
  shouldSimulateSwapTransaction,
} from './useSwapExecution'
```

**Describe blocks:** `evaluateSwapSessionGate`, `evaluateCanonicalSubmitSession`, `resolveCanonicalSubmitSession`, `CDP canonical mode policy helpers`, `deriveSwapExecutionReadiness`, `shouldDisablePermit2ForSwap`, `shouldSimulateSwapTransaction`, `shouldSimulateSwapBuild`, `assertSwapSpendBalancePreflight`.

**Setup pattern:** direct function calls with inline mock objects (e.g. `assertSwapSpendBalancePreflight` passes `{ publicClient: { getBalance: async () => … } }` at **409–419**).

**Related, not hook tests:** `swapTokenDecimals.test.ts` imports `assertSwapSpendBalancePreflight`; `useSwapState.test.ts` tests swap state helpers. **No `Swap.tsx` component tests** found for the auto-quote effect.

---

### Audit finding alignment (summary)

| Finding | Verified? |
|---------|-----------|
| **H-2:** `submit()` omits `dryRunBusy`; 1-Click button omits `dryRunBusy` while dry-run/export paths include it | **Yes** |
| **H-3:** Auto-quote does not pause on `review`/`quote` busy; shared `quoteRunRef` can abort review; `handleReviewTrade` only guards `executeSwap`/signing/pending | **Yes** |

[REDACTED]

