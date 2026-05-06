# Arch-B Sub-Account Alignment Contract (Post-PR302)

> **Canonical reference:** [docs/ACCOUNT_MODEL.md](../ACCOUNT_MODEL.md). The Arch-B sub-account flow is documented as §5.4 ("Arch B agent commands — server-side spend-permission flow").

Status: active
Baseline: `origin/main` including commits `6e85dc2f`, `c51e106b`, `9e86ad20`

## Purpose

This contract defines the non-negotiable Arch-B Phase 5 foundation behavior for CSW sub-account execution behind `ARCH_B_SUB_ACCOUNTS_ENABLED`.

Any PR touching Arch-B sub-account surfaces must preserve these invariants.

## Foundation Invariants

1. Flag-off behavior must remain unchanged.
- `ARCH_B_SUB_ACCOUNTS_ENABLED=0` is the default.
- Legacy rows (`subAccount === null`) must keep direct-parent-CSW execution behavior.

2. Sub-account rows must fail closed.
- If `issuer.subAccount != null` and the feature is off, refuse with `sub_account_feature_disabled`.
- Refuse when spend permission is revoked.
- Refuse when spend permission is expired.
- No silent fallback to legacy direct-CSW path for sub-account rows.

3. Preflight funding source is parent CSW on sub-account path.
- Balance preflight for sub-account rows must check `parentCswAddress`, not sub-account balance.
- Insufficient parent funds must map to `sub_account_parent_insufficient_funds`.

4. Submit from sub-account and prepend SpendPermission calls in order.
- UserOp sender for sub-account rows is `subAccountAddress`.
- Effective call order is `[approveWithSignature? , spend? , ...inputCalls]`.
- `approveWithSignature` is included when permission is not approved on-chain.
- `spend` must not be emitted for zero-value (`amountWei=0`) operations.

5. Sub-account schema fields are additive and legacy-safe.
- `command_issuer_execution_context` keeps legacy compatibility when `sub_account_address IS NULL`.
- Required columns/index are defined in `frontend/db/migrations/028_arch_b_sub_accounts.sql`.

## Refusal Code Contract

Sub-account path refusal codes:
- `sub_account_feature_disabled`
- `sub_account_spend_permission_revoked`
- `sub_account_spend_permission_expired`
- `sub_account_parent_insufficient_funds`

These augment (not replace) existing refusal families (`cap_exceeded`, `insufficient_funds`, `bundler_unavailable`, `userop_failed`).

## Foundation-Scope Safety Rule

For the Phase 5 foundation layer:
- No production data mutation as a side effect of foundation-only work.
- No new provisioning endpoint behavior is required for foundation alignment.
- Runtime behavior changes are constrained behind feature-flag gating as above.

## Required Regression Coverage

The following tests are mandatory and must remain present:
- `frontend/api/__tests__/arch-b/spendPermission.test.ts`
- `frontend/api/__tests__/arch-b/userOperationSubmitter.subAccount.test.ts`
- `frontend/server/_lib/wallet/commandIssuerContext.test.ts`
- `frontend/api/__tests__/arch-b/status.test.ts`

Required coverage includes:
- SpendPermission encoding/hash contract
- Submitter sub-account branch behavior (flag/refusal/prepend/fail-open)
- Context parse/provision preservation behavior
- Legacy fixture shape explicitly setting `subAccount: null`
- Explicit submitter-level zero-value assertion (`valueWei=0`) to prevent `spend(0)` regression
