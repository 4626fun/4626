# Agent prompt: Re-evaluate and clean up 4626 Privy setup

Copy this document into a new agent session when Privy identity, waitlist wallet linking, or provider modes need a clean redesign.

## Mission

Re-evaluate the entire Privy integration in this monorepo and produce a **clean, minimal, invariant-safe setup**. Prefer deleting/consolidating brittle remount/`clientId`/mode hacks over adding more workarounds. Do not ship a “second account model.”

Work in the repo root. Follow `AGENTS.md`, `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`, `.cursor/rules/csw-agent-lifecycle.mdc`, and waitlist/Telegram rules.

Before editing wallet/auth/Privy/CSW code, complete the AGENTS.md pre-edit checkpoint (invariant, files inspected, proposed edits, smallest safe diff, test vs prod, first validation command).

## Product truth (do not redesign)

1. **Verified email** = canonical 4626 identity / recovery key.
2. **Privy** = auth/session backend (email OTP + linked accounts). Every fully onboarded account needs a **Privy embedded EOA** (`profiles.primary_embedded_eoa`).
3. **Canonical asset-holding account** = Coinbase Smart Wallet at `profiles.csw_address` — **not** Privy Smart Wallet, not sub-account, not external EOA as custody.
4. For `executionMode === 'canonical'`: parent CSW is ERC-4337 sender; Privy embedded EOA signs as CSW owner (`canonical4337`).
5. Privy Smart Wallet / Base sub-account are **not** the canonical custody path. Waitlist must not promote them as primary identity.
6. Coinbase / Base Account linked via waitlist is **CSW identity**, not “active external signer,” when it is the user’s Coinbase Smart Wallet.
7. Telegram Mini App is a separate Privy surface (`telegram-link`); keep isolated from waitlist gating.
8. Localhost vs production: custom domain / iframe / loopback `clientId` issues are real — fix identity continuity first, not “more remounts.”

Canonical refs:

- `docs/_internal/ACCOUNT_MODEL.md`
- `docs/_internal/4626-connection-methods.md`
- `frontend/docs/account-auth-invariants.md`
- `frontend/docs/waitlist-accounts-architecture.md`

## Current setup to audit (likely overgrown)

Named modes in `frontend/src/lib/privy/providerConfig.ts`:

| Mode | Surface | Embedded wallets |
|------|---------|------------------|
| `default` | App shell | `createOnLogin: 'all-users'` (secure context) |
| `waitlist-email-only` | Marketing waitlist signup | off |
| `waitlist-returning-wallet` | Returning wallet sign-in | off |
| `waitlist-wallet-joined` | Post wallet-join waitlist | off |
| `telegram-link` | Telegram Mini App link entry | on |

Key files:

- `frontend/src/lib/privy/client.tsx` — provider mount, loopback `clientId`, remount-by-`key={mode}`
- `frontend/src/lib/privy/providerConfig.ts` / `clientAppearance.ts`
- `frontend/src/lib/privy/SmartWalletsRouteProvider.tsx`
- `frontend/src/lib/privy/waitForPrivyEmbeddedWalletAuthReady.ts`
- `frontend/src/lib/privy/embeddedWallet.ts`, `providerLink.ts`, `accessToken.ts`
- `frontend/src/pages/Waitlist.tsx` — mode selection
- `frontend/src/features/waitlist/WaitlistFlow.tsx` — join + wallet link
- `frontend/src/features/waitlist/WaitlistWalletProvision.tsx`, `useEnsurePrivySmartWallet.ts`
- `frontend/src/features/accountSetup/useAccountSetupController.ts`
- Server: `frontend/api/_handlers/auth/_privy.ts`, `frontend/server/_lib/wallet/walletMapping.ts`, `frontend/server/_lib/identity/accountsIdentity.ts`, `/api/accounts/link`

## Known failure modes (must eliminate or prove gone)

1. **Wrong Privy ID after email join**  
   Remounting Privy right after OTP (email-only → wallet-joined) + changing loopback `clientId` restored a *different* Privy session while the 4626 cookie stayed on the email-join user. Wallet SIWE / `/api/accounts/link` then attached Base/CSW to the wrong `privyUserId`.  
   Partial mitigation already landed: defer `waitlist-wallet-joined` until wallet connectors are needed (`walletLinkPrivyNeeded`); keep one loopback `clientId` across waitlist modes; wait for Privy ready/auth before link. **Re-evaluate whether mode remounts are still required** (Base App WebView historically needed `key={mode}`). Prefer one stable Privy tree + config switches if remount is no longer necessary.

2. **CSW misclassified as external EOA**  
   Coinbase/Base Account should map to smart_wallet / canonical CSW, not “Active external signer.”

3. **Localhost auth races**  
   `Missing auth token`, `wallets/authenticate` 401, “Error creating smart wallet” when SmartWallets / `createWallet` run before token settle. Waitlist uses `createOnLogin: 'off'`; provision paths must hydrate-first / wait for token.

4. **SIWE / accounts link 401** after join when Privy token and 4626 session diverge.

5. **Inconsistent Privy across pages** — unify provider config; don’t invent parallel Privy apps/providers per page unless product requires it.

## What “clean setup” means (deliverables)

1. **Architecture memo** (short): one diagram of Privy surfaces (waitlist marketing, waitlist joined, app shell, telegram-link), when embedded wallets create, when SmartWallets mount, how `privyUserId` binds to `profiles`, how CSW links.
2. **Target state design**: fewest modes/remounts that still satisfy Base App WebView + waitlist lightness + telegram isolation. Explicitly decide:
   - Keep or kill remount-by-mode
   - Keep or kill separate waitlist `clientId` overrides
   - When embedded EOA is created (join vs app handoff vs telegram)
   - Whether Privy SmartWallets are needed on waitlist at all
3. **Implementation**: migrate to that target; remove dead modes/shims; keep identity continuity: **same Privy user from email OTP through CSW link**.
4. **Hard invariants in tests** (behavior, not string checks):
   - Email OTP user id === user id used for wallet link / `X-Privy-Token`
   - Linking Coinbase/Base Account sets/refreshes canonical CSW, does not demote it to external EOA when it is CSW
   - Waitlist does not auto-create embedded wallets on login (`createOnLogin: 'off'`)
   - Mode/clientId changes do not swap Privy identity mid-session on localhost
5. **Manual verify checklist** for localhost + `4626.fun` / `app.4626.fun`:
   - Fresh browser → email OTP → confirm Privy id → connect Base/CSW → same Privy id + correct `csw_address`
   - Returning wallet sign-in
   - App shell after handoff
   - Telegram link path still isolated

## Constraints

- Do **not** make Privy Smart Wallet or sub-account the canonical custody account.
- Do **not** auto-create a new Coinbase Smart Wallet.
- Do **not** silently switch primary account to Privy Smart Wallet.
- Do **not** remount Privy solely because email join succeeded.
- Do **not** change production Hermit/Eliza/XMTP runtime model config while doing this.
- Prefer smallest safe diffs; if a rewrite is needed, stage it (design → delete remount hacks → unify provider → fix link path → tests).
- Validation honesty: report exact commands and failures. Start with targeted vitest under `frontend/src/lib/privy/` and waitlist tests; then `pnpm -C frontend typecheck` / relevant lint.

## Suggested first steps

1. Read ACCOUNT_MODEL + connection-methods + the Privy files listed above.
2. Trace one happy path end-to-end: waitlist email OTP → `/api` session cookie → Privy access token → connect Base → `/api/accounts/link` → `profiles.csw_address` / `privy_user_id`.
3. List every place that remounts Privy, changes `appId`/`clientId`, or gates SmartWallets.
4. Propose the clean target **before** large edits; then implement.

## Success criteria

- One coherent Privy story per surface; no mid-flow identity swap.
- Email-joined account is the only account Base/CSW can link to in that session.
- Canonical CSW classification correct in API + UI.
- Fewer special cases (loopback, remount, mode flags) with tests locking the remaining ones.
- Localhost join + wallet link works without “clear Privy wallets” as a normal recovery step (sign-out / clear site data only for already-corrupted sessions).

## Prior context

Agent transcript `fc3a0215-3faf-4038-96ea-785d4a32895e` — recent mitigations for wrong Privy ID after remount; treat them as temporary until the clean design lands.
