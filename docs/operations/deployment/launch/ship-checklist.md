---
title: Ship Checklist
---

# Ship Checklist

This is the shortest path from the current repo state to a real 4626 launch.

If you only keep one rule in mind: the canonical production path is the frontend `/deploy` flow.

## Launch bar

The app is launchable when all of these are true:

- Users can sign in, reach `/deploy`, and complete the one-time owner-install flow.
- The deploy-session server can continue the deploy after the one user approval.
- The canonical wallet invariants hold: the canonical Coinbase Smart Wallet stays the sender/account.
- The frontend builds cleanly and the launch-critical tests pass.
- Deploy-session infra env vars are present in production.
- Post-launch verification can prove the deploy reached the expected onchain state.

## In scope for day one

- `/deploy` session creation and continuation
- Wallet ownership verification and canonical CSW routing
- Core launch verification and deployment docs
- Launch-critical build, typecheck, and deploy-session tests

## Out of scope for day one

- Bonus social-point actions that are not required to launch the app
- CSW proof CTA UX unless the `VITE_WAITLIST_CSW_PROOF` flag is explicitly enabled
- Legacy admin-only helpers that do not represent the production launch path

## Launch order

1. Confirm production env vars.
2. Run the frontend build and launch-critical tests.
3. Verify the deploy path in a local or staging-like environment.
4. Launch via `/deploy`.
5. Confirm the deploy-session status reaches completion.
6. Verify the vault and image/strategy readiness checks.

## Production requirements

Frontend:

- `VITE_DEPLOY_USE_SERVER_CONTINUE=true`
- `VITE_CDP_PAYMASTER_URL=/api/paymaster`

Server:

- `CDP_PAYMASTER_URL`
- `AUTH_SESSION_SECRET`
- `CANONICAL_ORIGIN`
- `DATABASE_URL`
- `DEPLOY_SESSION_TOKEN_HMAC_SECRET`
- `PRIVY_APP_ID`
- `PRIVY_APP_SECRET`
- `PRIVY_WALLET_AUTHORIZATION_KEY`
- `PRIVY_WALLET_OWNER_ID`

Solana deploy-session preflight (server, required when Solana strategy is enabled):

- `DEPLOY_SOLANA_REGISTRATION_SECRET`
- `APP_ORIGIN` or `DEPLOY_SOLANA_REGISTRATION_ORIGINS` (for internal registration origin resolution)

## Verification checkpoints

- `/api/deploy/session/status` advances through the expected phases.
- Deploy-session progression covers `phase3_sent -> phase4_sent -> completed` with no Solana preflight error.
- `/api/v1/token/<shareOFT>/image?chain=8453&format=png` returns a non-empty image.
- The vault status page shows the expected strategy and wallet wiring.
- The deploy-session flow does not rely on same-origin paymaster/proxy fallback in production.
- Charm vaults are deployed with a non-zero `rebalanceDelegate` and validated TWAP/tick guard defaults.
- CRE runs a single canonical Charm producer/executor lane (`strategy-signal-listener` -> `keepr-action-queue`) unless explicitly overridden.
- CSW owner-index drift recovery steps are documented and tested (`docs/operations/deployment/csw-owner-index-drift-recovery.md`).
- Solana registration and infra checks pass in API tests (`deployRegisterSolanaBridgeToken`, `deploySolanaInfraStatus`).

## Rollback

If launch fails:

- Stop advancing deploy sessions.
- Keep the release behind the server-continue path until the missing env or ownership issue is fixed.
- Re-run the deploy-session and frontend checks before retrying production.
