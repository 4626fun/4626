---
title: Vanity WASM TypeScript fixes
sidebar_label: c7859baf…
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
# Vanity WASM TypeScript fixes
| Field | Value |
| --- | --- |
| Session ID | `c7859baf-dfb7-44b0-9a35-3fb692519584` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Monday, Jun 8, 2026, 1:25 AM (UTC-7)</timestamp>
fix all

00:05:59.476 src/lib/vanity/vanityWasmRuntime.ts(30,11): error TS2339: Property 'instance' does not exist on type 'Instance'.00:00:32.330 Warning: Failed to fetch one or more git submodules
00:01:10.451 (node:85, thread:1) WARNING: Exited the environment with code 0
00:01:10.451 (node:85, thread:2) WARNING: Exited the environment with code 0
00:01:10.451 (node:85, thread:3) WARNING: Exited the environment with code 0
00:01:11.251 (node:356) WARNING: Exited the environment with code 0
00:02:40.501 (node:937, thread:1) WARNING: Exited the environment with code 0
00:12:29.743 (node:1251) WARNING: Exited the environment with code 0

## Analysis

I’ll fix this end-to-end by first patching the TypeScript error in `vanityWasmRuntime.ts`, then running a targeted typecheck to confirm no remaining compile issues from this regression. After that I’ll separate what’s actionable vs informational in the submodule/thread warnings.

*Tools invoked:* ReadFile, Shell

## Analysis

I found the concrete TS break: `WebAssembly.instantiate(...)` is being inferred as returning either an `Instance` or `{ module, instance }`, so destructuring `.instance` directly is unsafe in this type lib. I’m patching that call to handle both return shapes.

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* ReadFile

## Analysis

I ran a full typecheck after the patch and found the same `vanityWasmRuntime` line still needed a stricter cast for this workspace’s WebAssembly typings. I’m applying that now, then I’ll re-run a focused check and report what remains (there are also several unrelated existing TS errors in deploy files).

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadLints

## Analysis

Implemented a direct fix for the TS error you flagged in `frontend/src/lib/vanity/vanityWasmRuntime.ts`.

### What I changed
- Updated `instantiateVanityWasmFromBytes(...)` to support both WebAssembly instantiate return shapes safely (raw `Instance` vs `{ module, instance }`) using a typed fallback.
- This removes the failing `TS2339: Property 'instance' does not exist...` in that file.

### Verification
- Ran `pnpm -C frontend exec tsc --noEmit -p tsconfig.app.json`.
- Result: the `vanityWasmRuntime.ts` error is gone.
- Remaining type errors are in other deploy files (`creatorVaultBatcherInfra`, `resolveDeployExpectedAddresses`, `resolveDeployVanityPlan`, `DeployVault`, `deployVaultVanityPersistence.test`) and are unrelated to this specific wasm-runtime fix.

### About the warnings in your log
- `Warning: Failed to fetch one or more git submodules` is environment/setup-related, not a TypeScript code error.
- `WARNING: Exited the environment with code 0` lines are informational process shutdown notices, not failures.

If you want, I can continue and fix the rest of the current TypeScript errors in one pass next.

## Engagement brief

<timestamp>Monday, Jun 8, 2026, 6:06 PM (UTC-7)</timestamp>
yes

## Analysis

I’ll continue with a full pass on the remaining TypeScript errors now: I’ll inspect each flagged file, apply the smallest safe fixes, then rerun app typecheck to confirm everything is clean.

*Tools invoked:* ReadFile, ReadFile, ReadFile, ReadFile, ReadFile

## Analysis

*Tools invoked:* ReadFile, ReadFile, rg

## Analysis

I reloaded the error files and `DeployVault.tsx` already looks different from the earlier failing snapshot, so I’m re-running typecheck first to avoid fixing stale diagnostics and only patch what still fails right now.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

Typecheck is now passing cleanly. I’m doing one quick submodule health check next to address the “failed to fetch submodules” warning directly.

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

All clear now.

- Fixed the TS error in `frontend/src/lib/vanity/vanityWasmRuntime.ts` by handling both `WebAssembly.instantiate` return shapes safely (`Instance` vs `WebAssemblyInstantiatedSource`).
- Ran `git submodule update --init --recursive` successfully to address the submodule fetch warning path.
- Re-ran `pnpm -C frontend typecheck` and it passes (`tsconfig.app.json` + `tsconfig.node.json`).

About the remaining log lines:
- `(node:..., thread:...) WARNING: Exited the environment with code 0` are informational process-exit notices, not failures.  
- Exit code `0` means success.

