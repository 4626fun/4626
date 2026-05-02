# Orphan address registry (Base mainnet)

Canonical record of every Base-mainnet contract deployed by this protocol that
is no longer wired into the live system. New entries go at the top; never edit
existing entries except to fill post-broadcast cleanup actions and cleanup dates.

This document is the source of truth referenced by
`tools/ci/check_no_orphan_addresses.sh` when the guard finds an orphan address
outside the approved whitelist.

## Schema

| Field | Description |
|---|---|
| Address | 0x... 20-byte checksummed |
| Kind | router / verifier / manager / infra |
| Deployed by release | e.g. v1.8.3, v1.9.0 |
| Orphaned by release | e.g. v1.10.1 |
| Reason | One-sentence why |
| Owner at orphan time | EOA / Safe / contract |
| Replacement plan | v1.10.1 replacement placeholder or explicit no-replacement note |
| Cleanup actions taken | basescan label / ownership renounced / balance swept / none |
| Cleanup date | YYYY-MM-DD |
| Evidence | link to release notes / evidence doc |

## Entries

### Orphaned by v1.10.1 (2026-05-XX)

| Address | Kind | Deployed by release | Orphaned by release | Reason | Owner at orphan time | Replacement plan | Cleanup actions taken | Cleanup date | Evidence |
|---|---|---|---|---|---|---|---|---|---|
| `0xd593A8A58BDf7E7448D2dAbDE0Ae3B2BAFDA1357` | manager | v1.8.3 | v1.10.1 | v1.8.3 canonical `CreatorLotteryManager`; pre-PR #395 and missing all three AMOE selectors. | EOA `0xB05C...0FdD` (Safe signer) | `<v1.10.1 manager TBD post-broadcast>` | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |
| `0x3F7AfD93824Ab25F73Bdca59aFDaB560F865b0C3` | manager | v1.7.1 / v1.8.1 | v1.10.1 | Replacement-router target manager; pre-PR #395 and missing all three AMOE selectors. | verify on chain | `<v1.10.1 manager TBD post-broadcast>` | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |
| `0xC618Dde25F0085F3b2BC3a48ba806F8Fc9a93759` | router | v1.9.0 replacement attempt | v1.10.1 | Replacement `LotteryAmoeRouter`; wired correctly, but its target manager has no AMOE handler. | Safe `0x7d42...f2d3` | `<v1.10.1 router TBD post-broadcast>` | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |
| `0xA39A71a388816d657300EFffF1857F938AEF65D1` | verifier | v1.9.0 replacement attempt | v1.10.1 | Replacement `AmoePlonkVerifier`; companion to the orphaned router. | no owner - verifier | `<v1.10.1 verifier TBD post-broadcast>` | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |
| `0xd588f54Ea9e8c40701B419Cf6b8de7aE8d1fB22F` | router | v1.9.0 abandoned attempt | v1.10.1 | v1.9.0 abandoned router; Privy-CSW-owned and never wired. | Privy CSW `0x6C0E...f9b3` | no replacement from this orphan; use `<v1.10.1 router TBD post-broadcast>` for live router wiring | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |
| `0xd9bDFf55A886bADb011A12c447D72D174fD15964` | verifier | v1.9.0 abandoned attempt | v1.10.1 | v1.9.0 abandoned verifier; companion to the abandoned router. | no owner - verifier | no replacement from this orphan; use `<v1.10.1 verifier TBD post-broadcast>` for live verifier wiring | pending - see post-broadcast follow-up PR | pending - see post-broadcast follow-up PR | `docs/operations/deployment/releases/v1.10.1-mainnet.md`; `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md` |

## CI Guard Whitelist

`tools/ci/check_no_orphan_addresses.sh` intentionally permits orphan-address
references only in audited historical records, active v1.10.1 runbooks, and CI
guards that use the addresses as known-bad fixtures.

Current whitelisted paths:

- `deployments/base/contracts/services/lottery/CreatorLotteryManager.json`
- `deployments/base/v1.8.1-vanity-manifest.json`
- `docs/operations/contract-size-gate.md`
- `docs/operations/deployment/amoe-deploy-evidence-2026-05-01.md`
- `docs/operations/deployment/orphan-registry.md`
- `docs/operations/deployment/releases/v1.10.1-mainnet.md`
- `docs/operations/deployment/releases/v1.10.1-pre-broadcast-checklist.md`
- `docs/operations/deployment/releases/v1.10.1-supabase-update-plan.md`
- `docs/operations/deployment/releases/v1.10.1-vercel-env-plan.md`
- `docs/operations/deployment/releases/v1.7.1-mainnet.md`
- `docs/operations/deployment/releases/v1.8.1-mainnet.md`
- `docs/operations/deployment/releases/v1.8.1-pre-broadcast-checklist.md`
- `docs/operations/deployment/releases/v1.8.3-mainnet.md`
- `docs/operations/deployment/v1.10.1/deployment-instructions.md`
- `docs/operations/deployment/v1.10.1/post-broadcast-orphan-finalization.md`
- `docs/operations/deployment/v1.10.1/pre-broadcast-cleanup.md`
- `test/v183-release-target-guard.sh`
- `tools/ci/check_manager_amoe_surface.sh`
- `tools/ci/check_no_orphan_addresses.sh`
- Any file named `cursor-deploy-prompt-v1.10.1.md`
