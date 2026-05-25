# Archived: user add-owner / Enable 4626 signing

Retired **2026-05-25**. The Relay + Base App owner-install lane (`preview-add-owner`, `AddOwnerSigningPanel`, `/add-owner`) was archived after repeated signer-lane failures (passkey vs session-key vs substituted ECDSA).

## What lived here

- Waitlist **Step 2 — Enable 4626 signing** UI (`AddOwnerSigningPanel`, `useAddOwnerFlow`)
- Standalone `/add-owner` page
- API: `POST /api/onboarding/preview-add-owner`, `POST /api/wallet/prepare-add-*`, `POST /api/wallet/confirm-owner`
- Client libs under `frontend/src/lib/addOwner/`
- Ops runbooks under `docs/operations/` (owner-install reference, session-key Part 1 recipe, etc.)

## What was **not** archived (still in tree)

- **Server agent delegation**: `preview-agent-owner`, `provision-agent-owner` (deploy/XMTP automation)
- **Remove-owner** flow (`/remove-owner`) — shares `frontend/src/lib/relay/ownerMutationExecution.ts` and Part 1 self-funded submit
- **DeployVault / AdminAgentSetup** `addOwnerAddress` for deploy-session batching (different product track)
- **Execution track** reads (`legacy-owner-install`) for gating and `/api/accounts/me`

## Restoring (operator-only)

1. Move paths back from this folder mirroring `frontend/` and `docs/` layout.
2. Re-register API routes in `frontend/api/_handlers/_routes.ts`.
3. Re-add `/add-owner` in `frontend/src/app/routeDefinitions.tsx` + `lazyRoutes.tsx`.
4. Remount `AddOwnerSigningPanel` in `AccountSetupWorkspaceView.tsx`.
5. Re-enable waitlist step-2 gating in `WaitlistSetupWorkspace.tsx` if product requires signing before app entry.

Do not restore without re-validating Coinbase/Base App signing behavior on a passkey-first CSW.
