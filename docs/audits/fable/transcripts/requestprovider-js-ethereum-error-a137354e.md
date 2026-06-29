---
title: requestProvider.js ethereum error
sidebar_label: a137354e…
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
# requestProvider.js ethereum error
| Field | Value |
| --- | --- |
| Session ID | `a137354e-3778-4401-9e5e-2bd4be691a10` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Wednesday, Jun 10, 2026, 10:42 AM (UTC-7)</timestamp>
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
requestProvider.js:2 Uncaught TypeError: Cannot set property ethereum of #<Window> which has only a getter
    at requestProvider.js:2:585532
    at requestProvider.js:2:585712
    at requestProvider.js:2:585716
    at requestProvider.js:2:585720
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
(anonymous) @ requestProvider.js:2
injected.js:110 Uncaught ReferenceError: injected is not defined
    at injected.js:110:1
(anonymous) @ injected.js:110
injected.js:110 Uncaught ReferenceError: injected is not defined
    at injected.js:110:1
(anonymous) @ injected.js:110
evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum
    at Object.defineProperty (<anonymous>)
    at r.inject (evmAsk.js:15:5093)
    at Nv.window.addEventListener.once (evmAsk.js:15:9013)
inject @ evmAsk.js:15
Nv.window.addEventListener.once @ evmAsk.js:15
await in Nv.window.addEventListener.once
Fr @ contentScript.js:1
(anonymous) @ contentScript.js:1
(anonymous) @ contentScript.js:1
evmAsk.js:15 Uncaught TypeError: Cannot redefine property: ethereum
    at Object.defineProperty (<anonymous>)
    at r.inject (evmAsk.js:15:5093)
    at Nv.window.addEventListener.once (evmAsk.js:15:9013)
inject @ evmAsk.js:15
Nv.window.addEventListener.once @ evmAsk.js:15
await in Nv.window.addEventListener.once
Fr @ contentScript.js:1
(anonymous) @ contentScript.js:1
(anonymous) @ contentScript.js:1
bindings_wasm.js:3013 ERROR xmtp_mls::groups::welcome_sync: failed to create group from welcome=[sid(194832146):oid( 11)] created at 1781107601: welcome with cursor [[sid(194832146):oid( 11)]] already processed

(anonymous) @ bindings_wasm.js:3013
consoleNoisePatch.ts:37 Cannot update a component (`DeployVaultMain`) while rendering a different component (`Hydrate`). To locate the bad setState() call inside `Hydrate`, follow the stack trace as described in https://react.dev/link/setstate-in-render

## Analysis

I’m going to trace these as two separate regressions: wallet-provider injection collisions (`window.ethereum` redefine/getter) and the React `setState` during `Hydrate` in `DeployVault`. I’ll inspect the relevant hooks/config and patch both so the app ignores hostile extension injection and defers state updates until after hydration.

*Tools invoked:* rg, rg, rg, rg

## Analysis

*Tools invoked:* ReadFile, ReadFile, ReadFile, ReadFile, ReadFile

## Analysis

I found existing guards for extension collisions, so the wallet errors are mostly extension-side noise, but the `Hydrate` warning likely comes from a render-phase update inside `DeployVault`. I’m now inspecting the top-level deploy page initialization path for any setter called during render and will patch it to run in an effect.

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile, ReadFile, ReadFile, ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* rg

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

I’ve identified a low-risk mitigation path: gate EIP-6963 `requestProvider` dispatch when `window.ethereum` is already locked, and mount the heavy deploy surface only after first commit to avoid the `Hydrate` render-phase update warning. I’m applying both now.

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* AwaitShell

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

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

*Tools invoked:* ReadLints

## Analysis

Patched both problem lanes in app code:

- **Wallet injection collision hardening** in `frontend/src/config/wagmi.ts`  
  - Added a startup collision check (`detectEthereumProviderCollision()`).
  - When collision is detected (locked/getter-only `window.ethereum`, multiple injected providers, or persisted collision signal), the app now **skips EIP-6963 `requestProvider` dispatch** entirely.
  - This prevents our app from triggering extension races that throw:
    - `Cannot set property ethereum of #<Window> which has only a getter`
    - `Cannot redefine property: ethereum`

- **Hydration/render-state warning fix** in `frontend/src/pages/deploy/DeployVault.tsx`  
  - `DeployVault` now gates heavy mount until first post-hydration commit using `useDeferUntilAfterCommit()`.
  - While waiting one commit, it renders a small loading shell.
  - This avoids `DeployVaultMain` state updates during `Hydrate` render and removes:
    - `Cannot update a component (DeployVaultMain) while rendering a different component (Hydrate)`

Validation:

- `pnpm -C frontend typecheck` ✅
- lints on edited files ✅

About the remaining console lines you pasted:

- `requestProvider.js`, `evmAsk.js`, `injected.js` stack traces are **extension-side scripts**, not your app bundle.
- `xmtp_mls ... welcome ... already processed` is typically a non-fatal duplicate-welcome sync noise event.
- If you still see noisy wallet collisions, quickest runtime fix is still to keep one EVM extension enabled per profile (or use Base App/Coinbase-only profile).

