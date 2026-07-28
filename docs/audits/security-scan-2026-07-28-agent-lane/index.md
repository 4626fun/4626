# Public contracts pin — agent lane inclusive (2026-07-28)

## Auditor pointer

| Field | Value |
|-------|-------|
| Repo | https://github.com/4626fun/4626 |
| Tag | [`audit/oda-2026-07-28-agent-lane`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts) |
| Commit | `0c47be2` (`0c47be24efb9f48b03f54c289e2734f4cfd50cd8`) |
| Branch | [`audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) |
| Private sync | `wenakita/4626` @ `73e341cec` (`main`) |
| Remediations | https://github.com/4626fun/4626/blob/audit/oda-2026-07-28-agent-lane/contracts/REMEDIATIONS.md |
| Scope map | https://github.com/4626fun/4626/blob/audit/oda-2026-07-28-agent-lane/contracts/AUDIT.md |

## What changed vs prior greenfield pin

- Added agent-lane slim surface: `AgentOVault`, `AgentShareOFT`, `AgentOVaultWrapper`, `AgentOVaultCoreModule`, `AgentGaugeController`.
- Includes **#788 / ODA-480-[3]** agent withdraw-cooldown parity (was private-only).
- Creator/shared remediations through `#806` unchanged vs prior greenfield sync.

## Explicit non-goals

- Not a Base redeploy.
- Not a full `contracts/` mirror.
- LeftClaw research job **482** is stale (July 22 pin); re-commission against this tag if a synthesis report is still needed.

## Related

- Prior full pass: [security-scan-2026-07-22](../security-scan-2026-07-22/)
- Greenfield delta: [security-scan-2026-07-25-v1200](../security-scan-2026-07-25-v1200/)
- Research brief: [../security-scan-2026-07-22/RESEARCH-CONTEXT.md](../security-scan-2026-07-22/RESEARCH-CONTEXT.md)

## Commission next jobs

Reusable agent prompt: [COMMISSION-PROMPT.md](./COMMISSION-PROMPT.md).

**Live Base today:** v1.19.3 bytecode epoch + v1.19.4 Creator-core repair on v1.19.1 greenfield infra addresses. The public pin (`0c47be2`) is source-ahead of that seal for several creator/share contracts — see prompt for bytecode-match guidance.
