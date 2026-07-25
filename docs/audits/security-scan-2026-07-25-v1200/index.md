# Contract security delta — v1.20.0 greenfield candidate (2026-07-25)

Targeted One Dollar Audit re-pass before a **no-legacy** v1.20.0 full greenfield
(new Registry / Batcher / Store / LM).

## Pins

| Pin | Value |
|-----|--------|
| Private | `wenakita/4626` @ `audit/oda-v1200-greenfield-candidate` (`a16096d1e`) |
| Public | [`4626fun/4626` @ `audit/oda-v1200-greenfield-candidate`](https://github.com/4626fun/4626/tree/audit/oda-v1200-greenfield-candidate/contracts) (`ef1ca5953`) |
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

Remediation contracts for **ODA-494-H01** / **ODA-495-H01** synced to public `ef1ca595340b02680c3b17f0011b27bece24b914` (from private `a16096d1e`). No new ODA jobs commissioned.
