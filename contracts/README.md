# contracts

Slim public slice of first-party Solidity for **security review only** (One Dollar Audit / LeftClaw).

This is **not** the full protocol tree. The private working monorepo remains the build/source of truth.

## Layout

| Path | Role |
| --- | --- |
| `shared/` | Registry, lottery/VRF/AMOE, deploy batcher, vault modules, strategies, governance (ve4626) |
| `creator/` | Creator-coin lane (CreatorOVault, ShareOFT, Wrapper, CoreModule, gauge) |
| `agent/` | AgentTokenV4 lane (AgentOVault, ShareOFT, Wrapper, CoreModule, gauge) |

## Audit pin

| Field | Value |
| --- | --- |
| Branch | `audit/oda-v1200-greenfield-candidate` |
| Immutable tag | `audit/oda-2026-07-28-agent-lane` |
| Private sync | `wenakita/4626` @ `73e341cec` (`main`) |
| Scope map | [AUDIT.md](./AUDIT.md) |
| Remediation notes | [REMEDIATIONS.md](./REMEDIATIONS.md) |
| Prior immutable pins | [`audit/oda-2026-07-22` @ `423e0e3`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-22/contracts), [`audit/oda-2026-07-23-remediated` @ `413f060`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-23-remediated/contracts) |
| Do not use | `github.com/wenakita/CreatorVault` (legacy wrong tree) |
