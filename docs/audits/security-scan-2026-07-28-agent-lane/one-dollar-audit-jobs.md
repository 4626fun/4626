# One Dollar Audit jobs — 2026-07-28 agent lane

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` via x402 ($1 USDC each on Base).
Source pin: [`4626fun/4626` @ `audit/oda-2026-07-28-agent-lane`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts) (commit `0c47be2`).
Live stack: v1.19.3 bytecode epoch + v1.19.4 Creator-core repair on v1.19.1 greenfield infra.
Poll: `curl -sL https://www.onedollaraudit.com/api/jobs/<jobId>`
Do **not** re-pay to re-check — persist these IDs.

## Bytecode match (pre-commission)

Compared HEAD `forge inspect` creation bytecode keccak to `deployments/base/v1.19.3-bytecode-manifest.json` `codeId`.

| Contract | Match | Detail |
|----------|-------|--------|
| AgentOVault | pin-ahead-of-live | HEAD/pin newer than live seal (or drifted) |
| AgentOVaultCoreModule | pin-ahead-of-live | HEAD/pin newer than live seal (or drifted) |
| AgentShareOFT | pin-ahead-of-live | HEAD/pin newer than live seal (or drifted) |
| AgentOVaultWrapper | pin-ahead-of-live | HEAD/pin newer than live seal (or drifted) |
| AgentGaugeController | pin-ahead-of-live | HEAD/pin newer than live seal (or drifted) |

Commission briefs used **pin-ahead-of-live** / source pin review — do not claim live sealed bytecode identity.
Creator + Agent paid canaries remain outstanding (`docs/reference/addresses.md`).

## P0 — agent lane (active)

| System | Job ID | Track | Live cross-check | Bytecode | Status |
|--------|--------|-------|------------------|----------|--------|
| AgentOVault + CoreModule | 509 | https://onedollaraudit.com/audit/509 | AgentOVaultCoreModule [`0xe3f7115a…`](https://basescan.org/address/0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE) | pin-ahead-of-live | commissioned (replaces declined 506) |
| AgentShareOFT + Wrapper | 507 | https://onedollaraudit.com/audit/507 | implementation-only (no live CREATE2 vault) | pin-ahead-of-live | **complete** — remediations in [oda-507-remediation.md](./oda-507-remediation.md) |
| AgentGaugeController | 508 | https://onedollaraudit.com/audit/508 | source-only (no live agent gauge) | pin-ahead-of-live | commissioned |

**Spend:** $4.00 USDC ($3.00 active + $1.00 declined 506). Results JSON: [oda-commission-results.json](./oda-commission-results.json).

## Declined

| Job ID | System | Note |
|--------|--------|------|
| 506 | AgentOVault + CoreModule | Declined by LeftClaw after create (likely oversized brief). Replaced by **509**. Do not treat as successful audit. |

## Per-job file lists

### AgentOVault + CoreModule (job 509)

- `contracts/agent/vault/AgentOVault.sol`
- `contracts/agent/vault/modules/AgentOVaultCoreModule.sol`
- `contracts/shared/vault/modules/OVaultModuleStorage.sol`
- `contracts/shared/vault/modules/OVaultModuleBase.sol`
- `contracts/shared/vault/modules/OVaultModuleConstants.sol`

- Live: AgentOVaultCoreModule [`0xe3f7115a…`](https://basescan.org/address/0xe3f7115aba3658201a3be2EaF699173E5cD0d6fE)
- Replaces declined job 506
- Prior jobs (context only): 497, 480
- Note: #788 / ODA-480-[3] agent withdraw-cooldown parity is in this pin.

### AgentShareOFT + Wrapper (job 507)

- `contracts/agent/vault/AgentShareOFT.sol`
- `contracts/agent/vault/AgentOVaultWrapper.sol`

- Live: none (Creator + Agent paid canaries outstanding) — implementation-only
- Prior jobs (context only): 498, 481
- Note: #788 / ODA-480-[3] agent withdraw-cooldown parity is in this pin.

### AgentGaugeController (job 508)

- `contracts/agent/revenue/AgentGaugeController.sol`

- Live: none (no agent gauge wired) — source-only
- Prior jobs (context only): 467
- Note: #788 / ODA-480-[3] agent withdraw-cooldown parity is in this pin.

## Skipped (by design)

- P1 D (Creator↔Agent parity) / F (CreatorGauge+ve) — not commissioned
- P1 E Charm+Ajna — commissioned as **519** (see below)
- CreatorPayout + CoinPolicy — commissioned as **520** (see below)
- P2 re-audit of Batcher/Registry/Lottery/Creator vault/ShareOFT (494–498) — not re-paid

## Poll cheat-sheet

```bash
for id in 509 507 508; do
  echo -n "$id "; curl -sL "https://www.onedollaraudit.com/api/jobs/$id" | jq -r .status
done
```

## Triage

- **507** complete — see [oda-507-remediation.md](./oda-507-remediation.md) and [oda-reports/507-report.md](./oda-reports/507-report.md).
- **508** / **509** still in progress — poll, do not re-pay.

## Follow-on — lottery + CreatorOracle (2026-07-28)

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` via x402 ($1 USDC each).
Pin: `audit/oda-2026-07-28-agent-lane` (`0c47be2`). AgentOracle deferred.

| System | Job ID | Track | Bytecode | Status |
|--------|--------|-------|----------|--------|
| Lottery stack (delta vs 496) | 510 | https://onedollaraudit.com/audit/510 | pin-ahead-of-live (LM/VRF) | commissioned |
| CreatorOracle | 511 | https://onedollaraudit.com/audit/511 | match (v1.19.3 seal) | commissioned |

**Spend:** $2.00 USDC. JSON: [oda-commission-lottery-oracle.json](./oda-commission-lottery-oracle.json).

```bash
for id in 510 511; do
  echo -n "$id "; curl -sL "https://www.onedollaraudit.com/api/jobs/$id" | jq -r .status
done
```

## Follow-on — Charm/Ajna + Creator revenue (2026-07-28)

Paid from `0xB05Cf01231cF2fF99499682E64D3780d57c80FdD` via x402 ($1 USDC each).
Pin: [`audit/oda-2026-07-28-strategies-revenue`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-strategies-revenue/contracts) (`f09a31a`).
Live stack: v1.20.0 greenfield Registry `0xF60a1490C4129f2b6ae540734D3C2C8C6111824e` — per-creator CREATE2; implementation-only.
Bytecode: pin-ahead-of-live vs v1.20.0 seal for all in-scope contracts.
Do **not** re-pay to re-check.

| System | Job ID | Track | Bytecode | Status |
|--------|--------|-------|----------|--------|
| Charm + Ajna (+ adapter) | 519 | https://onedollaraudit.com/audit/519 | pin-ahead-of-live | commissioned (prior 466/431 context) |
| CreatorPayout + CoinPolicy | 520 | https://onedollaraudit.com/audit/520 | pin-ahead-of-live | commissioned |

**Spend:** $2.00 USDC. JSON: [oda-commission-strategies-revenue.json](./oda-commission-strategies-revenue.json).

```bash
for id in 519 520; do
  echo -n "$id "; curl -sL "https://www.onedollaraudit.com/api/jobs/$id" | jq -r .status
done
```

