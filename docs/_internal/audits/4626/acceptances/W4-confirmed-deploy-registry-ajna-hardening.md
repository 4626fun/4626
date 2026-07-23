# W4 Confirmed Deploy / Registry / Ajna Hardening

Date: 2026-07-22

Closed items:
- `DeploymentBatcher.sol`: phase-2 registry auto-fill now refuses to populate zero-value registry slots when the token is already registered to a different `creator` than `params.owner`.
- `Registry4626.sol` + `RegistryBootstrap4626.sol`: omnichain mesh config now follows the same one-shot / `liveRebindEnabled` overwrite discipline as peer bindings; bootstrap skips foreign non-zero mesh rewrites.
- `AjnaERC4626Vault.sol`: `moveFromBuffer` is swapper-only again; keepers retain `moveToBuffer` access.
- `CharmStrategy4626.sol`: borrow-side auto Ajna `limitIndex` now moves below the oracle bucket by the safety buffer and saturates at `0`.
- `frontend/api/_handlers/deploy/v2/session/_createCore.ts`: deploy-session allowlist checks now use session / canonical smart wallet only, and role-policy resolution prefers creator/global defaults over arbitrary client overrides.
- `frontend/src/lib/onchain/resolveAgentTokenIntegration.ts`: agent-token auto-detection now requires non-zero self-reported fields plus matching registry `AgentIntegrationMeta` provenance.
- `frontend/scripts/ops/wire-phase3-helper-safe.ts`: Safe helper rotation now asserts the batcher's privileged helper slots against explicit/default expected pins before execution.

Validation:
- `forge test --match-path test/DeploymentBatcher.ShareOftPeerWiring.t.sol --no-match-path 'test/vault/strategies/CreatorOVaultStrategies.Rebalance.*'`
- `forge test --match-path test/AjnaERC4626Vault.t.sol --no-match-path 'test/vault/strategies/CreatorOVaultStrategies.Rebalance.*'`
- `forge test --match-path test/vault/CharmStrategy4626.Oracle.t.sol --no-match-path 'test/vault/strategies/CreatorOVaultStrategies.Rebalance.*'`
- `forge test --match-path test/RegistryBootstrap4626.t.sol --no-match-path 'test/vault/strategies/CreatorOVaultStrategies.Rebalance.*'`
