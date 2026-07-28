# Contract security re-audit — 2026-07-22

One Dollar Audit (LeftClaw) re-pass against public source pin
[`4626fun/4626` @ `audit/oda-2026-07-22`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-22/contracts).

- Job table: [one-dollar-audit-jobs.md](./one-dollar-audit-jobs.md)
- Commission JSON: [oda-commission-results.json](./oda-commission-results.json)
- Prior July 17/18 pass: [../security-scan-2026-07-17/](../security-scan-2026-07-17/)

Core jobs **461–468** commissioned 2026-07-22. Do not re-pay to poll.

## Remediated public pin (2026-07-23)

After 480/481 P0 closes + Codex/Bugbot contract follow-ups, a new slim pin was published (prior pin frozen):

- Branch/tag: [`audit/oda-2026-07-23-remediated`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-23-remediated/contracts) @ `413f060`
- Notes: https://github.com/4626fun/4626/blob/audit/oda-2026-07-23-remediated/contracts/REMEDIATIONS.md
- Immutable prior: [`audit/oda-2026-07-22` @ `423e0e3`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-22/contracts)

## Agent-lane public pin (2026-07-28)

Greenfield pin refreshed to include the agent vault/ShareOFT/wrapper/core/gauge surface (previously private-only):

- Branch: [`4626fun/4626` @ `audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) @ `0c47be2`
- Immutable tag: [`audit/oda-2026-07-28-agent-lane`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts)
- Private sync: `wenakita/4626` @ `73e341cec` (`main`)
- Notes: https://github.com/4626fun/4626/blob/audit/oda-v1200-greenfield-candidate/contracts/REMEDIATIONS.md
- Prior pins remain immutable: July 22 `423e0e3`, July 23 `413f060`
