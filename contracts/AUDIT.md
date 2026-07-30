# Audit pin — v1.20.0 greenfield + strategies + creator revenue

Public slim pin for One Dollar Audit / LeftClaw.

- Private: `wenakita/4626` @ `a8d979792` (working tree sync)
- Public branch: `audit/oda-v1200-greenfield-candidate`
- Immutable tag (strategies+revenue): `audit/oda-2026-07-28-strategies-revenue`
- Prior immutable tags: `audit/oda-2026-07-28-oracles` @ `c19bc8e`, `audit/oda-2026-07-28-agent-lane` @ `0c47be2`
- Scope: prior agent-lane + oracles + **refreshed Charm/Ajna/adapter** + strategy interfaces + **CreatorPayoutRouter / CreatorCoinPolicyController** + **LeftClaw #508/#509 remediations** (gauge fee-collector, agent-lane measured accounting)

Do not treat this branch as a full monorepo mirror.

## Recommended jobs

1. **Charm + Ajna (+ ERC4626StrategyAdapter)** — `shared/strategies/**`
2. **Creator revenue** — `creator/revenue/CreatorPayoutRouter.sol`, `CreatorCoinPolicyController.sol`
3. Lottery / Creator+Agent vaults / oracles / Batcher / Registry / gauges / ve — prior jobs; re-commission only on security-relevant drift
