---
title: Raw digest signing
sidebar_label: 44ac1198…
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
# Raw digest signing
| Field | Value |
| --- | --- |
| Session ID | `44ac1198-bead-406a-8f55-e75560150a12` |
| Review model | Cursor Fable 5 (`claude-fable-5-thinking-high`) |
:::note Appendix record
Readable export of an agent-assisted review session. Tool outputs and system context blocks are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## User

<timestamp>Friday, Jun 12, 2026, 6:57 AM (UTC-7)</timestamp>
Raw digest signing is unavailable for this wallet session. Reconnect the embedded signer (Sign in with Base / Privy embedded EOA) and retry. Method failures: secp256k1_sign: Disconnected | eth_sign: Disconnected

## Assistant

I’m going to trace where this exact raw-digest signing error is produced, then patch the signer-gate/recovery flow so disconnected embedded sessions route users cleanly back through Base/Privy reconnect instead of getting stuck on opaque method failures.

*Tools invoked:* rg, rg

## Assistant

*Tools invoked:* ReadFile, ReadFile

## Assistant

I found the root cause: the refresh/retry path only triggers on “missing auth token”, so “Disconnected” never gets a recovery attempt. I’m updating the signer helper to treat disconnected-session errors as refreshable, then adding tests for that exact failure shape.

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* ApplyPatch

## Assistant

*Tools invoked:* Shell

## Assistant

*Tools invoked:* Shell

## Assistant

*Tools invoked:* ReadLints

## Assistant

Updated the raw-digest signer recovery flow so your exact failure case (`secp256k1_sign: Disconnected | eth_sign: Disconnected`) now triggers a session refresh/retry automatically instead of immediately hard-failing.

- Added disconnected-session detection in `frontend/src/lib/wallet/signRawEcdsaDigest.ts` (`Disconnected`, wallet/provider disconnected variants).
- Wired those errors into the same refresh path already used for missing-auth-token failures.
- Added regression coverage in `frontend/src/lib/wallet/signRawEcdsaDigest.test.ts` for disconnected signer sessions.
- Verified with: `pnpm -C frontend exec vitest run "src/lib/wallet/signRawEcdsaDigest.test.ts"` (10/10 tests passing).

If you retry the flow now, disconnected embedded sessions should attempt a refresh first (Sign in with Base / embedded Privy session) before surfacing a final error.

