# Thin Waitlist And Accounts Architecture

> **Repo-wide canonical:** [docs/ACCOUNT_MODEL.md](../../docs/ACCOUNT_MODEL.md) is the single source of truth for the account model (populations, invariants, schema). This file remains authoritative for *waitlist + accounts product behaviour* specifically, but the underlying account model it builds on is in ACCOUNT_MODEL.md.

This is the canonical product model for identity onboarding:

- Marketing waitlist entry lives in `frontend/src/features/waitlist/WaitlistFlow.tsx`.
- Waitlist and account creation are explicitly **email-first**.
- Verified email is the canonical 4626 identity and recovery key.
- No account is fully created until email OTP verification completes.
- Privy is the auth/session backend and should create the embedded EOA during signup/auth.
- Every fully onboarded account must have a Privy embedded EOA.
- After verified email + embedded EOA creation, signed-in users stay on `/waitlist` for the setup-first workspace: Zora linking, canonical CSW detection, sub-account setup status (for CSW users — per [docs/4626-connection-methods.md](../../docs/4626-connection-methods.md) Section 2), and the gated `Enter App` handoff.
- `frontend/src/pages/accounts/AccountsPage.tsx` is now the advanced settings and recovery backstop: linked identities, Telegram/browser escapes, secondary owner actions, and recovery-only tooling.
- Accepted users who choose `Enter App` continue through `frontend/src/features/waitlist/WaitlistFlow.tsx` + `frontend/src/features/waitlist/waitlistHandoff.ts`, and `frontend/src/hooks/useSiweAuth.ts` redeems the `cv_handoff` code before routing to the canonical app landing route.
- Telegram, Base app, and website must all converge into the same verified-email-based account model.
- Normal web auth should expose email first, then Base and Zora as optional native entry paths.

Source of truth by concern:

- Waitlist entry + email capture: `frontend/api/_handlers/_routes.waitlist.ts` and `frontend/api/_handlers/waitlist/_bootstrap.ts`
- Signed-in setup workspace shell: `frontend/src/features/waitlist/WaitlistFlow.tsx` and `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx`
- Shared setup-first account modules: `frontend/src/features/accountSetup/AccountSetupWorkspaceView.tsx`, `frontend/src/features/accountSetup/useAccountSetupController.ts`, and `frontend/src/features/accountSetup/shared.ts`
- Linked identity state + scoring: `frontend/api/_handlers/accounts/_me.ts` and `frontend/server/_lib/identity/accountsIdentity.ts`
- Zora discovery + canonical CSW refresh: `frontend/api/_handlers/_routes.zora.ts` and `frontend/api/_handlers/zora/_resolve.ts`
- Cross-origin auth/session continuation: `frontend/api/_handlers/auth/_handoff-create.ts`, `frontend/api/_handlers/auth/_handoff-redeem.ts`, `frontend/src/features/waitlist/waitlistHandoff.ts`, and `frontend/src/hooks/useSiweAuth.ts`
- Advanced linked-identity / recovery surface: `frontend/src/pages/accounts/AccountsPage.tsx`
- Product-level auth invariants: `frontend/docs/account-auth-invariants.md`

Telegram-specific rules:

- Telegram is a linked identity and onboarding surface, not the canonical recovery key.
- Telegram-launched flows must keep Mini App session verification enabled.
- Telegram onboarding must collect and verify email inside the Mini App.
- If the verified email already exists, attach Telegram to that existing account.
- If Telegram is already attached to a different account, require explicit recovery/merge UX.

Wallet invariants:

- The Privy embedded EOA is created during signup/auth and must exist for every fully onboarded account.
- For user-initiated frontend execution (CSW users, `executionMode === 'canonical'`): the canonical path is **parent CSW + Privy embedded-owner signer** (`legacy-owner-install`), not sub-account setup. The Privy embedded EOA is installed as a direct owner of the parent CSW, which becomes the default execution address via `canonical4337`. The parent CSW (`profiles.csw_address`) is both the canonical asset-holding account and the default execution address. An app-scoped sub-account (`profiles.base_sub_account`) is optional infrastructure — flag-gated, swap-only fallback that stays dormant unless both `WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` and `VITE_WAITLIST_SUBACCOUNT_FLOW_ENABLED=1` are explicitly enabled. It must not be shown as the primary execution account unless the active route actually sends from it.
- For user-initiated frontend execution (external EOA users, `executionMode === 'eoa'`): no sub-account; the wallet signs transactions directly.
- If the user does not yet have a CSW, route them to Base app referral flow, then resume embedded-owner signing setup for the canonical parent CSW on return. Do not make waitlist onboarding explicitly create a sub-account.
- Wallet-dependent execution should stay gated until the appropriate track's readiness check succeeds — canonical parent CSW recorded in `profiles.csw_address`, Privy embedded EOA present in `profiles.primary_embedded_eoa`, and the embedded EOA confirmed as an owner/signing authority for the parent CSW (CSW track), or connected EOA for the EOA track.
- **Server-side delegation** (deploy-session, XMTP agent, ERC-8004 identity) is orthogonal — it uses direct owner delegation on the parent CSW per `.cursor/rules/csw-agent-lifecycle.mdc`.

Architecture and operational references:

- Canonical architecture: [docs/4626-connection-methods.md](../../docs/4626-connection-methods.md)
- Owner-install reference methods runbook (legacy/server lanes and current relay path): `docs/operations/owner-install-reference-methods.md`
- User-initiated troubleshooting: `docs/guides/troubleshooting/activate-account-signing.md`

Implementation posture:

- Session restoration is handled centrally through `frontend/src/hooks/useSiweAuth.ts`.
- New UI surfaces should reuse that session path rather than layering separate `/api/auth/me` refresh loops.
- Canonical account-context lookup should be deferred until a signer exists; disconnected route loads should not eagerly fetch wallet topology that cannot yet be used.
- Provider-heavy surfaces should be route-scoped or user-intent-gated where practical.
- `frontend/src/pages/Waitlist.tsx` is allowed to widen provider coverage for the signed-in setup workspace, but signed-out marketing/waitlist entry should stay comparatively light.

Legacy note:

- The older heavy waitlist flow and its private step/hook files were removed after the thin waitlist convergence pass.
- New product work should treat `/waitlist` as the default post-auth setup surface and `/accounts` as the advanced backstop.
- New product work should build on `frontend/src/features/waitlist/WaitlistFlow.tsx`, `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx`, `frontend/src/features/accountSetup/AccountSetupWorkspaceView.tsx`, `frontend/src/features/accountSetup/useAccountSetupController.ts`, `frontend/src/pages/Waitlist.tsx`, and `frontend/src/pages/accounts/AccountsPage.tsx`.
- If an older auth path conflicts with `frontend/docs/account-auth-invariants.md`, remove or migrate it rather than preserving it.

## Telegram Flow Routing Boundary

Telegram onboarding/linking flows must remain isolated from normal app routing and waitlist gating.

### Rules

- `/telegram/link` runs only on `app.4626.fun`
- The route is valid when:
  - Telegram Mini App context is present, OR
  - Telegram link query parameters are present

### Separation from Waitlist Flow

- Valid Telegram flows must bypass normal waitlist gating.
- Waitlist acceptance logic must not reassert control once Telegram flow begins.
- Telegram onboarding must not depend on general app session state.

### Rationale

Telegram flows:

- begin from an external trusted context (Telegram)
- require their own identity verification (Telegram + email)
- must not be interrupted by unrelated app routing logic

Mixing these flows leads to:

- state resets
- UI flicker
- incorrect account resolution
