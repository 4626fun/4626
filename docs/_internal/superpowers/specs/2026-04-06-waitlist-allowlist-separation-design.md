# Waitlist vs Allowlist Separation Design

Date: 2026-04-06
Status: Approved for planning

## Problem

The frontend and API surfaces currently mix two different concepts:

- `waitlist` is the public signup and app onboarding flow.
- `creator access` / `creator allowlist` is the permission model for launching Creator Vaults.

The naming overlap is confusing, and some runtime logic currently blurs the boundary by allowing deploy approval to inherit from app onboarding state.

This makes it hard to reason about:

- what grants normal app access
- what grants deploy access
- which admin surface controls which permission

## Product Decision

The product terminology is:

- `waitlist` = public signup and app onboarding
- `allowlist` = permission to launch or deploy vaults

Additional naming guidance:

- Do not introduce `whitelist` as a third term.
- Use `vault allowlist` when user-facing copy needs to clarify that the permission is specifically about deployment.
- Keep `waitlist` for onboarding, referral, leaderboard, and app-entry flows.

## Desired User Model

There are two distinct approvals:

1. App onboarding / app access
- Managed through the waitlist flow.
- Represented by the existing onboarding and profile state.
- Controlled from the waitlist admin surface.

2. Vault deployment access
- Managed through a separate allowlist flow.
- Required for launch and deploy actions.
- Controlled from a dedicated admin allowlist surface.

These two approvals may overlap for some users, but they must not imply each other automatically.

## Core Invariants

The implementation must preserve these rules:

- Joining the waitlist does not grant vault deployment access.
- Being approved for app access does not auto-grant vault deployment access.
- Being on the vault allowlist does not replace the normal waitlist/app onboarding flow.
- App route gating must be based on app onboarding and app access state, not deploy allowlist state.
- Deploy route gating must be based on vault allowlist state, not waitlist state.

## Scope

This change covers:

- frontend naming
- frontend routing and access checks
- public API naming for deploy-approval checks
- admin API naming for deploy-approval management
- removal of logic that treats approved waitlist users as deploy-approved

This change does not require:

- renaming the public waitlist route
- changing waitlist onboarding behavior
- changing database table names in this pass
- broad infra or migration work unrelated to the semantic split

## Naming Plan

### Keep as Waitlist

These remain under `waitlist` terminology:

- `/waitlist`
- `WaitlistFlow`
- `WaitlistInviteEntry`
- `/api/waitlist/*`
- `/admin/waitlist`
- leaderboard, referral, and onboarding copy tied to app entry

### Move to Allowlist Terminology

Deploy approval surfaces should use `allowlist` terminology, preferably `vault allowlist` in user-facing copy.

Current examples that should move away from ambiguous or overloaded naming:

- `Creator Access` UI copy -> `Vault Allowlist`
- deploy request UI copy such as `Request access` -> `Request vault allowlist`
- deploy approval admin copy such as `Approve creator access` -> `Manage vault allowlist`

## Route and API Direction

The target shape is:

### App onboarding

- Waitlist routes and waitlist APIs stay under the existing `waitlist` namespace.
- Admin waitlist tools remain under `/admin/waitlist` and `/api/admin/waitlist/*`.

### Deploy approval

- Public deploy-approval APIs should move under a dedicated allowlist namespace.
- Admin deploy-approval APIs should move under a dedicated allowlist namespace.

Recommended target names:

- `/api/vault-allowlist/check`
- `/api/vault-allowlist/status`
- `/api/vault-allowlist/request`
- `/api/admin/vault-allowlist/*`
- `/admin/vault-allowlist`

The exact endpoint list can mirror the current `creator-access` and `creator-allowlist` responsibilities, but the namespace should clearly communicate deploy permission rather than app onboarding.

## Behavioral Changes

### 1. App access resolution

The app access layer must stop using the deploy allowlist endpoint as its source of truth for accepted app access.

Current issue:

- `accessRuntime.tsx` computes accepted app access using the creator/deploy allowlist endpoint.

Target behavior:

- app access should come from app onboarding or profile-based app access status
- deploy allowlist should not be consulted for generic accepted app routes

### 2. Deploy access checks

Deploy and launch surfaces should use the dedicated allowlist checks only.

Target behavior:

- `/deploy`
- `/deploy/coin`
- `/deploy/vault`
- related request/status components

must depend only on deploy allowlist status and request state.

### 3. Waitlist approval side effects

Current issue:

- admin waitlist approval currently auto-allowlists the creator wallet.

Target behavior:

- waitlist approval should update app onboarding/access state only
- allowlist approval should be its own explicit admin action

### 4. Allowlist check semantics

Current issue:

- the creator allowlist endpoint currently treats approved waitlist users as allowed.

Target behavior:

- deploy allowlist checks should only succeed based on deploy-approval rules
- approved app users should not become deploy-approved through waitlist status alone

## Frontend Surface Changes

Expected frontend changes:

- rename deploy-facing hooks, query keys, and labels from `creator access` to `vault allowlist` where appropriate
- keep onboarding-facing hooks and components under `waitlist`
- update admin navigation and dashboard labels to separate:
  - `Waitlist`
  - `Vault Allowlist`
- update deploy CTAs and request panels so users see deploy approval as a separate system

Important nuance:

- internal names that are already generic and low-risk, such as some existing `allowlist` terms, do not need forced renames if they already describe deploy permission correctly
- the main goal is semantic clarity, not churn for its own sake

## Backend Surface Changes

Expected backend changes:

- move deploy approval APIs out of the `creator-access` naming
- stop mixing deploy approval with app waitlist approval in allowlist checks
- remove auto-allowlist side effects from waitlist approval handlers

Database tables can remain unchanged in this pass if needed. The semantic split matters more than physical schema renames.

## Compatibility Strategy

This should be implemented as a focused rename and behavior split, not a broad migration.

Recommended compatibility approach:

- update frontend callers to the new allowlist API names in the same change
- remove old frontend references instead of carrying duplicate naming long-term
- only keep temporary backend aliases if required to avoid breaking active callers during the transition

Because this repo explicitly prefers removing replaced surfaces over preserving legacy aliases, temporary compatibility shims should be minimized.

## Testing and Verification

The implementation should verify:

- waitlist onboarding still works at `/waitlist`
- referral entry still redirects into waitlist correctly
- app accepted-route gating still works for approved app users
- deploy routes are blocked for non-allowlisted creators
- allowlisted creators can access deploy flows
- waitlist approval no longer auto-grants deploy approval
- admin waitlist and admin vault allowlist surfaces remain clearly separated

Targeted tests should cover:

- access-runtime regression tests
- deploy allowlist hooks and request/status components
- admin waitlist approval behavior
- renamed route and API wiring

## Non-Goals

This pass does not aim to:

- redesign the waitlist UX
- redesign the deploy UX
- rename every historical mention of `allowlist` across unrelated systems
- change unrelated smart contract or paymaster allowlist terminology

## Recommended Implementation Approach

Implement the split in this order:

1. Separate app-access logic from deploy-allowlist logic.
2. Remove waitlist approval side effects that mutate deploy approval.
3. Rename deploy-facing frontend and API surfaces to `vault allowlist`.
4. Update admin navigation and copy.
5. Run targeted regression tests around onboarding, accepted routes, and deploy gating.

## Final Decision

The codebase should standardize on:

- `waitlist` for public signup and app onboarding
- `allowlist` for permission to launch or deploy vaults

User-facing deploy copy should prefer `vault allowlist` when extra clarity is useful.
