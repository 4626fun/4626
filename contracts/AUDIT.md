# Audit pin — v1.20.0 greenfield + agent lane

Public slim pin for One Dollar Audit / LeftClaw.

- Private: `wenakita/4626` @ `73e341cec3ca2bfd19e3c3ea77513af4836fd736` (`main`)
- Public branch: `audit/oda-v1200-greenfield-candidate`
- Immutable tag: `audit/oda-2026-07-28-agent-lane`
- Prior remediated pin: `audit/oda-2026-07-23-remediated` @ `413f060`
- Scope: creator + **agent** vault/ShareOFT/wrapper/core/gauge parity + shared core-8 carryover

Do not treat this branch as a full monorepo mirror.

## Recommended jobs

1. Lottery stack — `shared/lottery/**`
2. CreatorOVault + CoreModule — `creator/vault/CreatorOVault*.sol`, `creator/vault/modules/**`
3. CreatorShareOFT + Wrapper — `creator/vault/CreatorShareOFT.sol`, `CreatorOVaultWrapper.sol`
4. **AgentOVault + CoreModule** — `agent/vault/AgentOVault.sol`, `agent/vault/modules/**`
5. **AgentShareOFT + Wrapper** — `agent/vault/AgentShareOFT.sol`, `AgentOVaultWrapper.sol`
6. DeploymentBatcher — `shared/deploy/batchers/DeploymentBatcher.sol`
7. Registry4626 — `shared/core/Registry4626.sol`
8. Charm + Ajna — `shared/strategies/**`
9. Gauges — `creator/revenue/CreatorGaugeController.sol`, `agent/revenue/AgentGaugeController.sol`
10. ve4626 + bribes — `shared/governance/**`
