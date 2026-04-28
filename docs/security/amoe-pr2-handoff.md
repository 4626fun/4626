# AMOE PR 2 — Variable points + relayer-only submit (server + frontend)

Companion to [`amoe-pr1-handoff.md`](./amoe-pr1-handoff.md).
PR 1 (#395) extended `CreatorLotteryManager` with a relayer-gated
`processAmoeEntry(buyer, creatorCoin, pointsBurnedAsUSD)` and linearized
`calculateWinChance` against `baseCeilingPPM` (default 40_000 PPM = 4%).
PR 2 ships the off-chain integration: a variable points-burn submission flow
on the server and a slider/numeric-input UI in `AmoeEntryCard`.

This document is the auditor handoff for the off-chain half. It does **not**
introduce new on-chain code; the audited contract surface is unchanged.

---

## 1. Locked spec (Option B2, carried from PR 1)

| Action | $ value | PPM (pre-boost) | % win chance |
| --- | --- | --- | --- |
| Min  paid swap / AMOE floor | $1     | 4      | 0.0004% |
| —   | $10    | 40     | 0.004%  |
| —   | $100   | 400    | 0.04%   |
| —   | $1,000 | 4,000  | 0.4%    |
| Base ceiling | $10,000 | 40,000 | 4%      |
| Absolute cap (with boosts) | — | 150,000 | 15% |

- AMOE submission range: **min 100 points / max 1_000_000 points** per submission.
- Conversion: **100 points = $1 USD-equivalent** (1 point = $0.01 = 1 cent).
- On-chain `processAmoeEntry` expects USD in **1e6 (USDC)** units, so
  `pointsBurnedAsUSD = points * 10_000`.

---

## 2. Files modified

### Server
- `frontend/server/_lib/lottery/lotteryAmoe.ts`
  - New constants: `AMOE_MIN_POINTS_PER_SUBMISSION = 100`,
    `AMOE_MAX_POINTS_PER_SUBMISSION = 1_000_000`,
    `AMOE_POINTS_TO_USD1E6_FACTOR = 10_000`.
  - New `pointsToUsd1e6(points)` validator + converter.
  - New `estimateWinChancePPM(usd1e6)` mirror of the on-chain formula
    (display only; the on-chain value is authoritative).
  - New `creatorLotteryManagerAmoeAbi` (single-function ABI for
    `processAmoeEntry`).
  - New `buildProcessAmoeEntryCall(...)` that produces `{ to, callData,
    pointsBurned, pointsBurnedAsUSD, estimatedWinChancePPM }`.
  - Legacy `createAmoeAttestation` / `submitAmoeEntry` / `getAmoeMessageHash`
    kept exported for backward compat with the untouched
    `LotteryAmoeRouter` path. They are NOT used by the new submit flow.

- `frontend/api/_handlers/v1/lottery/_amoeSubmit.ts`
  - Accepts `pointsBurned` in the request body. Validates as integer in
    `[100, 1_000_000]` before any DB / signature work; returns a clean 400
    on failure.
  - Replaced `createAmoeAttestation(...)` with `buildProcessAmoeEntryCall(...)`.
  - **Dropped the client-relay path entirely.** All successful submits now
    go through the server-side relay key. The `relay` body field is no
    longer read; the per-relay branch (`relayRequested`) was removed.
  - Passes `requiredCredits: pointsBurned` (variable) to
    `consumeAmoeCreditsForEntry` instead of the fixed
    `AMOE_CREDITS_PER_ENTRY = 100`.
  - Order preserved (audit fix from prior PR): **relay first, debit second**.
  - Response shape adds `pointsBurned`, `pointsBurnedAsUSD` (decimal string,
    bigint-safe), and `estimatedWinChancePPM`.

### Frontend
- `frontend/src/components/lottery/AmoeEntryCard.tsx`
  - Slider (min 100, max `min(balance, 1_000_000)`, step 1) + numeric input
    bound to a single `pointsBurned` state — editing either updates both.
  - Live "Win chance: 0.0X%" preview computed client-side via the same
    formula the server uses (mirror of on-chain).
  - "Enter for free (X credits)" button label now reflects the user's
    selected amount, not a fixed 100.
  - Dropped the client-relay fallback (`submitRequest(false)` and the
    `walletClient.sendTransaction` branch). Submits send `pointsBurned`
    and trust the server to relay.
  - Auto-clamps the selection if the live balance shrinks below the
    previously selected amount.

### Tests
- `frontend/server/_lib/__tests__/amoeVariablePoints.test.ts` — 19 unit
  tests for `pointsToUsd1e6` + `estimateWinChancePPM` boundary table.
- `frontend/api/__tests__/lotteryAmoeHandlers.test.ts` — submit handler
  tests rewritten for the variable-points / server-relay-only flow,
  including `pointsBurned` validation (missing, < 100, > 1M) and
  variable-credit pass-through to `consumeAmoeCreditsForEntry`. Default
  durable rate-limit mock added so legacy nonce / credits / twitter
  check-in tests continue to pass under the new mock topology.
- `frontend/api/__tests__/lotteryAmoeRelayKeyScope.test.ts` — A1/A2/A3/A4
  regression suites updated to mock `buildProcessAmoeEntryCall` and stub
  viem on the success paths. The A4 key-isolation invariant (no fall-through
  to `KEEPR_PRIVATE_KEY` / `PRIVATE_KEY` / `CRE_ERC4337_OWNER_PRIVATE_KEY`)
  is preserved bit-for-bit.

---

## 3. Trust model (off-chain, PR 2)

PR 1 deliberately ships `processAmoeEntry` with NO on-chain signature
verification — only a single-address relayer allowlist. PR 2 takes the
off-chain consequences of that decision seriously:

| Field | Source of truth | Trust assumption |
| --- | --- | --- |
| `buyer` (wallet) | User-signed off-chain message, verified server-side via `verifyAmoeEntryProof` | Cryptographic |
| `creatorCoin` | User-signed message + matched against `lotteryConfig` server-side | Cryptographic |
| `pointsBurnedAsUSD` | Server multiplies user-supplied `pointsBurned` by `AMOE_POINTS_TO_USD1E6_FACTOR` | **Relayer key trusted** |
| Eligibility (no `has_creator_coin`, no referral_*) | PR 0 server-side view | **Relayer key trusted** |
| Anti-replay | `(creatorCoin, nonce)` is the credit-spend `refId`; PR 1 PG unique constraint dedupes retries | Cryptographic + DB |

### Defense-in-depth on the contract
- `processAmoeEntry` enforces `pointsBurnedAsUSD >= minSwapAmount` ($1)
  on-chain. A buggy or compromised relayer cannot mint sub-floor entries.
- `winChancePPM` is capped at `baseCeilingPPM` (40_000 = 4%) inside
  `calculateWinChance`. Even if the relayer sends $10M, the entry caps at
  4% pre-boost.
- `_applyBoost` caps post-boost at the absolute 15% cap. The worst-case
  AMOE entry is the same as the worst-case paid entry.

### Failure modes (relayer key compromise)
1. Attacker can mint AMOE entries up to 4% pre-boost (15% with full boost
   stack) for any wallet they control.
2. Attacker cannot exceed the absolute 15% cap.
3. Attacker cannot impersonate a wallet that hasn't signed an AMOE message
   (the server still requires a valid `verifyAmoeEntryProof` before
   relaying).
4. **Kill-switch:** owner calls `setAuthorizedAmoeRelayer(address(0))` and
   AMOE is disabled atomically. No code change required.

### Why no on-chain sig verification (recap from PR 1)
- EIP-170 size budget for `CreatorLotteryManager` is exhausted (PR 1
  shipped at 24,367 / 24,576 bytes after the `_boostAndDispatchVRF`
  extraction). Adding `verifyAmoeEntryProof` on-chain would push it over.
- PR 4 will move points→USD into a zkMetal Groth16 public input,
  eliminating relayer trust entirely. PR 2 is the bridge.

---

## 4. Backwards compatibility

- `LotteryAmoeRouter.sol` is **untouched** in PR 1 and PR 2. It will be
  retired in PR 4 (zkMetal binding).
- The exported helpers `createAmoeAttestation`, `getAmoeMessageHash`, and
  the `LotteryAmoeRouter.submitAmoeEntry` ABI are preserved in
  `lotteryAmoe.ts` and marked legacy in code comments. They are NOT called
  by `_amoeSubmit.ts` anymore. Any downstream tooling that relies on the
  old payload shape continues to work, but new integrations should target
  `buildProcessAmoeEntryCall`.

---

## 5. Production rollout checklist

Pre-mainnet (still required, copied from PR 1 + new):

- [ ] Sweepstakes counsel sign-off on boost-parity defense, FL/NY/RI
      registration for >$5K prize pools, Official Rules page.
- [ ] Owner sets `setBaseCeilingPPM(40_000)` post-deploy (`maxWinChance`
      stays at 150_000).
- [ ] Owner sets `setAuthorizedAmoeRelayer(<scoped-key-address>)` only
      after counsel sign-off; until then the AMOE path is disabled.
- [ ] `LOTTERY_AMOE_RELAY_PRIVATE_KEY` provisioned to its own scoped
      KMS-backed env (NOT shared with `KEEPR_PRIVATE_KEY` / `PRIVATE_KEY`
      — see `amoe-relay-key-scope.md` for the A4 invariant).
- [ ] Frontend feature flag for the slider can be left on by default; the
      server enforces the 100 / 1M bounds regardless.

---

## 6. Test results

- `pnpm vitest run server/_lib/__tests__/amoeVariablePoints.test.ts api/__tests__/lotteryAmoeHandlers.test.ts api/__tests__/lotteryAmoeRelayKeyScope.test.ts`
  → **48 / 48 pass** (19 + 21 + 8). +1 test from P1-B regression
  (`rejects under-collateralized entries before relaying`).
- `forge test --match-contract AmoeLinearParity` → **29 / 29 pass**
  (27 original + 2 new boost-parity tests from P1-A regression).
- `pnpm typecheck` → clean.
- Full `pnpm test` → **3179 / 3179 tests pass**, **470 / 471 suites pass**.
  The single failing suite (`WaitlistFlow.wallet-ui.test.tsx`) is a
  pre-existing test-env config issue (`Missing builder code config`)
  reproducible on the parent branch `feat/amoe-linear-parity-contracts`
  before any PR 2 changes. Unrelated to AMOE.

---

## 6a. P1 review fixes (post-PR-open)

Two P1 findings from maintainer review were addressed in-flight before
merge. Both are additive only — no behavior change for happy-path
users, both close real exploitation surfaces.

### P1-A — contract: AMOE personal-boost parity (`processAmoeEntry`)

**Finding.** `processAmoeEntry` called `_boostAndDispatchVRF` with
`creatorShareBalanceUSD` hardcoded to `0`. In `_applyBoost`, both the
ve4626 personal multiplier branch (line 912) and the lock-duration
additive branch (line 922) are gated on `coverageBps > 0`, and
`ve4626BoostManager.getCoverageBps` returns `0` whenever its
`creatorShareBalanceUSD` input is `0`. Net effect: AMOE entrants
received a strictly worse boost than paid entrants at equal notional
even when they actually held the creator's coins. Vault gauge boost
was unaffected (independent path).

**Fix.** Mirror the paid path. Read
`IERC20(creatorCoin).balanceOf(buyer)` and convert via the per-creator
oracle with `_calculateTokenUSD(creatorCoin, creatorCoin, balance)`,
then pass the resulting USD (1e6 units) to `_boostAndDispatchVRF`.
This matches `processSwapLottery`'s call shape (line 554) which reads
the buyer's OFT balance and converts via the same helper.

**Failure-mode symmetry.** `_calculateTokenUSD` is *not* wrapped in a
try/catch. If the per-creator oracle reverts on the AMOE path, it
would also revert on the paid path — no new failure surface. Saves
bytecode (96 bytes spare on a 24,480 / 24,576 contract).

**Regression coverage.** Two new tests in
`test/CreatorLotteryManager.AmoeLinearParity.t.sol`:
- `test_BoostParity_PersonalBoost_AppliesEqually_BothPaths` — buyer
  holds 1 share ($1), $10 swap on both AMOE and paid paths, asserts
  effective PPM is identical. Test sets `usdMultiplierBps = 10_000`
  to neutralize the 1.05x slippage bonus (which paid path applies to
  swap value but AMOE does not — see note below).
- `test_BoostParity_PersonalBoost_ZeroBalance_NoPersonalBoost` —
  balance=0 → effective PPM = base 40, locks in the "no shares = no
  personal boost" semantic so the change is provably additive only.

`MockBoostManagerAmoe` was updated to use the real coverage formula
(`min(creatorShareBalanceUSD, swapAmountUSD) / swapAmountUSD`) so the
test exercises the actual gating end-to-end. A `setForcedCoverageBps`
escape hatch is preserved for tests that need fixed coverage. A
`balanceOf(buyer) → 0` `vm.mockCall` was added in `setUp()` so existing
AMOE tests retain their pre-fix boost shape (no shares held).

**Slippage-bonus note.** `usdMultiplierBps` (default 1.05x) is applied
to every `_calculateTokenUSD` output, including the paid path's
`swapValueUSD`. The AMOE path passes `pointsBurnedAsUSD` through
unscaled (slippage isn't a thing for AMOE). The two paths therefore
cannot produce *identical* PPMs at equal notional when the multiplier
is above 1.00x — paid PPM stays slightly higher because its swap
value is also scaled up. This is intentional: AMOE entrants do not
pay slippage, so they shouldn't get the slippage bonus. The new
parity test isolates the boost-gating fix by setting the multiplier
to 1.00x; the slippage-bonus semantic itself is exercised by
existing `processSwapLottery` tests.

### P1-B — handler: pre-flight credits check (`_amoeSubmit.ts`)

**Finding.** The submit handler relayed `processAmoeEntry` on-chain
*before* checking whether the wallet held `pointsBurned` credits. A
client could sign a nonce with an inflated `pointsBurned` (up to
1,000,000 → 4,000 PPM, the on-chain ceiling), get the high-value
entry mined, and only then fail the atomic credit debit with a 402.
Net exploit: free high-value AMOE entries bounded by the on-chain
ceiling.

**Fix.** Insert a `getAmoeCreditSnapshot` pre-flight check after
wallet-authority resolution and *before* `buildProcessAmoeEntryCall`
and `relayAmoeEntryTransaction`. Throws `'insufficient_amoe_credits'`
(→ 402 via the error classifier) if `snapshot.credits < pointsBurned`.

**Defense-in-depth retained.** The post-relay
`consumeAmoeCreditsForEntry` atomic debit stays in place as the
race-safe source-of-truth gate. This preserves the prior audit fix
that prevented credit-burn on contract reverts (e.g.
`DeadlineTooSoon`): the debit is conditional on the entry actually
landing. The pre-flight is the anti-inflation gate; the post-flight
debit is the consistency gate.

**Why pre-flight before `buildProcessAmoeEntryCall` (not just before
relay).** Failing earlier saves an oracle / EIP-712 build call on the
bad path, and lets the regression test assert
`buildProcessAmoeEntryCallMock` was *not* invoked.

**Regression coverage.** New test
`'rejects under-collateralized entries before relaying (P1 review fix)'`
in `frontend/api/__tests__/lotteryAmoeHandlers.test.ts`: sets
credits=100, requests 1,000,000, asserts 402 +
`buildProcessAmoeEntryCallMock` and `consumeAmoeCreditsForEntryMock`
NOT called. The relay-key-scope test file was updated with a default
high-balance snapshot mock so its scoping assertions still exercise
the relay path.

---

## 7. Out of scope (deferred to PR 3 / PR 4)

- **PR 3:** ve4626 + vault-gauge boost parity for AMOE in the on-chain
  `_applyBoost` call site (Option B2 final piece). PR 1 wired
  `_boostAndDispatchVRF` to call `_applyBoost` for both paid and AMOE
  paths, so the surface is ready; PR 3 ships the boost-source allowlist
  changes.
- **PR 4:** zkMetal binding — replace the off-chain
  `pointsBurned → pointsBurnedAsUSD` conversion with a Groth16 public
  input, removing relayer-key trust entirely.

