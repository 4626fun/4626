# Contract security delta — v1.20.0 greenfield candidate (2026-07-25)

Targeted One Dollar Audit re-pass before a **no-legacy** v1.20.0 full greenfield
(new Registry / Batcher / Store / LM).

## Pins

| Pin | Value |
|-----|--------|
| Private | `wenakita/4626` @ `audit/oda-v1200-greenfield-candidate` (`b2df117ccd0`) |
| Public | [`4626fun/4626` @ `audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) (`d3e73cdcf`) |
| Prior full pass | 2026-07-22 @ `423e0e3` / remediated `413f060` |
| Release packet | `docs/_internal/deployment-releases-legacy/v1.20.0-greenfield.md` |

## Scope (targeted delta — not full core-8)

1. DeploymentBatcher
2. Registry4626
3. Lottery stack (LM + VRF + AMOE router surface)
4. CreatorOVault + CoreModule
5. CreatorShareOFT + Wrapper

Do **not** re-pay to poll — persist job IDs in [one-dollar-audit-jobs.md](./one-dollar-audit-jobs.md).

## Why not full re-audit

July 22–23 ODA + #757 closed P0s. This pass is a **delta** on the greenfield candidate before hard cutover.

## Commissioned jobs (2026-07-25)

| System | Job | Prior |
|--------|-----|-------|
| DeploymentBatcher | [494](https://onedollaraudit.com/audit/494) | 464 |
| Registry4626 | [495](https://onedollaraudit.com/audit/495) | 465 |
| Lottery stack | [496](https://onedollaraudit.com/audit/496) | 461 |
| CreatorOVault + CoreModule | [497](https://onedollaraudit.com/audit/497) | 462/480 |
| CreatorShareOFT + Wrapper | [498](https://onedollaraudit.com/audit/498) | 463/481 |

Persist IDs in [one-dollar-audit-jobs.md](./one-dollar-audit-jobs.md) / [oda-commission-results.json](./oda-commission-results.json). Do not re-pay to poll.

## Remediation (Jobs 494 / 495 Highs)

- **494 H-01** (`DeploymentBatcher`): nonzero `shareOftSaltOverride` must equal derived `deriveShareOftSalt(...)`; free-form CREATE2 salt squats revert `InvalidShareOftSaltOverride`.
- **495 H-01** (`Registry4626.setCanonicalWallet`): owner may set/override; otherwise creator self-bind only (`msg.sender == creator == _wallet`); replace of a different non-zero wallet requires `liveRebindEnabled` + owner. Reverse-map uniqueness retained.

## Public pin sync

Remediation contracts for **ODA-494-H01** / **ODA-495-H01** synced to public `d3e73cdcf21d95207f58c2eb41166cbfbe80d8fc` (from private `b2df117ccd0`). No new ODA jobs commissioned.

- [ODA 496–498 remediation](./oda-496-498-remediation.md)

## Public pin sync (2026-07-25 — ODA-496–498 + wrapper cooldown)

- Private source: `b2df117ccd07ee1a63ca74d7b6abd9cd9d48e1e7` (`fix/wrapper-cooldown-hot-balance`; includes `main` #805)
- Public: [`4626fun/4626` @ `audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) (`d3e73cdcf21d95207f58c2eb41166cbfbe80d8fc`)
- No new ODA jobs commissioned for this sync.

## Public pin sync (2026-07-28 — agent lane)

- Private source: `73e341cec` (`main`)
- Public branch: [`audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) @ `0c47be2`
- Immutable tag: [`audit/oda-2026-07-28-agent-lane`](https://github.com/4626fun/4626/tree/audit/oda-2026-07-28-agent-lane/contracts)
- Added: `AgentOVault`, `AgentShareOFT`, `AgentOVaultWrapper`, `AgentOVaultCoreModule`, `AgentGaugeController` (incl. #788 ODA-480-[3] agent cooldown parity)
- No new ODA jobs commissioned for this sync.
