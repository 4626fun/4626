# Audit pin — v1.20.0 greenfield + agent lane + oracles

Public slim pin for One Dollar Audit / LeftClaw.

- Private: `wenakita/4626` @ `ab8d8c7fa69` (`main`)
- Public branch: `audit/oda-v1200-greenfield-candidate`
- Immutable tag (oracles): `audit/oda-2026-07-28-oracles`
- Prior immutable tags: `audit/oda-2026-07-28-agent-lane` @ `0c47be2` (no oracles), `audit/oda-2026-07-23-remediated` @ `413f060`
- Scope: creator + agent vault/ShareOFT/wrapper/core/gauge + **CreatorOracle / AgentOracle** + shared core-8 carryover

Do not treat this branch as a full monorepo mirror.

## Recommended jobs

1. Lottery stack — `shared/lottery/**`
2. CreatorOVault + CoreModule — `creator/vault/CreatorOVault*.sol`, `creator/vault/modules/**`
3. CreatorShareOFT + Wrapper — `creator/vault/CreatorShareOFT.sol`, `CreatorOVaultWrapper.sol`
4. AgentOVault + CoreModule — `agent/vault/AgentOVault.sol`, `agent/vault/modules/**`
5. AgentShareOFT + Wrapper — `agent/vault/AgentShareOFT.sol`, `AgentOVaultWrapper.sol`
6. **CreatorOracle** — `creator/oracles/CreatorOracle.sol` (+ `shared/interfaces/oracles/IOracle4626.sol`)
7. **AgentOracle** — `agent/oracles/AgentOracle.sol` (+ `shared/interfaces/oracles/IOracle4626.sol`)
8. DeploymentBatcher — `shared/deploy/batchers/DeploymentBatcher.sol`
9. Registry4626 — `shared/core/Registry4626.sol`
10. Charm + Ajna — `shared/strategies/**`
11. Gauges — `creator/revenue/CreatorGaugeController.sol`, `agent/revenue/AgentGaugeController.sol`
12. ve4626 + bribes — `shared/governance/**`
