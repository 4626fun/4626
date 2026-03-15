# Deterministic Onboarding Canonicalization

This spec defines the canonical onboarding state machine used to keep identity outcomes deterministic across desktop, Telegram, wallet-first, and mixed entry orders.

## Core Invariants

- Canonical CSW is server-authoritative and persisted-first.
- `userId` is never set before verified Privy auth success.
- Client events (including Zora events) never overwrite canonical CSW.
- All transitions are event-driven; no timer-based auto-advance.
- Signer preflight is enforced only before signer-required actions.

## States

- `unauthenticated`
- `authenticating`
- `canonicalizing`
- `onboarding`
- `ready`
- `recovery_required`

## Events

- `START_AUTH`
- `PRIVY_AUTH_SUCCESS`
- `PRIVY_AUTH_FAILED`
- `CANONICAL_CSW_RESOLVED_FROM_SERVER`
- `ACCOUNT_PAYLOAD_REFRESHED`
- `ZORA_MINT_COMPLETE`
- `BEFORE_SIGNER_ACTION`
- `OWNER_DELEGATION_VERIFIED`
- `OWNER_DELEGATION_FAILED`
- `AMBIGUOUS_MERGE_DETECTED`
- `RECOVERY_COMPLETED`

## Transition Contract

| From | Event | To | Required command(s) |
| --- | --- | --- | --- |
| `unauthenticated` | `START_AUTH` | `authenticating` | `RUN_PRIVY_SYNC` |
| `authenticating` | `PRIVY_AUTH_SUCCESS` | `canonicalizing` | `RESOLVE_CANONICAL_FROM_SERVER` |
| `canonicalizing` | `CANONICAL_CSW_RESOLVED_FROM_SERVER` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=auth)` |
| `onboarding` | `ACCOUNT_PAYLOAD_REFRESHED` | `ready` | none |
| `ready` | `ZORA_MINT_COMPLETE` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=zora)` |
| `onboarding` | `ZORA_MINT_COMPLETE` | `onboarding` | `REFRESH_ACCOUNT_PAYLOAD(reason=zora)` |
| `ready` | `BEFORE_SIGNER_ACTION` | `ready` | `CHECK_OWNER_DELEGATION` |
| any | `AMBIGUOUS_MERGE_DETECTED` | `recovery_required` | `FORCE_RECOVERY_LINK_FLOW` |
| `recovery_required` | `RECOVERY_COMPLETED` | `unauthenticated` | none |

## API Checks by Command

- `RUN_PRIVY_SYNC` -> `POST /api/auth/privy`
- `RESOLVE_CANONICAL_FROM_SERVER` -> `POST /api/onboarding/bootstrap`
- `REFRESH_ACCOUNT_PAYLOAD` -> `POST /api/waitlist/bootstrap` or `GET /api/accounts/me` (flow-dependent)
- `CHECK_OWNER_DELEGATION` -> `POST /api/onboarding/bootstrap` (or signer-specific prepare endpoint)
- `FORCE_RECOVERY_LINK_FLOW` -> return deterministic recovery error codes (`RECOVERY_REQUIRED_*`)

## Scenario Matrix Expectations

All supported entry orders must converge to the same final canonical fields:

- `privyUserId`
- `canonicalCswAddress`
- `appAccessStatus`
- `tier`

The automated scenario matrix is covered by `frontend/src/wallet/canonicalStateMachine.test.ts`.
