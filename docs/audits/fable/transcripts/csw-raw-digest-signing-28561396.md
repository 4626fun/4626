---
title: CSW raw digest signing
sidebar_label: 28561396…
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
# CSW raw digest signing
| Field | Value |
| --- | --- |
| Session ID | `28561396-9d5f-4896-aabd-a3facc865cc4` |
| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |
:::note Appendix record
Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## User

<timestamp>Thursday, Jun 11, 2026, 11:17 PM (UTC-7)</timestamp>
Sending from your Coinbase Smart Wallet
Your wallet must support raw digest signing (secp256k1_sign) for smart-wallet Permit2. Reconnect and try again.

## Assistant

I’m going to trace where that exact error string is raised in the swap/signing flow, then patch the wallet capability check so Coinbase Smart Wallet paths don’t get blocked incorrectly if they can use the supported signing lane.

*Tools invoked:* rg, rg, rg

## Assistant

I found the exact throw site and the label source; next I’m checking the signer fallback logic and where this gets invoked in `/swap` so we can fix the false failure path for Coinbase Smart Wallet sends.

*Tools invoked:* ReadFile, ReadFile, ReadFile

## Assistant

*Tools invoked:* rg

## Assistant

*Tools invoked:* ReadFile, rg, rg

## Assistant

*Tools invoked:* ReadFile

## Assistant

*Tools invoked:* rg

## Assistant

*Tools invoked:* rg

## Assistant

*Tools invoked:* ReadFile

## Assistant

*Tools invoked:* ReadFile

## Assistant

*Tools invoked:* rg

## Assistant

I’ve isolated the failing helper; now I’m checking `Swap.tsx` wiring to confirm whether canonical CSW Permit2 is accidentally using the wrong signer wallet client (which would explain this exact error).

*Tools invoked:* rg

## Assistant

*Tools invoked:* ReadFile

## Assistant

I found the likely root cause: raw-signing currently only tries a narrow parameter shape, so some CSW-compatible providers can still fail and trigger that exact message. I’m patching `signRawEcdsaDigest` to try additional compatible RPC shapes and updating the user-facing error copy.

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* ApplyPatch

## Assistant

I’ve applied the fix and a regression test; next I’ll run the targeted test file and quick lints on touched files to verify this is clean.

*Tools invoked:* Shell, ReadLints

## Assistant

Adjusted the swap signer path so Coinbase Smart Wallet Permit2 signing is more tolerant and no longer fails on one narrow RPC shape.

- Updated `frontend/src/lib/wallet/signRawEcdsaDigest.ts` to try multiple raw-sign RPC variants before failing:
  - `secp256k1_sign` with digest-only and address+digest
  - `eth_sign` with address+digest, digest+address, and digest-only
- Updated the thrown error copy to reflect both supported raw-sign methods (`secp256k1_sign` **or** `eth_sign`) instead of only one.
- Added regression coverage in `frontend/src/lib/wallet/signRawEcdsaDigest.test.ts` for secp fallback to `eth_sign`.

Validation:
- `pnpm -C frontend exec vitest run src/lib/wallet/signRawEcdsaDigest.test.ts` passes.
- No lints on touched files.

Try the same swap again from the Coinbase Smart Wallet lane. If it still fails, I can add debug-level error capture for which exact method/shape your provider rejects so we can pinpoint the remaining provider-specific mismatch quickly.

## User

<timestamp>Thursday, Jun 11, 2026, 11:19 PM (UTC-7)</timestamp>
Your wallet must support raw digest signing (secp256k1_sign or eth_sign) for smart-wallet Permit2. Reconnect and try again.

## Assistant

I’ll inspect the live dev logs now to capture the exact RPC method failures behind this message, then I’ll patch the signer helper to support the provider’s actual method shape.

*Tools invoked:* ReadFile

## Assistant

I found a second likely cause: we currently treat some embedded wallets as “can sign” even when they only expose `signMessage` and no RPC provider, which still fails for raw digest signing at runtime. I’m tightening that gate now so this fails earlier with the correct setup prompt instead of this Permit2 error.

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* ReadLints, Shell

## Assistant

Pushed another fix for this exact runtime path.

What changed:
- `frontend/src/lib/wallet/signRawEcdsaDigest.ts`
  - Added broader raw-sign RPC fallback attempts (`secp256k1_sign` + multiple `eth_sign` param shapes).
- `frontend/src/lib/swap/useSwapEmbeddedEoa.ts`
  - Tightened embedded-signer readiness: we no longer treat `signMessage`-only wallets as “ready” for canonical Permit2 signing.
  - This avoids reaching the raw-digest signer with an unusable wallet shape and surfacing that misleading error.

Validation:
- Targeted test still passes: `src/lib/wallet/signRawEcdsaDigest.test.ts`
- No lint issues on touched files.

Please refresh and retry the swap flow once.  
If it still fails, paste the new error text (or first console error line) and I’ll wire exact per-method failure telemetry so we can identify the provider mismatch immediately.

## User

<timestamp>Thursday, Jun 11, 2026, 11:26 PM (UTC-7)</timestamp>
Your wallet must support raw digest signing (secp256k1_sign or eth_sign) for smart-wallet Permit2. Reconnect and try again.

## Assistant

I’m going to make this error actionable instead of generic by surfacing the actual method failures (`secp256k1_sign`/`eth_sign`) and adding a targeted reconnect hint for the Base/Privy signer lane.

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* Shell, ReadLints

## Assistant

Made another targeted fix so this failure is no longer opaque.

### What changed
- `signRawEcdsaDigest` now returns a **detailed error** listing each failed RPC attempt (`secp256k1_sign` / `eth_sign` shapes), instead of only the generic message.
- Added explicit hint in that error to reconnect the **Privy embedded/Base signer session**.
- Tests updated and passing (`4/4`) for the signer helper.

### Why this matters
Right now the blocker is likely provider/session-shape specific (not just “wallet unsupported”). This patch gives us the exact failing methods/messages so we can finish the fix in one pass.

### Next step
Retry the same swap once and paste the **full new error text** (it should include `Method failures:` with per-method reasons).  
That will tell me exactly which provider path to support next.

