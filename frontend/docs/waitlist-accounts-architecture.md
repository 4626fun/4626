# Thin Waitlist And Accounts Architecture

This is the canonical product model for identity onboarding:

- Marketing waitlist entry lives in `frontend/src/components/waitlist/ThinWaitlistFlow.tsx`.
- Waitlist and account creation are explicitly **email-first**.
- Verified email is the canonical 4626 identity and recovery key.
- No account is fully created until email OTP verification completes.
- Privy is the auth/session backend and should create the embedded EOA during signup/auth.
- Every fully onboarded account must have a Privy embedded EOA.
- `frontend/src/pages/accounts/AccountsPage.tsx` is the identity hub for linked methods, Zora refresh, and advanced owner actions.
- Accepted users who choose `Enter App` continue through `frontend/src/pages/AppContinue.tsx`, which completes cross-origin auth handoff and then sends them to the canonical app landing route.
- Telegram, Base app, and website must all converge into the same verified-email-based account model.
- Normal web auth should expose email first, then Base and Zora as optional native entry paths.

Source of truth by concern:

- Waitlist entry + email capture: `frontend/api/_handlers/waitlist/*`
- Linked identity state + scoring: `frontend/api/_handlers/accounts/*` and `frontend/server/_lib/accountsIdentity.ts`
- Zora discovery + canonical CSW refresh: `frontend/api/_handlers/zora/*`
- Cross-origin auth/session continuation: `frontend/api/_handlers/auth/_handoff-create.ts`, `frontend/api/_handlers/auth/_handoff-redeem.ts`, and `frontend/src/pages/AppContinue.tsx`
- Advanced canonical-wallet owner actions: `frontend/src/pages/accounts/AccountsPage.tsx`
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

Legacy note:

- The older heavy waitlist flow and its private step/hook files were removed after the thin waitlist convergence pass.
- New product work should build on `frontend/src/components/waitlist/ThinWaitlistFlow.tsx`, `frontend/src/pages/Waitlist.tsx`, and `frontend/src/pages/accounts/AccountsPage.tsx`.
- If an older auth path conflicts with `frontend/docs/account-auth-invariants.md`, remove or migrate it rather than preserving it.
