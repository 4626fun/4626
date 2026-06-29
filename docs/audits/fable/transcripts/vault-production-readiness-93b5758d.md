---
title: Vault production readiness
sidebar_label: 93b5758d…
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
# Vault production readiness
| Field | Value |
| --- | --- |
| Session ID | `93b5758d-201f-4f3a-976a-c6613d50dd6b` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 5:53 AM (UTC-7)</timestamp>
do you believe that we are truly, fully ready to deploy a vault into produciton

## Analysis

This is exactly the right question to ask before going live, so let me ground my answer in the actual current state of the repo rather than vibes — the audit docs, the open todo list, and the dry-run that's running right now.

 I need to assess whether the vault is actually ready for production deployment in the 4626 repo. Let me look at the evidence: recent audits, readiness checkpoints, and any blockers documented in the codebase. I know from the notes that there was a successful x-ray contract audit in June 2026, but there's also a critical issue with the Pipe-A batcher cutover being blocked by an EIP-3860 problem where the initcode size exceeds the allowed limit.

I'm seeing some conflicting signals in the documentation—the notes mention the batcher is live but also blocked, which suggests either the shell landed through a different deployment method or the documentation hasn't been fully updated. There are also pending items like the Stripe E2E test, x402 in-dapp signing helper, and automated Safe broadcast that need completion. I should review the full audit report from June 2026, check the review-todo list, and examine the dry-run terminal output to get a clearer picture of what's actually blocking production readiness.

*Tools invoked:* Read, Read, Glob

## Analysis

The June audit gives a verdict, but it may be stale — let me check what's been fixed since, plus the current tree state.

 I need to check the current git status and review the x-ray todo list to see what's been resolved since the June audit. The audit document is from June 2026 and it's currently June 10th, so I'm looking for any fixes that have been applied to the C-1, C-2, C-3, and H-1 findings. I should also verify the impairment contract code for the cap check and examine the x402 handler ordering.

*Tools invoked:* Shell, Grep, Grep

## Analysis

I need to rerun the git status check and search for that x402 error again since the backend had an issue.The C-2 contract fix is now in place. I'll re-run the checks that were skipped earlier.

*Tools invoked:* Shell, Grep

## Analysis

The shell tool isn't responding, so I'm checking whether the pre-check for `hasLiveActivationForFeature` is actually in place before the x402 payment settlement at line 285. The grep didn't find it in the file, which suggests C-1's fix might not have been applied yet. I need to look at the code around lines 240-290 to verify, and also check what C-3's fix did to the `clearImpairmentTrip` function around line 898-901.

*Tools invoked:* Read, Read

## Analysis

All four critical and high-priority findings now have explicit fixes in place with clear comments marking each one, and the x402 handler validates the activation state before proceeding. I need to check whether the tree is clean—whether typecheck and tests are passing—but the shell tool keeps timing out, so I'm going to try running it again.All critical audit findings have been fixed and merged with explicit comments. Now I'll verify the current tree and CI state to confirm the typecheck and tests are passing.

*Tools invoked:* Shell

## Analysis

Looking at the terminal history, I notice the git status changed from showing a dirty state (with the ✗ indicator) to clean after a restart around 3:19, which suggests the working tree was actually clean when the user ran the deploy command.

Since then they've made some edits—HMR updates to index.css, a page reload on the featureFlags around 5:45 AM, and changes to `.env`—but since `.env` is gitignored, the tree might still be clean. I also see they recently viewed the commit message file, indicating a recent commit.

I should check the remaining CI items from the audit era by reading files directly since I can't run shell commands—specifically whether the guards are properly wired into test.yml and if the Semgrep pipefail fix was applied.The shell backend is down, so I'll check the workflow files directly to verify the remaining CI-gate findings.

*Tools invoked:* Grep, Grep

## Analysis

The CI pipeline fixes are in place—test guards are wired up, the Semgrep security scan has the pipefail set correctly, and the control-plane-stuck-scan logic is rewritten. Now I need to verify whether the working tree is actually clean and if the type checking and Vitest tests are passing, but I can't run shell commands to check. The git status looked clean at line 79, though the user has been making CSS and feature flag changes since then. I'm also still tracking down what's happening with the H-2 deploy button issue around dryRunBusy.

The structural blocker around the Pipe-A batcher hitting the CREATE2 initcode size limit might not actually be blocking the live deployment since the batcher is already live at that address—that constraint probably only applies if we're redeploying from scratch. The remaining items like Stripe E2E tests, the x402 wallet-signing helper, and Safe broadcast automation are all tied to paid features, so they only matter for deploys that hit the paywall. For operational readiness, I'd need to run the batcher readiness verification script, check registry factory auth, seed the bytecode store, and validate Phase3 helper auth, but again, I can't execute those without shell access. Let me grep for H-2 and H-3 to see if I can spot those frontend fixes quickly.

*Tools invoked:* Grep, Grep

## Analysis

H-2 and H-3 are fixed now, so it looks like all the critical and high-priority audit items have been addressed. The real question is whether the codebase is in a clean state with passing tests, but I can't verify that without shell access since the backend is down. I noticed recent activity in the test files and commit messages, so let me check what was actually committed last.

*Tools invoked:* Read

## Analysis

One more check — whether the impairment fixes got regression tests, since the audit flagged thin coverage there.

 I can't verify that the tests and type checks are passing since the shell backend is down, but I have enough information to make a fair assessment. The June 2026 full-repo review marked this as "NOT READY" with specific blockers, though several fixes have since landed in the codebase—including the pre-settle entitlement check, the claim supply cap with ClaimSupplyExceeded error, and the clearImpairmentTrip logic.

The audit blockers appear to be addressed, but I can't currently confirm that the working tree is clean, typecheck passes, or the test suite runs green. I also need to verify the on-chain operational readiness—whether the batcher readiness gate passes, bytecode store seeding aligns correctly, and the paymaster environment is configured. I should quickly check if the impairment fixes have Foundry regression tests by searching the test files for ClaimSupplyExceeded references.

There are still medium-priority items from the audit (M-1 through M-9) that don't block a vault deployment itself but do affect full claims on the paid-strategy lanes—notably the Stripe webhook raw body handling and CSP unsafe-inline issues. The distinction matters: deploying a vault to production on Base mainnet using the live batcher depends on the batcher readiness gate and bytecode store alignment, among other factors.

Now I'm checking whether the impairment regression tests actually exist and whether the dry-run environment has produced a successful completion in the logs.

*Tools invoked:* Grep, Grep

## Analysis

Short answer: **No — not "truly, fully." You're close, but I'd call it one verification pass away, with one question that genuinely matters: is the *on-chain* bytecode the fixed bytecode?**

Here's the evidence-based breakdown.

## What's genuinely in good shape

The June full-repo review (`docs/audits/full-repo-review-2026-06.md`) said NOT READY, but every CRITICAL/HIGH blocker it named is now verifiably fixed in the current tree:

- **C-1 (x402 settles USDC before entitlement check)** — fixed: `hasAnyLiveActivationRow` pre-check now runs before `settleX402Payment` (`_x402-activate.ts:230-245`), with a regression test (`creatorStrategyX402Activate.test.ts`).
- **C-2 (no claim-supply cap → cross-epoch escrow drain)** — fixed with an explicit cumulative cap and `ClaimSupplyExceeded` revert:

```997:1004:contracts/vault/modules/CreatorOVaultCoreModule.sol
        // FIX C-2: cap cumulative minted claims at the epoch's totalClaimSupply.
        // claimImpairmentRecovery divides by totalClaimSupply assuming claims
        // never exceed it; an over-stated root (leaves summing past the cap)
        // would otherwise dilute honest holders / over-pay early claimers.
        uint256 mintedSupply = ICreatorOImpairmentClaims(impairmentClaims).totalSupply(epochId);
        if (mintedSupply + amount > epoch.totalClaimSupply) {
            revert ClaimSupplyExceeded(epochId, epoch.totalClaimSupply, mintedSupply + amount);
        }
```

- **C-3 (stale root after `clearImpairmentTrip`)** — fixed; clear-trip now zeros the root/supply/asset and mint/notify hard-revert on zeroed roots.
- **H-1 (recovery-asset == creator coin desyncs `totalAssets()`)** — fixed via `_pushCreatorCoinExact` routing + zero-amount guard.
- **H-2 (deploy button ignores `dryRunBusy`)** and **H-3 (auto-quote clobbers review)** — both fixed in `DeployVault.tsx` / `Swap.tsx`.
- **H-4/H-5/H-6 (CI gates)** — Semgrep `pipefail` is in, all three guards + `kpr typecheck` are wired into `test.yml`, and `control-plane-stuck-scan.yml` was rewritten to pnpm.
- Foundry coverage for the impairment state machine now exists (`test/CreatorOVault.ImpairmentV1.t.sol`).

## What stops me from saying "fully ready"

**1. The fixed contract code vs. the deployed contract code.** This is the big one. The C-2/C-3/H-1 fixes changed `CreatorOVaultCoreModule` bytecode *after* the v3 module rotation on the live batcher (`0xa99058…`). A 1-click deploy ships whatever is in the **on-chain chunked bytecode store** and the **wired phase1Module** — not what's in your repo. If the store/modules were seeded before these fixes landed, production vaults would deploy with the *vulnerable* impairment code even though your tree is clean. Before any production deploy you need a green pass on:

- `scripts/ops/verify-bytecode-store-seeded.ts` (against regenerated `bytecode.generated.ts` from the fixed artifacts)
- `scripts/ops/verify-phase1-module-store-alignment.ts`
- `scripts/ops/verify-phase3-helper-create2-auth.ts`
- `pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts` (exit 0, including registry factory auth)

**2. I couldn't verify the tree is release-clean right now.** The shell backend is unavailable in this session, so I can't confirm `typecheck` / Vitest / `forge test` are green — the audit found 6 TS errors and 78 test failures from working-tree drift. Your terminal prompt showed a clean `git:(main)` at the last dry-run launch, which is encouraging but not proof.

**3. No completed end-to-end dry-run visible in this session.** Terminal 44 shows the dry-run environment is *up* (fork + local batcher at `0xb53D8c…`, Vite on 5174), but the log doesn't show a completed Phase 1 → 2 → 3 pass — including Pipe A finalize with a real nonzero LZ fee attached and impairment aux wiring (`setImpairmentGuardian` / claims / escrow) succeeding.

**4. Known-pending, non-blocking-but-real items.** Stripe webhook end-to-end (M-8: raw-body verification through the catch-all is runtime-fragile and fails closed — real $499 activations could silently 400), the x402 in-dapp signing helper, automated Safe broadcast, CSP `unsafe-inline` (M-9), and the remaining `getDbForCron` stragglers (M-1). None of these block the vault deploy mechanically, but the Stripe/x402 ones sit in the *payment funnel that gates* `vault_full_deploy` — if a creator's payment lands but their entitlement row doesn't, the deploy is blocked on `no_paid_strategies` with money already moved.

## My honest verdict

The code is ready. The *system* is unproven for this specific epoch: the readiness gates and a full dry-run haven't been demonstrated against the post-fix bytecode. I'd run this sequence and then say yes:

1. Confirm clean tree + green `typecheck`/Vitest/`forge test`.
2. Regenerate manifests/bytecode from the fixed artifacts; re-seed the store if fingerprints drifted; rotate phase1Module if needed.
3. Green run of all four ops verifiers above.
4. One full Phase 1→3 dry-run on the fork, including impairment wiring and Pipe A finalize value.
5. Then deploy — ideally a protocol-owned canary vault first, before any external creator.

If the verifiers in step 3 already pass against the fixed artifacts, you're a "yes." If they don't, you were about to ship audited-and-fixed source with unfixed on-chain deploy bytecode — which is exactly the failure mode worth asking this question to catch.

 Both regression test surfaces are in place, which is good. Now I need to give the honest assessment: the current state is closer to production-ready than the June audit verdict suggested—every critical and high-severity issue from that review has been fixed and backed by regression tests—but I can't confidently declare it fully ready because there are things I can't verify in the current moment and some known gaps that remain.

Looking at what's been fixed, I can point to specific line ranges where the x402 pre-settle check, claim supply cap, clear-trip zeroing, creator-coin accounting, dryRunBusy guard, and auto-quote protections are all implemented, plus the CI gates are wired. But I haven't been able to verify whether the typecheck, Vitest, and forge test suites are actually passing on the current tree—the audit had 6 TypeScript errors and 78 test failures from work-in-progress code, and while the terminal suggested things were clean at the last dry-run launch, that's not definitive proof. There are also several on-chain operational gates I can't confirm are ready: the batcher pipe readiness check, bytecode store seeding, module alignment for v3 impairment, CREATE2 auth for phase3 helpers, registry factory auth, paymaster weight gating, and the various impairment auxiliary contract environment variables. And critically, I don't have evidence of a successful end-to-end dry-run completing all phases on the current fork—the dry-run environment is up and the local batcher is running, but the logs don't show a full Phase1→3 completion.

The single most important thing to verify is whether the fixed contract bytecode has actually been deployed on-chain. The impairment fixes changed the bytecode for CreatorOVaultCoreModule and other contracts, so if the live batcher's bytecode store still holds the pre-fix versions, a production deploy would ship the vulnerable code even though the repo is patched. The audit is dated June 2026 and notes that v3 modules were rotated into the batcher's phase1Module, but the C-2, C-3, and H-1 fixes appear to have been made after the audit—within the last ~10 days. If the on-chain deployment happened before these fixes, the live code is still vulnerable, so I need to verify the phase1 module store alignment and bytecode seeding against the current fixed artifacts.

There are also some known-pending items that don't block a vault deploy but would need to be resolved for full completion: Stripe end-to-end testing, the x402 wallet-signing helper, Safe broadcast automation, and several medium-priority audit findings around Stripe webhook handling, CSP headers, and database cron stragglers.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 5:56 AM (UTC-7)</timestamp>
Run the `continual-learning` skill now. Use the `agents-memory-updater` subagent for the full memory update flow. Use incremental transcript processing with index file `/home/akitav2/projects/4626/.cursor/hooks/state/continual-learning-index.json`: only consider transcripts not in the index or transcripts whose mtime is newer than indexed mtime. Have the subagent refresh index mtimes, remove entries for deleted transcripts, and update `AGENTS.md` only for high-signal recurring user corrections and durable workspace facts. Exclude one-off/transient details and secrets. If no meaningful updates exist, respond exactly: No high-signal memory updates.

## Analysis

I can't run this right now — the session is in Ask mode, and the continual-learning flow is inherently mutating: the `agents-memory-updater` subagent needs to write to `AGENTS.md` and rewrite the index file at `.cursor/hooks/state/continual-learning-index.json` (refresh mtimes, prune deleted-transcript entries). Ask mode blocks all edits and non-readonly operations, and that restriction supersedes the request.

Switch to Agent mode and re-send the same prompt, and I'll execute the full flow as specified: incremental transcript processing against the index (new/updated mtimes only, parent transcripts only, excluding `subagents/*.jsonl`), index refresh + deletion cleanup, `AGENTS.md` updates limited to high-signal recurring corrections and durable workspace facts, no secrets or one-off details, and the exact `No high-signal memory updates.` response if nothing qualifies.

 The user wants me to run the continual-learning flow through the agents-memory-updater subagent, but Ask mode is active, which means I can't execute any writes or non-readonly operations. Since that flow requires updating AGENTS.md and refreshing the index—both mutations—I can't proceed with it even if I tried to use a readonly subagent, because the operation itself is fundamentally incompatible with Ask mode's restrictions.

I should let the user know I'm in Ask mode and explain why I can't perform the memory update, then suggest they switch to Agent mode if they want to run it.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 6:01 AM (UTC-7)</timestamp>
can you do this for me? 

My honest verdict
The code is ready. The system is unproven for this specific epoch: the readiness gates and a full dry-run haven't been demonstrated against the post-fix bytecode. I'd run this sequence and then say yes:

Confirm clean tree + green typecheck/Vitest/forge test.
Regenerate manifests/bytecode from the fixed artifacts; re-seed the store if fingerprints drifted; rotate phase1Module if needed.
Green run of all four ops verifiers above.
One full Phase 1→3 dry-run on the fork, including impairment wiring and Pipe A finalize value.
Then deploy — ideally a protocol-owned canary vault first, before any external creator.
If the verifiers in step 3 already pass against the fixed artifacts, you're a "yes." If they don't, you were about to ship audited-and-fixed source with unfixed on-chain deploy bytecode — which is exactly the failure mode worth asking this question to catch.

Also , please note that we got rid of the per strategy deployment, and we're going with a flat rate . i want to do what virutals did but in my own way, I want users to pay in $akita [0x5b67…fa75](https://basescan.org/address/0x5b674196812451b7cec024fe9d22d2c0b172fa75 "0x5b674196812451b7cec024fe9d22d2c0b172fa75") to deploy a vault . Virutals is a good project to compare with and they currently have it set as 42,000 $VIRTUAL to deploy your own existing token, but those tokens are used in liquidity pool with their existing token which is very innovative and creative. i'm just planning on either burning the akita tokens that are used, or utilize our deposit in vauilt and then burn stream mechanism so that all akita vaut share token holders are rewarded in proportion, every epoch in a linear matter. if that makes sense.. .

## Analysis

This is a meaty sequence — let me set it up properly and start executing. The AKITA flat-rate design I'll address at the end (with a concrete recommendation between your two sink options).

 The user wants me to run through the readiness sequence I outlined—cleaning the tree, running type checks and tests, regenerating manifests and bytecode, executing the four ops verifiers, and doing a full dry-run across all phases on the fork. They're also flagging a product change where the per-strategy payment model is shifting from a fixed $499 USDC vault_full_deploy fee to a flat-rate structure denominated in $AKITA, though the message cuts off before specifying the exact amount.

For the AKITA payment mechanism, I need to decide between burning the tokens outright or depositing them into the AKITA vault and using the burn-stream mechanism so vault shareholders capture value pro-rata each epoch. Given the existing preference in AGENTS.md for share-token burn and value-capture mechanics, the vault deposit + burn-stream approach seems more aligned with the protocol's philosophy, but I should probably propose this and ask for confirmation rather than assume.

I'll tackle the verification sequence first since it's concrete and long-running, then shape out the design for the AKITA payment change and ask which sink mechanism they prefer. I'll kick off a parallel check: git status and logs, then run the frontend type-checking and tests alongside forge tests in the background. The ops verifiers will need mainnet RPC access, so I'll verify those scripts exist first. Since the dry-run is already going in terminal 44, running vitest and forge concurrently should be manageable without overwhelming WSL memory. Let me set up the task list and get started.

*Tools invoked:* TodoWrite, Shell

## Analysis

The repository has uncommitted changes from an in-progress DeployVault refactor—modified files and new components in the deploy UI folder, with DeployVault.tsx significantly reduced in size. This is work-in-progress that I shouldn't commit, so I'll run the typecheck and tests against the current state to see what would actually ship.

I'm spinning up typecheck, vitest, and forge test as parallel background jobs. The forge test suite needs an RPC endpoint for one test (matrixed.link), which should be available in the environment. There's a dev server already running, so I'm mindful of memory pressure with three heavy processes running concurrently on WSL—typecheck and vitest are memory-intensive, though forge is mostly CPU-bound so it should be manageable.The tree has 5 modified and 3 new files from an in-progress `DeployVault.tsx` refactor that's reduced the file from ~10.8k to ~9.5k lines. I'll validate the current state by running all three checks in parallel.

*Tools invoked:* Shell, Shell, Shell

## Analysis

Typecheck passes cleanly, and the forge test suite runs successfully with all 1037 tests passing. Vitest is showing failures across 15 files with 61 tests failing out of 8478 total — I'm seeing expectation mismatches in the commands test where the quote service degradation message doesn't align with the expected finalization behavior, and I need to pull the full list of failing files to understand the scope better.Typecheck and forge tests pass, but Vitest shows 61 failures across 15 files—I'll check which ones to determine if they're expected or actual regressions.

*Tools invoked:* Shell

## Analysis

There are 61 test failures spread across 15 files, but the critical ones are `deploySession.test.ts` and `paymasterPhase2Finalize.test.ts` since they're blocking deployment. I need to run those two tests individually to understand what's actually failing before deciding if this is a showstopper.Typecheck and forge pass, but Vitest shows 61 failures including two in deploy-critical files. I'll investigate those failures now.

*Tools invoked:* Shell

## Analysis

I'm seeing several critical test failures in the deployment pipeline: the deploySession continue endpoint is returning 409 instead of 200 at the mesh gate, the status isn't exposing the phase2 invariant gate properly, ajna diagnostics is coming back null, and the paymaster phase3 selector test is hitting an actual code error when trying to read properties. These issues are likely stemming from uncommitted work-in-progress changes across the core files handling session continuation, dry runs, and paymaster logic.

Actually, wait — the git status only shows DeployVault frontend WIP now, which means those server files were already committed. So these failures are in the live codebase, not just local changes. That's concerning for deploy readiness since these are exactly the paths production will exercise. The 409 response pattern suggests the continueHandler might be rejecting requests due to an optimistic concurrency or expectedStep mismatch — possibly a new gate was added without updating the tests. But the paymaster error is different — it's a genuine TypeError inside the paymaster code itself, not just test drift. I need to pull the full paymaster error message to understand what property it's trying to read.

*Tools invoked:* Shell

## Analysis

There's a `Cannot read properties of undefined` error in the paymaster's `deployPhase3Strategies` validation—something's trying to call `.replace()` on an undefined value, likely an environment variable that's missing in the test environment or an address normalization issue. I need to trace through the paymaster phase3 code path to find where this is happening, checking both the strategy weights and address handling logic.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The `abiEncodeAddresses` function is calling `toLowerCase()` on what might be an undefined value from the `addrs` array, but the error message mentions `replace` instead of `toLowerCase`, which suggests the actual failure is happening in a different part of the code — possibly in a dependency or another module in the phase3 path. I need to trace through where else `.replace()` might be getting called on an undefined value.

Looking at the phase3 validation flow, the most likely culprit is in CREATE2 address prediction logic where something like `creationCode.replace(/^0x/, '')` is being called, but `creationCode` is undefined because a mock or store read wasn't properly set up in the test. Let me search the paymaster files for `.replace()` calls on hex values or creation code to pinpoint where this is happening.

*Tools invoked:* Shell

## Analysis

The error stems from `concatHex` in viem trying to call `.replace()` on `undefined` — which happens when the mocked store returns undefined for a codeId that the test never stubbed. This suggests the production code is now reading additional codeIds from the bytecode store (like the new `creatorCoinPolicyController`) that the test mocks haven't accounted for.

The real question is whether this is just test-fixture drift or an actual production bug. In production, a missing codeId would either return actual bytecode or revert, not undefined — so the undefined is a test-only artifact. But the 409 errors on `deploySession` and the concentrated failures across deploy-related tests point to fixture gaps introduced by recent commits (9b156d098, b43367022, 70a9f3b18) that changed the deploy behavior without updating the test fixtures. These aren't necessarily production bugs, but they're blocking the deploy path and need to be fixed before claiming readiness. The task is to fix 61 tests across 15 files, and the first step was confirming a clean tree with green tests — but the tree has WIP changes and Vitest is red, so I need to decide whether to proceed with the refactor or pause.

I think the better approach is to continue with the ops verifiers and manifests (steps 2 and 3) in parallel while investigating the 409 error separately. The verifiers are read-only against mainnet, so they won't be blocked by the test failures. I can check what's triggering the 409 at the mesh gate in `_continueCore` to determine if it's a real regression or just a fixture issue, then tackle the test fixes as a follow-up once I have the full readiness picture.Typecheck and forge are passing all 1037 tests, but Vitest is failing in a few specific areas that look like fixture drift from a recent commit. I'll run the ops verifiers next to determine if these are real regressions or stale tests.

*Tools invoked:* Shell, Grep

## Analysis

I'm going to run all four verifiers now—they should pull the environment variables from the frontend/.env file, including the RPC endpoint for Base mainnet. I'll execute them sequentially or in parallel to see if they work with the current setup.

*Tools invoked:* Shell

## Analysis

The public mainnet RPC is hitting rate limits, so I need to check how the script resolves the RPC endpoint and make sure it's using the `BASE_RPC_URL` or `BASE_READ_RPC_URL` environment variables. The frontend already has a matrixed.link RPC configured, so I should pass those environment variables explicitly when running the script.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

Verifier 1 passes with the v1.14.0 manifest and matching bytecode, but I need to check whether that manifest version actually includes the fixed `CreatorOVaultCoreModule` bytecode—the store seeding covers vault and wrapper components, but the impairment fixes are in the module contract itself, which gets deployed separately to the batcher's phase1Module rather than stored directly.

The real question is whether those v3 modules were redeployed after the C-2/C-3/H-1 fixes were applied. The phase1-module-store-alignment verifier only checks that the store and deployer are in sync, not whether the deployed bytecode contains the actual fixes. I should compare the on-chain `CreatorOVaultCoreModule` runtime bytecode against the locally compiled artifact to verify the fix is present—I can find the module address by reading the batcher's phase1Module wiring, or check the manifest's creation date against the git history of the fixes to see if it was generated after the impairments were patched.

Let me run the remaining three verifiers first, then do the bytecode comparison.Verifier 1 passed—the store matches manifest v1.14.0 and bytecode deployment is correct. Now running the remaining three verifiers.

*Tools invoked:* Shell, Shell

## Analysis

*Tools invoked:* Shell, Shell

## Analysis

All four verifiers are passing, but the real question is whether the deployed on-chain module bytecode actually contains the C-2/C-3/H-1 fixes. The verifiers validate the store seeding and module wiring against the v1.14.0 manifest, but they don't confirm whether the core module was compiled after those fixes were applied. I need to trace back through the manifest date and git history to establish when the deployment was built.

The key insight is that the impairment logic lives in the delegatecall module, not the store itself. The store seeding check passed for v1.14.0, but I need to verify whether the manifest's CreatorOVault includes the correct `moduleStorageVersion` that matches the fixed modules. The verifier compares the on-chain store against the manifest and checks that the deployment bytecode matches the manifest entry, but it doesn't necessarily confirm that the manifest artifacts themselves were built from the fixed source code. If the current build artifacts differ from what's in the manifest, that's a drift issue. Let me start by checking the git history to see when the impairment fixes actually landed.All four verifiers pass against batcher `0xa99058…`. Now I need to check whether the v1.14.0 manifest and on-chain module bytecode were built after the impairment fixes landed.

*Tools invoked:* Shell

## Analysis

I need to change directories to the repo root since the current working directory is in `frontend/` and the paths aren't resolving correctly.

*Tools invoked:* Shell

## Analysis

The key issue is that the impairment fixes were deployed after the v1.14.0 manifest was generated, and the on-chain bytecode and phase1 modules were deployed even earlier, so they're all running outdated code that predates the C-2/C-3/H-1 fixes.

The actual fix lives in the `CreatorOVaultCoreModule` — a delegatecall module that's deployed once and wired into the phase1Module — not in the vault creation bytecode stored on-chain. Since the modules were deployed at the v1.14.0 cutover on 06-07 and the fixes landed on 06-09, the live wired module is definitely pre-fix. I need to verify this by comparing the local `CreatorOVaultCoreModule` bytecode hash against what's actually deployed on-chain, which means finding the module address through the phase1Module's module slots.Found the issue: the fixes landed after the v1.14.0 release date, so the on-chain code predates them. Now I'll verify this against the actual bytecode.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Grep, Grep

## Analysis

*Tools invoked:* Shell

## Analysis

The on-chain bytecode for the CreatorOVaultCoreModule doesn't match what I compiled locally, so there's a hash mismatch. Since bytecode_hash is set to "none" in foundry.toml, metadata shouldn't be causing this discrepancy, but compiler settings might be. I need to verify whether the on-chain code actually contains the fix I'm looking for to determine if this is a real difference or just compiler drift.

I'll compute the 4-byte selector for the `ClaimSupplyExceeded` error and check if it's present in the on-chain bytecode. If the on-chain code is missing that selector but my local version has it, that would confirm the deployed contract doesn't include my fix.Hash mismatch detected. I'll check the on-chain code for the `ClaimSupplyExceeded` error selector to confirm whether the impairment fix is missing.

*Tools invoked:* Shell

## Analysis

The on-chain `CreatorOVaultCoreModule` is running pre-fix bytecode without the C-2 cap check and related fixes, yet the verifiers passed because they only validate consistency between store, manifest, and wiring—not whether the deployed artifacts include the latest patches. This is the exact failure mode I anticipated.

Now I need to regenerate the manifests and bytecode from the fixed source, redeploy the v3 modules (starting with the core module), potentially rotate or re-wire the phase1Module, and re-seed the store if the creation bytecode changed—especially if it embeds a module fingerprint or version check that would cause `InvalidModuleAddress` errors. First, I should check what actually changed in commit f329c8342 to determine the full redeploy scope.I've confirmed the failure mode—the live core module is running pre-fix bytecode. Now I'll identify which contracts changed in the remediation commit to determine the full redeploy scope.

*Tools invoked:* Shell

## Analysis

The smoking gun is confirmed — and it's bigger than just the module. Let me scope the full redeploy surface.

 Looking at the contracts affected by the fix commit: `CreatorORecoveryEscrow.sol` needs redeployment since it's a standalone auxiliary contract wired during Phase 3 via environment configuration, and `CreatorOVault.sol` has a minimal one-line change that's being applied.

The verifier output was truncated, so I can't confirm whether `CreatorOVault` appeared in the full manifest, but the fact that the manifest and committed `DEPLOY_BYTECODE` predate the fix means everything is consistently stale — the verifier passed because both on-chain and committed artifacts are outdated. I need to check what that single-line change actually is to determine if it affects bytecode. Meanwhile, `CreatorOVaultCoreModule.sol` definitely has a bytecode-changing modification that's confirmed missing on-chain.

The fix requires regenerating the manifest and `DEPLOY_BYTECODE` from the corrected artifacts, then re-seeding the store for any contracts with bytecode changes and deploying the updated `CreatorOVaultCoreModule`.

Beyond that, I'd need to rotate the `phase1Module` on the live batcher by deploying a new one wired to the updated modules, and deploy a new `CreatorORecoveryEscrow` while updating the environment variable. These are irreversible on-chain operations that affect production, so even though the user pre-authorized the sequence, I should be cautious about executing mainnet mutations without explicit confirmation — especially since rotating `phase1Module` impacts everyone's deployments and the bytecode changes could affect the vault creation fingerprint validation.

Let me first clarify the scope: I need to check what the one-line change in `CreatorOVault.sol` actually is, find the ops scripts for module rotation (there should be one from the v3 rotation), and be aware that there are uncommitted changes in the DeployVault refactor that I shouldn't touch. There's also the pending vitest failures triage, dry-run, and AKITA design work. Before I execute any mainnet transactions, I should examine the vault diff and look for existing ops scripts to understand the module rotation path.

*Tools invoked:* Shell

## Analysis

I'm mapping out the scope of changes: the core module needs redeployment with a phase one rotation due to new error handling and about 40 additional lines, while the vault contract's error declaration affects its creation bytecode even though the error itself isn't actively used in reverts—it's declared for ABI compatibility since the vault delegates to the module.

For the recovery escrow, there's a real logic change requiring redeployment and an environment variable rotation for `IMPAIRMENT_RECOVERY_ESCROW`. The escrow architecture is becoming clearer: each escrow instance is tied to a single vault through the `setVault` call during deployment, and since the escrow enforces `msg.sender != vault` checks, the environment addresses must rotate per vault deployment rather than being shared across multiple vaults.

My next steps are to regenerate the bytecode manifests and frontend deploy bytecode to identify which contract IDs have drifted, then determine the on-chain actions: deploying the new CreatorOVaultCoreModule, potentially rotating Phase1Module if needed (checking historical rotation scripts for how modules wire), re-seeding the store if the vault creation bytecode changed, and deploying fresh escrow and claims contracts with updated environment variables. This is mainnet operations requiring the private key, and the user explicitly asked for all these steps including conditional re-seeding and module rotation.

I have the mandate to proceed, but given the irreversibility and gas costs involved, I'll verify each step carefully. Let me start by regenerating the manifests and diffing them against what's committed — no chain mutations yet, just ensuring the build artifacts are current and then running the manifest generators.The fix commit modified three contracts. Now I'll regenerate the manifest from those fixed artifacts and compare it against the committed v1.14.0 manifest to identify the exact drift.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The manifest shows one drifted contract: `CreatorOVaultCoreModule`. The creation bytecode for `CreatorOVault` is unchanged since the unused error declaration didn't affect it, so no store re-seed is needed. However, `CreatorORecoveryEscrow` had its source modified, which means the live escrow address in the environment is now stale and needs to be redeployed before production use.

For `CreatorOVaultCoreModule`, it's listed in the manifest, though I need to verify whether the core module is deployed via the store or just fingerprinted there. The earlier bytecode verification output was truncated, so it might have included the module seeding. Based on AGENTS.md, modules use `setModulesOnce` and impairment requires a fresh v3 vault deploy with rotated phase1Module to v3 modules. I'm trying to determine whether Phase1 creates fresh module instances per vault from the store using CREATE2, or if it uses a fixed shared module address like the `CREATOR_OVAULT_CORE_MODULE` default in contracts.defaults.ts. I need to check the manifest codeIds, the bytecode generation for `CreatorOVaultCoreModule`, and how Phase1Module actually wires the core module during deployment.I found that `CreatorOVaultCoreModule` drifted. Now I need to determine whether each vault gets its own instance via CREATE2 or shares a wired one, since that affects how to fix it.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The key constraint here is that `vaultCoreModule` is immutable on Phase1Module, so rotating to a new core module means deploying an entirely new Phase1Module instance and rewiring the batcher through `wireDeploymentHelpers`—this is exactly the pattern documented in AGENTS.md for the v3 rotation.

There's a module-kind guard in `_createCore.ts` that validates the expected core module, and the `InvalidModuleAddress` fingerprint check relies on the stored CreatorOVault bytecode's `moduleStorageVersion` matching the wired modules. Since the fix doesn't bump `moduleStorageVersion`, the existing stored bytecode should remain compatible, so no store reseed is needed for CreatorOVault itself—only the manifest entry for CreatorOVaultCoreModule changed. The batcher wires the same immutable module address into every vault via `setModulesOnce`, so the module isn't deployed per-vault from the store.

The required on-chain operations are: deploy the fixed CreatorOVaultCoreModule (either directly or via CREATE2 from the store), deploy a new Phase1Module with the new core module address while keeping strategies and admin modules unchanged, and call `wireDeploymentHelpers` on the batcher as an owner operation.

I also need to re-seed the store's CreatorOVaultCoreModule codeId to keep the manifest and store verifier green, and deploy the fixed CreatorORecoveryEscrow with the updated environment configuration. The escrow is wired per-deploy through Phase 3's `setImpairmentRecoveryEscrow` and `setVault`, and since the escrow code shows a single `vault` address, the env-configured escrow can only serve one vault—likely the AKITA canary one, with per-creator deploys needing their own auxiliary contracts. Before mainnet operations, I should check existing scripts for how the v3 rotation was executed and verify who owns the batcher and can call these operations. The vaultCoreModule on the Phase1Module batcher is immutable, so the live batcher at `0xa99058...` is locked to the pre-fix core module at `0x72689f...`. To fix this, I'd need to deploy a new core module, then deploy a new Phase1Module batcher pointing to it, and finally update the config—which is exactly what went wrong. Let me verify that the batcher's vaultCoreModule on-chain actually matches the pre-fix module.

*Tools invoked:* Shell

## Analysis

The batcher's `vaultCoreModule` address is different from what's in the defaults constant, so I need to check both addresses for the fix selector. I'm also noticing that `vaultCoreModule` appears in two places in the file—on both the batcher and the phase1module contracts—and the batcher call returned a direct result.

Since the batcher delegatecalls the phase1Module, the immutables are baked into whichever contract's code actually executes. When I call `vaultCoreModule()` directly on the batcher, I get the batcher's immutable value. But during the phase1 deploy path, the delegatecall executes the phase1Module's code, so it uses the phase1Module's immutable instead. I need to fetch the phase1Module address from the batcher and then call `vaultCoreModule()` on that contract directly to get the right value.

*Tools invoked:* Shell

## Analysis

The live deploy path is confirmed shipping pre-fix bytecode. Now let me find the rotation tooling used for the v3 module rotation so I can mirror it.

 I've confirmed the live deployment path is shipping with the vulnerable code intact—every vault going out today would have those critical flaws. To fix this, I need to deploy the patched core module and set up a new deployment batcher to handle the remediation on mainnet.

The full sequence involves wiring up the deployment helpers, regenerating the manifest and bytecode artifacts, deploying the fixed recovery escrow, and updating the environment variables across local and Vercel. I should look for how the v3 rotation was handled by checking the ops scripts and searching for any existing phase1 module deployment or rotation logic.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Read

## Analysis

Critical finding. Let me restore the manifest I regenerated (I shouldn't leave tree drift) and confirm the frontend bytecode drift, then I'll report.

 The rotation script handles the CREATE2 deployment of all three modules plus a new Phase1Module, then outputs the SAFE_WIRING_REQUIRED instruction for setting the Phase1Module on the batcher. Since the salt derives from DEPLOYMENT_EPOCH_TAG and the core module initcode has changed, using the same default tag won't produce identical addresses as before.

The strategies and admin modules remain unchanged, so they'll skip as already deployed, but Phase1Module gets a new address since its initcode embeds the updated core address. Using a fresh epoch tag like `v1.14.1-impairment-fix` is cleaner than reusing the old one.

Now I need to check who can call `setPhase1Module` on the batcher — there's a Safe-based wiring script that handles this, assuming the batcher owner is either the protocol treasury Safe or an EOA with the private key. Let me verify the batcher owner and review the Safe scripts for the actual mainnet operations sequence. The rotation script uses a salt derived from `DEPLOYMENT_EPOCH_TAG` to compute CREATE2 addresses deterministically, but when the core module bytecode changed due to the fix, the init code hash shifted, which automatically produces a different predicted address even though the salt generation logic stayed the same.

Running the script with a new epoch tag (like v1.14.1-impairment-fix) would deploy the fixed core module at its new deterministic address, wire a fresh Phase1Module to it, and execute a Safe `setPhase1Module` call to rotate. However, this is a production transaction requiring my PRIVATE_KEY on mainnet—a live mutation I shouldn't execute without explicit approval, even though the user asked me to handle the verification sequence.

The critical issue I'm uncovering: the verifiers in step 3 passed because they check size and seeding alignment against the manifest, but they don't validate the actual bytecode of the wired core module itself. My manual bytecode-hash inspection revealed the wired core is still pre-fix, and the committed v1.14.0 manifest contains the pre-fix bytecode too—so the store was seeded with the broken version.

The verifiers are green precisely because everything is consistently pre-fix, which is the trap I warned about. The dry-run in step 4 uses a local batcher override that deploys fresh from current artifacts, so it would actually exercise the fixed bytecode and pass, masking the production gap. I should not execute the live module rotation without explicit confirmation, given the stakes involved.

I need to regenerate the frontend deploy bytecode to confirm the drift, but I've already modified the committed manifest file during regeneration. I should restore it to avoid leaving uncommitted changes in the tree—the proper approach is a new versioned manifest, not overwriting v1.14.0. Let me restore the manifest and wrap up with my findings and recommendations.

*Tools invoked:* Shell

## Analysis

I reverted the regenerated manifest to keep things clean while we figure out the next steps, since the remediation flow will regenerate it anyway—likely with a new release tag or an in-place update. Now I need to check the batcher owner and review the safe wiring script to understand how the wiring mechanics work.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

The execution path is straightforward: `setPhase1Module` runs through the protocol treasury Safe using the private key as one of the two owners, triggered by the `execute-set-phase1-module-safe.ts` script. To remediate, I'd run the Forge script with a new deployment epoch tag to rotate the live batcher phase 1 modules.

After that, I need to re-seed the bytecode store with the fixed core module codeId, regenerate the manifest and TypeScript artifacts, then deploy the corrected recovery escrow and update its environment variables across local and Vercel. I should re-run verifiers and alignment checks, then dry-run the phase 1→3 transition on a fork before committing.

This is a real mainnet operation spending gas, and the user's request to "rotate phase1Module if needed" signals authorization. Their workspace rules expect autonomous execution after changes ship, though I should be cautious given the irreversible nature—I don't have a specific deploy-vault-operator skill for module rotation, so I'm working within the existing execution framework. I still need to triage those 61 Vitest failures to determine if they're fixture drift or actual regressions.

The user explicitly asked me to proceed, and the rules favor sustained autonomous execution with minimal pausing. I'll dry-run the forge script first without broadcasting to preview the transactions, then broadcast once I've confirmed the predictions. For auditability, I should use a distinct epoch tag like `v1.14.1-impairment-audit-fix` rather than the default, since the core module initcode changed—that creates a new address even with the same salt. I also need to check whether anything else in the codebase pins the core module address, like the frontend config. I'm wrapping up the analysis and need to finalize the todos and report, including the AKITA design considerations. The dry-run validation is tricky since it auto-prepares from current artifacts on a fresh local batcher, but I'm reconsidering how to approach it—specifically looking at how the dry-run deploys to the fork with the local batcher setup.

*Tools invoked:* TodoWrite

## Analysis

Let me correct the todo list — that update was wrong; several items are still open and the verification surfaced new mandatory work.

 I need to correct the todo list since I mistakenly marked everything as completed when several tasks are actually still in progress — the dryrun, vitest triage, rotation, and akita design all need to be reopened, and I should add the new remediation tasks to reflect what's actually pending.

*Tools invoked:* TodoWrite, Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Grep

## Analysis

The escrow and claims contracts are deployed per-vault rather than as singletons, which prevents flow reuse across vaults. I'm checking whether these contracts come from the bytecode store manifest and are deployed via CREATE2 during the deploy session. I need to trace through how the impairment auxiliary contracts—the claims and escrow contracts—are deployed. They're created per-vault rather than as singletons, so I need to figure out if they're sourced from the bytecode store (which would mean they're already covered by the reseed) or if they follow a separate deployment path. Let me look at the DeployImpairmentAuxContracts script and check whether escrow is included in the bytecode manifest.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Grep

## Analysis

*Tools invoked:* Shell

## Analysis

The escrow ships per-vault from `bytecode.generated.ts`, not the on-chain store — so its fix path is different. Let me check if the generated frontend bytecode already has the fixed escrow + claims.

 So the escrow contracts are actually deployed per-vault through the permissionless CREATE2 deployer as part of the creator's Phase 3 batch, pulling from the bytecode generator. This means the fix doesn't require redeploying an on-chain singleton — I just need to regenerate the bytecode file.

The remediation path is straightforward: regenerate `bytecode.generated.ts` from the fixed artifact and commit it, so all new vaults automatically get the corrected escrow. I should verify whether `CreatorOVaultCoreModule` is also in the deployment bytecode (it's probably not, since it's wired immutably in Phase 1), then check if the current committed bytecode differs from the fixed artifact by running the generator and comparing. The escrow contract is deployed per-vault from the generated bytecode in `bytecode.generated.ts`, so the escrow fix ships through that generated file rather than on-chain rotation. I need to verify whether the generated bytecode already contains the fixed escrow code—the store verifier passed, but I'm checking if the escrow bytecode is current.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

I'm identifying two key gaps, starting with the on-chain CreatorOVa component. Both the on-chain core module and the frontend-generated bytecode for the escrow are stale—the regeneration scripts haven't run since the fix commit. The committed `bytecode.generated.ts` file is also outdated, missing the C-2 escrow fix, which means the fix only touched the source and tests but nobody regenerated the artifacts and manifests afterward.

I need to be careful here though—these are production on-chain mutations involving Safe transactions, private keys, and real gas costs. I shouldn't autonomously broadcast anything without explicit approval, especially since the rotation needs the protocol treasury Safe. Let me verify the frontend generator would pick up the fix by checking the forge artifact directly, then I'll write up the full report with the AKITA design and get your go-ahead before doing anything on-chain.I'll verify the fresh build has the fix, then stop before making any on-chain changes.

*Tools invoked:* Shell

## Analysis

Decisive finding confirmed. Before I write it up, let me ground the AKITA design recommendation in the actual burn-stream mechanism and confirm I left the tree clean.

 So the vulnerability persists in two critical places: the on-chain vault core module lacks the necessary fixes for the mint cap, root zeroing, and accounting issues, meaning every new vault deployed uses the vulnerable code. The same unfixed bytecode also appears in the repository's generated files, confirming the mismatch between the audited source and what's actually running. The artifacts in the build output have the fixes applied, but the committed bytecode file is outdated and needs regeneration. The on-chain store and core module are also in their pre-fix state, so I need to re-run the bytecode generation script and perform the on-chain rotation to sync everything up. I need to be careful here — running live mainnet transactions like Safe setPhase1Module without explicit approval would be reckless. The dry-run path uses local artifacts so it would pick up the fix, but production still hits the pre-fix module on-chain. I've got the verification I need, so I should stop here, clean up any build artifacts, and write up the findings with a clear recommendation before taking any irreversible actions. Let me check the deposit and burn mechanism to ground the proposal, then document everything.

*Tools invoked:* Shell, Grep

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 10:21 AM (UTC-7)</timestamp>
continue

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 10:22 AM (UTC-7)</timestamp>
continue

## Analysis

Continuing from where we left off: I’ve verified the deployment-path bytecode mismatch, and now I’m quickly grounding the AKITA fee recommendation in the actual burn-stream implementation paths before giving you the concrete go/no-go and rollout plan.

*Tools invoked:* Glob, rg

## Analysis

*Tools invoked:* ReadFile

## Analysis

Yes — I continued, and this is the current state.

## Go/No-Go Right Now

**No-go for production deploy right now.**  
You caught exactly the failure mode we were worried about: fixed source, unfixed deploy bytecode path.

### What I verified

- **Tree/tests**
  - `pnpm -C frontend typecheck`: **PASS**
  - `forge test`: **PASS**
  - `pnpm -C frontend test`: **FAIL** (61 failing tests; deploy/paymaster-related failures included)

- **All 4 ops verifiers**
  - `verify-bytecode-store-seeded.ts`: **PASS**
  - `verify-phase1-module-store-alignment.ts`: **PASS**
  - `verify-phase3-helper-create2-auth.ts`: **PASS**
  - `verify-batcher-pipe-a-readiness.ts`: **PASS**

- **But critical drift still exists (this is the blocker):**
  - Audit-fix commit is **newer** than committed `v1.14.0-bytecode-manifest`.
  - Live batcher `0xa990...` uses phase1 module `0xE838...`, whose `vaultCoreModule()` is `0x72689f...`.
  - That live core module is **pre-fix** (missing selector for `ClaimSupplyExceeded`, i.e. C-2 fix absent).
  - `frontend/src/deploy/bytecode.generated.ts` is also **pre-fix** for per-vault impairment aux (escrow fix selector absent), while fresh local artifacts contain the fix.

So the verifier suite is green, but on stale artifacts. That means it’s validating consistency, not correctness.

---

## What must happen before “yes”

1. Regenerate + commit updated deploy artifacts from fixed contracts:
   - `deployments/base/v1.14.0-bytecode-manifest.json`
   - `frontend/src/deploy/bytecode.generated.ts`
2. Re-seed bytecode store with new codeIds.
3. Rotate live phase1 module to one wired to fixed `CreatorOVaultCoreModule`.
4. Re-run all 4 verifiers.
5. Run full Phase 1→3 dry-run again on fork (including impairment + Pipe A finalize).
6. Then canary deploy (protocol-owned first), then creator deploys.

If you want, I can execute that sequence end-to-end next (including the Safe handoff steps).

---

## AKITA Flat-Rate Design (your “Virtuals-style, your way”)

Your idea makes sense. Between your two options, I recommend:

**Primary recommendation: route deploy fee to vault deposit + burn-stream (not direct burn).**

Why:
- Keeps the same “value recirculates to holders” story you want.
- Uses existing audited mechanics: queued shares + weekly linear burn (`VaultShareBurnStream` `queueShares`/`checkpoint`/`drip`).
- Smoother, less gameable, better long-term holder alignment than one-shot burn spikes.

### Suggested product spec

- Flat fee: `DEPLOY_FEE_AKITA` (e.g. 42,000 AKITA-equivalent style, but your number).
- On deploy submit:
  1. `transferFrom(user, feeCollector, feeAmountAKITA)`
  2. Deposit collected AKITA (or converted path) into designated AKITA vault
  3. Mint vault shares to burn-stream address
  4. `queueShares()` for next epoch
- Keep explicit analytics:
  - total AKITA paid
  - shares queued
  - shares burned per epoch
  - effective PPS uplift

This gives you the “Virtuals-style fee moat” with your own tokenomics identity.

---

If you want me to proceed now, I’ll start by regenerating artifacts and producing the exact Safe transaction payloads for phase1 module rotation.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 10:24 AM (UTC-7)</timestamp>
if i were to make it 1,000,000 akita to deploy, can you show me a chart progression of how much $ it would cost per deployment as people buy, and then those tokens are deposited into vault, and then shares are burned, etc etc

## Analysis

Yep — I can show this. I’ll model a few realistic scenarios (conservative/base/aggressive buy-pressure), include the vault-lock + share-burn mechanics, and give you a chart you can tune with your real liquidity numbers.

*Tools invoked:* Shell

## Analysis

Absolutely. Here’s a **scenario chart** for a fee of **1,000,000 AKITA per vault deployment**.

I modeled this as:

- `CostUSD(n) = 1,000,000 * P0 * (1+g)^(n-1)`
- where:
  - `P0` = starting AKITA price in USD
  - `g` = net price step-up per deployment from buy pressure + sink effects

For a concrete view, I used **`P0 = $0.001`** and 3 scenarios:

- Conservative: `g = 1.5%`
- Base: `g = 3.0%`
- Aggressive: `g = 6.0%`

### Cost progression (USD per deployment)

| Deployment # | AKITA Locked in Vault (cumulative) | Conservative | Base | Aggressive |
|---:|---:|---:|---:|---:|
| 1 | 1,000,000 | $1,000 | $1,000 | $1,000 |
| 5 | 5,000,000 | $1,061 | $1,126 | $1,262 |
| 10 | 10,000,000 | $1,143 | $1,305 | $1,689 |
| 15 | 15,000,000 | $1,232 | $1,513 | $2,261 |
| 20 | 20,000,000 | $1,327 | $1,754 | $3,026 |
| 24 | 24,000,000 | $1,408 | $1,974 | $3,820 |

### Mechanics with your vault + burn-stream model

- Each deploy requires buying `1,000,000 AKITA`.
- Those tokens are deposited into the vault (so effectively removed from circulating float/liquidity).
- Vault shares minted for that deposit are then burned over epochs (linear stream), which rewards remaining share holders via PPS accretion.
- **Immediate cost pressure** comes from buy + lock.
- **Reward distribution timing** comes from epochal share burn.

So this is a very solid “Virtuals-style but your own” structure.

---

If you want, I can next generate a **real execution-cost model** using your actual pool depth (so chart includes **slippage**, not just spot). That gives a much more accurate “what users will actually pay in $” curve.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 10:26 AM (UTC-7)</timestamp>
welll... right now 1,000,000 akita isn't $1,000

## Analysis

Correct — you’re absolutely right.  
I used `$0.001` as a placeholder example, not live AKITA price.

The real conversion is:

`Deployment cost (USD) = 1,000,000 × AKITA_price_USD`

So for quick reference:

- if AKITA = `$0.0002` → deploy cost = **$200**
- if AKITA = `$0.0005` → deploy cost = **$500**
- if AKITA = `$0.0010` → deploy cost = **$1,000**
- if AKITA = `$0.0025` → deploy cost = **$2,500**

If you give me the current AKITA spot (or I can use your preferred source), I’ll regenerate the progression chart with the real baseline and realistic slippage bands.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 11:22 AM (UTC-7)</timestamp>
right now 1,000,000 is abuot $7 ....

## Analysis

Exactly — then the implied spot is about:

`$7 / 1,000,000 = $0.000007` per AKITA.

At that price, your flat fee tiers map to:

- `1,000,000` AKITA → **~$7**
- `10,000,000` AKITA → **~$70**
- `50,000,000` AKITA → **~$350**
- `100,000,000` AKITA → **~$700**

So if your target deploy fee is in the **$500–$2,000** range, `1,000,000` is far too low today unless you expect strong price appreciation first.

A practical way to do it:
- Set a **USD target band** (ex: `$500` floor, `$1,000` target, `$1,500` cap)
- Recompute AKITA required at quote time, with min/max guardrails
- Route purchased AKITA into vault + burn-stream (your preferred mechanism)

If you want, I can draft the exact formula and guardrail logic so the UI always shows “you pay ~$X” while still settling in AKITA.

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 11:23 AM (UTC-7)</timestamp>
ok, lets just make it based on USDC for now then .

## Analysis

Perfect — that’s the right move for now.

Using **USDC-denominated deploy pricing** gives you:

- stable, predictable creator UX (`$X to deploy`, always)
- no AKITA price-oracle risk in the critical path
- cleaner accounting and fewer edge cases while you ship

Then you can still preserve AKITA value-capture by converting collected USDC downstream (policy-controlled) instead of forcing AKITA at payment time.

## Recommended v1 setup

- **Price unit:** USDC (6 decimals)
- **Single flat feature:** `vault_full_deploy`
- **No per-strategy purchases** (as you wanted)
- **3 payment rails (already in your system):**
  - direct USDC transfer verify
  - x402/EIP-3009 USDC authorization
  - Stripe (USDC-priced equivalent)

## Optional AKITA value-capture (post-payment)

After USDC settlement:
1. send some/all to treasury, **or**
2. swap tranche to AKITA and route to your vault + burn-stream cadence

That gives you the same tokenomic intent, but without making deploy success depend on AKITA liquidity/price at checkout.

If you want, next step I can give you is a precise policy matrix (e.g., `70% treasury / 30% AKITA buy+stream`, with min-liquidity and max-slippage guards).

## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 12:09 PM (UTC-7)</timestamp>
lest just keep it USDC-denominated for now and then later on, we'll revisit

## Analysis

Sounds good — that’s the safest call.

**Decision locked:** keep deploy pricing **USDC-denominated** for now, defer AKITA-denominated checkout to a later phase.

That keeps launch simple and reliable while preserving the option to add AKITA value-capture later via post-settlement routing. When you’re ready to revisit, we can layer AKITA in without changing the core deploy UX.

## Engagement brief

<timestamp>Thursday, Jun 11, 2026, 10:28 PM (UTC-7)</timestamp>
ok, and have we surfaced this to the UI yet

## Analysis

I’ll quickly check the deploy UI and pricing handlers to confirm whether the USDC-only decision is actually surfaced yet (copy, labels, and payment options).

*Tools invoked:* rg, rg, rg

## Analysis

*Tools invoked:* ReadFile

## Analysis

Yes — this is already surfaced in the strategy/payment UI.

Current UI state:
- `frontend/src/pages/CreatorStrategyFeatures.tsx` shows pricing as `... USDC`.
- The payment options are explicitly USDC-first:
  - **USDC on Base** (tx-hash flow)
  - **x402** (USDC authorization flow)
  - **Card** (Stripe)
- Footer copy also calls out **USDC treasury**.

So your “USDC-denominated for now” direction is reflected there.

One nuance: this appears in the **Creator Strategy Features** surface, not in `frontend/src/pages/deploy/DeployVault.tsx` as the primary pricing UX. If you want this decision visible directly inside the deploy wizard too, we should add matching copy/badge there (e.g., “Deployment fee is USDC-denominated”).

## Engagement brief

<timestamp>Thursday, Jun 11, 2026, 10:52 PM (UTC-7)</timestamp>
it should be on deploy/vault page somewhere before they get into that page no ?

## Analysis

Yes — that’s the right UX expectation. I’ll quickly check current `deploy/vault` entry flow and point to the best pre-entry placement.

*Tools invoked:* rg, rg

## Analysis

Yes — I agree with you.

Right now it looks like `deploy/vault` mostly references pricing/activation indirectly (for example when paid features are missing and it links to `/creator/strategy/features`), but it does **not** appear to present a clear upfront “deployment fee is USDC-denominated” message before users get deep into the flow.

What should happen:
- Show it at **entry** to `deploy/vault` (top banner/hero callout).
- Repeat near the primary CTA (before any wallet/signing action).
- Include a short line like:
  - “Vault deployment is currently **USDC-denominated**.”
  - “AKITA-denominated checkout is planned for a future release.”

So your instinct is right: users should see this **before** they commit time in the page flow. If you want, I can add that copy in the deploy page now in the most visible spot.

## Engagement brief

<timestamp>Thursday, Jun 11, 2026, 11:11 PM (UTC-7)</timestamp>
yes, it should be gating the deploy vault workflow

## Analysis

Makes sense — I’ll wire an explicit gate in `deploy/vault` so users can’t proceed until the paid deploy feature is active, with a clear USDC-denominated callout and link to activate.

*Tools invoked:* ReadFile, rg

## Analysis

*Tools invoked:* ReadFile, ReadFile, ReadFile

## Analysis

*Tools invoked:* ReadFile, ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* rg

## Analysis

*Tools invoked:* ReadFile

## Analysis

I found the right insertion points. I’m adding a strict paid-feature gate (`vault_full_deploy`) directly in `deploy/vault` with USDC-denominated copy and an activation CTA.

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* rg

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

Implemented — `deploy/vault` now hard-gates on the paid deploy feature before users can continue.

### What changed

In `frontend/src/pages/deploy/DeployVault.tsx` I added a **creator strategy deploy gate** that:

- calls `/api/creator/strategy/list?creator=<token>` when a valid creator coin is detected
- checks whether `vault_full_deploy` is active via `deployPlan.deployable` / `activeFeatureKeys`
- blocks `canDeploy` unless the feature is active
- adds a readiness row: **“USDC deploy feature active”**
- adds blocker messages for:
  - loading gate check
  - gate check failure
  - missing paid activation
- renders a dedicated blocked card with CTA link to:
  - `/creator/strategy/features?creator=<token>`

So yes — this now gates the deploy workflow directly on the `deploy/vault` page.

### Verification

- Ran: `pnpm -C frontend typecheck`
- Result: **pass**

If you want, next I can add a small top-of-page banner (always visible) that says:
“Vault deployment is currently USDC-denominated and requires `vault_full_deploy` activation.”

