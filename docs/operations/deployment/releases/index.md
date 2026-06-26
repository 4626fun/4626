# Release notes

Production deployment epochs for the live greenfield batcher stack. Older release packets (v1.7–v1.10) live in `docs/_internal/deployment-releases-legacy/` (repo-only).

## Current line

| Release | Summary |
|---------|---------|
| [v1.14.0 bytecode epoch](/operations/deployment/releases/v1.14.0-bytecode-epoch) | Latest bytecode epoch |
| [v1.13.0 bytecode epoch](/operations/deployment/releases/v1.13.0-bytecode-epoch) | Release namespace + manifest/guard updates |
| [v1.12.1 bytecode epoch](/operations/deployment/releases/v1.12.1-bytecode-epoch) | Module v2 + payout-router setup |
| [v1.12.0 bytecode epoch](/operations/deployment/releases/v1.12.0-bytecode-epoch) | Store refresh + Phase 3 helper |
| [v1.11.1 protocol readiness](/operations/deployment/releases/v1.11.1-protocol-contract-readiness) | Full protocol contract surface |
| [v1.11.0 protocol readiness](/operations/deployment/releases/v1.11.0-protocol-contract-readiness) | Prior protocol surface |

## Conventions

- **Bytecode epoch** bumps (`v1.12.x`, `v1.13.x`, `v1.14.x`) refresh CREATE2 store manifests and helper wiring on the **same** live batcher shell when possible.
- **Greenfield shell** today: `0xa99058f424FB3ACC639F59355C65C40149030651` (see [deployment index](/operations/deployment)).
- Run preflight: `pnpm -C frontend exec tsx scripts/ops/verify-bytecode-store-seeded.ts`

## Legacy

Pre-v1.11 mainnet packets and v1.10 planning docs are archived under `docs/_internal/deployment-releases-legacy/` for audit only — do not use for new deploys.
