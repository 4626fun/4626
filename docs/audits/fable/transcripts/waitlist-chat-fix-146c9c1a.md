---
title: Waitlist chat fix
sidebar_label: 146c9c1a…
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
# Waitlist chat fix
| Field | Value |
| --- | --- |
| Session ID | `146c9c1a-96c0-43f3-bdc2-8c0e369cfd8d` |
| Record type | Lead review session export |
:::note Appendix record
Readable export of a supplementary review session. Tool outputs and system context are omitted; download the [JSONL archive](/audits/fable-chats-4626-2026-06.zip) for the complete log.
:::
## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 4:08 AM (UTC-7)</timestamp>
can you please get hte waitlist chat to work plase

## Analysis

I’ll fix the waitlist chat flow directly and verify it locally. First I’m going to inspect the current dev server output and then trace the waitlist chat components/providers to find what’s blocking rendering or message send.

*Tools invoked:* ReadFile, rg

## Analysis

I found a likely lead: the waitlist XMTP status API is timing out against Postgres in your running session, which can keep the chat stuck. Next I’m checking the waitlist chat component and status hook to harden this path so chat can still initialize when status calls fail.

*Tools invoked:* ReadFile, ReadFile, ReadFile, ReadFile

## Analysis

*Tools invoked:* rg

## Analysis

*Tools invoked:* ReadFile, ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadFile

## Analysis

I found a concrete frontend bug: one transient `/api/waitlist/xmtp-status` failure currently hard-blocks the chat UI even when we already have usable cached status data. I’m patching the panel to keep chat usable off the last known-good data and only hard-block when there is no status payload at all.

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell, Shell

## Analysis

*Tools invoked:* AwaitShell

## Analysis

I’ve applied the chat resilience fixes and tests are green; I’m now resolving one TypeScript error from the full typecheck before I wrap up.

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ReadLints

## Analysis

*Tools invoked:* Shell

## Analysis

I patched the waitlist chat path to make it resilient and stop getting stuck after transient status failures.

- In `frontend/src/features/waitlist/WaitlistGroupChatPanel.tsx`, chat no longer hard-fails when `xmtp-status` refetch errors but cached status data exists.
- It now keeps rendering chat using last known-good status and shows a warning banner instead of blocking the whole panel.
- In `frontend/api/_handlers/waitlist/_xmtpStatus.ts`, I added defensive fallbacks so DB/auth/query timeouts return a structured `service_unavailable` payload (HTTP 200) instead of bubbling into 500-style failures.

Validation done:
- Waitlist chat tests passed:
  - `src/features/waitlist/WaitlistGroupChatPanel.test.tsx`
  - `src/features/waitlist/useWaitlistChatJoin.test.ts`
- No lints on edited files.
- Full frontend typecheck still has **pre-existing unrelated errors** in `AccountSetupWorkspaceView.tsx` and `useMyReferralCode.ts` (not introduced by this patch).

One important note for your local run:
- Your current dev command is running with `DEPLOY_DRY_RUN_KEEP_DB_ENV=0`. That can break waitlist chat status/join because chat relies on DB-backed auth/status checks.
- If chat still won’t fully join locally, run without that flag (or set it to `1`) for waitlist testing.

## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 4:15 AM (UTC-7)</timestamp>
can you fix it for me

## Analysis

Yep — I’ll finish this by removing the remaining hard block so chat can still open/connect when waitlist status is temporarily unavailable, then I’ll run the waitlist chat tests again.

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* ReadLints

## Analysis

Done — I fixed the remaining blocker so the waitlist chat can actually open instead of getting stuck behind status errors.

What I changed:
- `frontend/src/features/waitlist/WaitlistGroupChatPanel.tsx`
  - Removed the hard stop for `joinBlockedReason === 'service_unavailable'`.
  - The panel now continues to show/connect the chat surface (when signing is ready), instead of forcing a “Retry status” dead-end.
  - Kept the warning banner so you still see when status refresh failed.
- `frontend/api/_handlers/waitlist/_xmtpStatus.ts` (from prior step)
  - Added safe fallbacks so transient DB/auth/status failures return a structured `service_unavailable` payload instead of crashing the flow.

Validation:
- Waitlist chat tests pass:
  - `src/features/waitlist/WaitlistGroupChatPanel.test.tsx`
  - `src/features/waitlist/useWaitlistChatJoin.test.ts`
- No lints on changed files.

Try now:
1. Refresh `/waitlist`.
2. Open group chat panel.
3. Click **Connect & join waitlist chat**.

If you want, I can also patch your local `dev:deploy-dry-run` workflow so waitlist chat paths keep DB auth by default while still using local batcher settings.

## Engagement brief

<timestamp>Tuesday, Jun 9, 2026, 4:18 AM (UTC-7)</timestamp>
yes

## Analysis

Perfect — I’ll patch the dry-run startup script so waitlist chat keeps DB/auth by default (while still supporting an explicit override when you need it), then I’ll sanity-check it.

*Tools invoked:* ReadFile

## Analysis

*Tools invoked:* ApplyPatch

## Analysis

*Tools invoked:* Shell

## Analysis

*Tools invoked:* Shell

## Analysis

Done — I patched the dry-run workflow so DB-backed routes (including waitlist chat) are on by default.

### What I changed
- Updated `frontend/scripts/dev-deploy-dry-run.sh`:
  - `DEPLOY_DRY_RUN_KEEP_DB_ENV` default is now `1` (was `0`)
  - Comment updated to clarify `0` is opt-in for DB-less runs only.

### Verified
- Script syntax check passed: `bash -n frontend/scripts/dev-deploy-dry-run.sh`

### Important for your current terminal
Your active command still explicitly sets:
`DEPLOY_DRY_RUN_KEEP_DB_ENV=0`
so it will keep disabling DB and can still break waitlist chat.

Restart with:

```bash
VITE_VAULT_VANITY_MAX_TRIES=1000000 DEPLOY_DRY_RUN_USE_LOCAL_BATCHER=1 pnpm -C frontend run dev:deploy-dry-run
```

(or set `DEPLOY_DRY_RUN_KEEP_DB_ENV=1` explicitly).

