# Thin Waitlist And Accounts Architecture

This is the canonical product model for identity onboarding:

- Marketing waitlist entry lives in `frontend/src/features/waitlist/WaitlistFlow.tsx`.
- Waitlist and account creation are explicitly **email-first**.
- Verified email is the canonical 4626 identity and recovery key.
- No account is fully created until email OTP verification completes.
- Privy is the auth/session backend and should create the embedded EOA during signup/auth.
- Every fully onboarded account must have a Privy embedded EOA.
- After verified email + embedded EOA creation, signed-in users stay on `/waitlist` for the setup-first workspace: Zora linking, canonical CSW detection, owner-install status, and the gated `Enter App` handoff.
- `frontend/src/pages/accounts/AccountsPage.tsx` is now the advanced settings and recovery backstop: linked identities, Telegram/browser escapes, secondary owner actions, and recovery-only tooling.
- Accepted users who choose `Enter App` continue through `frontend/src/features/waitlist/WaitlistFlow.tsx` + `frontend/src/features/waitlist/waitlistHandoff.ts`, and `frontend/src/hooks/useSiweAuth.ts` redeems the `cv_handoff` code before routing to the canonical app landing route.
- Telegram, Base app, and website must all converge into the same verified-email-based account model.
- Normal web auth should expose email first, then Base and Zora as optional native entry paths.

Source of truth by concern:

- Waitlist entry + email capture: `frontend/api/_handlers/_routes.waitlist.ts` and `frontend/api/_handlers/waitlist/_bootstrap.ts`
- Signed-in setup workspace shell: `frontend/src/features/waitlist/WaitlistFlow.tsx` and `frontend/src/features/waitlist/WaitlistSetupWorkspace.tsx`
- Shared setup-first account modules: `frontend/src/features/accountSetup/AccountSetupWorkspaceView.tsx`, `frontend/src/features/accountSetup/useAccountSetupController.ts`, and `frontend/src/features/accountSetup/shared.ts`
- Linked identity state + scoring: `frontend/api/_handlers/accounts/_me.ts` and `frontend/server/_lib/accountsIdentity.ts`
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
- If the user has a canonical Coinbase Smart Wallet, the Privy embedded EOA must be installed as an owner on it.
- If the user does not yet have a CSW, route them to Base app referral flow, then resume owner-installation on return.
- Wallet-dependent execution should stay gated until CSW owner confirmation succeeds.

Owner-install references:

- `docs/operations/canonical-csw-owner-approval.md`
- `docs/guides/troubleshooting/activate-account-signing.md`

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
