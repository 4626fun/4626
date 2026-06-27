# Yearn-Inspired P0 Runbook (Role Policy + APR Signals)

## 1) Configure Role Policy (Optional)

### Contracts

- Policy manager: `VaultRolePolicyManager`
- Enforcer: `DeploymentBatcher`

### Steps

1. Deploy `VaultRolePolicyManager` with protocol owner as `Ownable` admin.
2. Create a policy id with `setRolePolicy(policyId, policy)`.
3. (If allowlist-based rules are used) set role allowlists via `setRoleAllowlistedAccount(...)`.
4. Configure batcher enforcement:
   - `DeploymentBatcher.setVaultRolePolicyConfig(manager, policyId)` from `protocolTreasury`.

### Per-Session Override

For targeted deploy sessions, phase-2 can use `deployPhase2CoreWithRolePolicy(params, codeIds, rolePolicyId)`.

If not used, existing `deployPhase2Core` behavior remains and uses configured default policy id.

## 2) APR Signal Derivation (P0)

P0 workspace APR signals are placeholder-only and intentionally explicit:

- Source: `p0_placeholder`
- Confidence: `low`
- Fallback: `{ expectedAprBps: null, confidence: 'unknown', source: 'none' }`

Current placeholder mapping:

- Charm active: `1200` bps
- Ajna active: `900` bps
- Solana active: `700` bps
- Inactive/unknown: null fallback

These are advisory UI/operator signals only; they do not affect onchain execution.

## 3) Safe Rollback

### Role Policy Rollback

1. Disable enforcement without contract redeploy:
   - `DeploymentBatcher.setVaultRolePolicyConfig(address(0), 0)` from `protocolTreasury`.
2. Existing deploy-session call paths continue via `deployPhase2Core` as before.

### APR Signal Rollback

1. Revert `workspace/aprSignals` integration commit.
2. Existing workspace strategy payload remains valid minus `aprSignal`.

## 4) Operational Guardrails

- Keep policy id `0` as permissive default/no-op.
- Treat allowlist policy changes as governance-sensitive changes.
- Do not treat P0 APR placeholders as oracle-backed truth in operator automation.
