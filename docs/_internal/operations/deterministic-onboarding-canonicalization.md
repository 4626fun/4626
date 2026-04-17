# Deterministic Onboarding Canonicalization

This spec defines the canonical onboarding state machine used to keep identity and wallet outcomes deterministic across web, Base, Zora, Telegram, and mixed entry orders.

Architecture reference: [4626 Connection Methods](/4626-connection-methods). Canonical wallet invariants: `.cursor/rules/ERC-4337-Wallet-Invariants.mdc`.

## Core Invariants

- Verified email is the canonical 4626 identity and recovery key.
- `userId` is never set before verified Privy auth success.
- All entry points must converge to the same verified-email account model.
- Canonical CSW resolution is server-authoritative and persisted-first.
- Client events never overwrite canonical wallet state.
- All transitions are event-driven; no timer-based auto-advance.
- Signer preflight is enforced only before signer-required actions.
- A fully onboarded account must have a Privy embedded EOA.
- For CSW users, user-initiated frontend execution requires an app-scoped sub-account (`base_sub_account`) with its signer routed to the Privy embedded EOA via `setToOwnerAccount()`. The embedded EOA is **not** installed as a direct owner of the parent CSW on the user-initiated track.
- Server-side automation (deploy-session, XMTP agent, ERC-8004) continues to delegate a Privy *server* wallet as a direct owner on the parent CSW per `.cursor/rules/csw-agent-lifecycle.mdc`; this is orthogonal to the user-initiated sub-account track.

## States

- `unauthenticated`
- `authenticating`
- `email_verification_required`
- `canonicalizing`
- `onboarding`
- `ready`
- `recovery_required`

## Events

- `START_AUTH`
- `PRIVY_AUTH_SUCCESS`
- `EMAIL_VERIFIED`
- `PRIVY_AUTH_FAILED`
- `CANONICAL_CSW_RESOLVED_FROM_SERVER`
- `ACCOUNT_PAYLOAD_REFRESHED`
- `WALLET_SETUP_COMPLETED`
- `BEFORE_SIGNER_ACTION`
- `OWNER_DELEGATION_VERIFIED`
- `OWNER_DELEGATION_FAILED`
- `AMBIGUOUS_MERGE_DETECTED`
- `RECOVERY_COMPLETED`

## Transition Contract

| From | Event | To | Required command(s) |
| --- | --- | --- | --- |
| `unauthenticated` | `START_AUTH` | `authenticating` | `RUN_PRIVY_SYNC` |
| `authenticating` | `PRIVY_AUTH_SUCCESS` | `email_verification_required` | `CHECK_VERIFIED_EMAIL` |
| `email_verification_required` | `EMAIL_VERIFIED` | `canonicalizing` | `RESOLVE_CANONICAL_FROM_SERVER` |
| `canonicalizing` | `CANONICAL_CSW_RESOLVED_FROM_SERVER` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=auth)` |
| `onboarding` | `ACCOUNT_PAYLOAD_REFRESHED` | `ready` | none |
| `ready` | `WALLET_SETUP_COMPLETED` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=wallet)` |
| `onboarding` | `WALLET_SETUP_COMPLETED` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=wallet)` |
| `ready` | `BEFORE_SIGNER_ACTION` | `ready` | `CHECK_OWNER_DELEGATION` |
| any | `AMBIGUOUS_MERGE_DETECTED` | `recovery_required` | `FORCE_RECOVERY_LINK_FLOW` |
| `recovery_required` | `RECOVERY_COMPLETED` | `unauthenticated` | none |

## API Checks by Command

- `RUN_PRIVY_SYNC` -> `POST /api/auth/privy`
- `CHECK_VERIFIED_EMAIL` -> `GET /api/accounts/me` or `POST /api/waitlist/bootstrap` (flow-dependent)
- `RESOLVE_CANONICAL_FROM_SERVER` -> `POST /api/onboarding/bootstrap`
- `REFRESH_ACCOUNT_PAYLOAD` -> `POST /api/waitlist/bootstrap` or `GET /api/accounts/me` (flow-dependent)
- `CHECK_OWNER_DELEGATION` -> `POST /api/onboarding/bootstrap` (or signer-specific prepare endpoint)
- `FORCE_RECOVERY_LINK_FLOW` -> return deterministic recovery error codes (`RECOVERY_REQUIRED_*`)

## Scenario Matrix Expectations

All supported entry orders must converge to the same final canonical identity fields:

- `email`
- `emailVerified`
- `privyUserId`
- `linkedMethods`
- `appAccessStatus`
- `tier`

Wallet setup must then converge to the same final canonical wallet fields:

- `canonicalCswAddress` (parent CSW, `profiles.csw_address`)
- `embeddedEoaAddress` (`profiles.primary_embedded_eoa`)
- `baseSubAccountAddress` (`profiles.base_sub_account`, user-initiated frontend execution address for CSW users)
- `subAccountSignerConfigured` (embedded EOA routed as sub-account signer via `setToOwnerAccount()`; this supersedes `embeddedEoaOwnerInstalled` on the user-initiated track)

The automated scenario matrix is covered by `frontend/src/wallet/canonicalStateMachine.test.ts`.
