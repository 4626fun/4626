# Thin Waitlist And Accounts Architecture

This is the canonical product model for identity onboarding:

- Marketing waitlist entry lives in `frontend/src/components/waitlist/ThinWaitlistFlow.tsx`.
- Waitlist requires email, creates auth quietly in the background, and treats Zora as optional.
- `frontend/src/pages/accounts/AccountsPage.tsx` is the identity hub for linked methods, Zora refresh, and advanced owner actions.
- Accepted users who choose `Enter App` continue through `frontend/src/pages/AppContinue.tsx`, which completes cross-origin auth handoff and then sends them to the canonical app landing route.

Source of truth by concern:

- Waitlist entry + email capture: `frontend/api/_handlers/waitlist/*`
- Linked identity state + scoring: `frontend/api/_handlers/accounts/*` and `frontend/server/_lib/accountsIdentity.ts`
- Zora discovery + canonical CSW refresh: `frontend/api/_handlers/zora/*`
- Cross-origin auth/session continuation: `frontend/api/_handlers/auth/_handoff-create.ts`, `frontend/api/_handlers/auth/_handoff-redeem.ts`, and `frontend/src/pages/AppContinue.tsx`
- Advanced canonical-wallet owner actions: `frontend/src/pages/accounts/AccountsPage.tsx`

Legacy note:

- The older heavy waitlist flow and its private step/hook files were removed after the thin waitlist convergence pass.
- New product work should build on `frontend/src/components/waitlist/ThinWaitlistFlow.tsx`, `frontend/src/pages/Waitlist.tsx`, and `frontend/src/pages/accounts/AccountsPage.tsx`.
