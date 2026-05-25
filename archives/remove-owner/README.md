# Archived: remove-owner + Relay owner-mutation lane

Retired **2026-05-25**. The `/remove-owner` flow and its Relay deposit + solver-fill stack were archived alongside the user add-owner retirement.

## What lived here

- **`/remove-owner` page** — `RemoveOwner.tsx`, `useRemoveOwnerFlow`, action/status panels
- **API** — `POST /api/onboarding/preview-remove-owner`
- **Relay proxy routes** — `/api/relay/execute`, `/api/relay/quote`, `/api/relay/notify-deposit`, `/api/relay/intent-status`
- **Client execution** — `ownerMutationExecution.ts`, `submitRelayPart1SelfFunded.ts`, Part 1 deposit lookup, bundler transport
- **Shared owner-mutation UI** — `ownerMutation/OwnerMutationStepFlow.tsx`, funding guide
- **Server Relay helpers** — `buildOwnerMutationRelayFlow.ts`, `getQuote.ts`, `notifyRelaySolverDeposit.ts`

## What was **not** archived (still in tree)

- **Deploy-session cleanup** — `removeOwnerAtIndex` in deploy v2 session handlers (temporary owner removal during deploy automation)
- **Paymaster gates** — `removeOwnerAtIndex` sponsorship rules in `paymaster/_paymaster.ts`
- **Server agent delegation** — `preview-agent-owner`, `provision-agent-owner`
- **Add-owner archive** — `archives/add-owner/` (separate user-facing add-owner UI/API)

## Restoring (operator-only)

1. Move paths back from this folder mirroring `frontend/` layout.
2. Re-register API routes in `frontend/api/_handlers/_routes.ts`.
3. Re-add `/remove-owner` in `routeDefinitions.tsx` + `lazyRoutes.tsx`.
4. Restore Relay route handlers under `frontend/api/_handlers/relay/`.

Do not restore without re-validating Base App / passkey / session-key signing behavior on target CSWs.
