# Generated documentation (not published by default)

This directory holds **auto-generated** API and contract reference pages produced by:

- `forge doc` → Solidity NatSpec under `contracts/`
- `typedoc` → TypeScript API under `frontend/`

## Publication policy

Production [docs.4626.fun](https://docs.4626.fun) uses **curated manual docs only** (`DOCS_PUBLISH_CURATED=1`, `DOCS_REQUIRE_MANUAL_SOURCE=1`). Generated files here are **not** synced to the public site unless you run a full (`build:full`) docs build locally or change the allowlist.

## Trust order

When generated NatSpec disagrees with live product docs or onchain constants:

1. [docs/reference/addresses.md](../reference/addresses.md)
2. Curated guides under `docs/getting-started/`, `docs/guides/`, `docs/contracts/`
3. Solidity source (`contracts/helpers/batchers/DeploymentBatcher.sol`, etc.)
4. **This folder last** — regenerate after contract changes, do not hand-edit generated `.md` files

## Regeneration

```bash
pnpm -C apps/docs-site generate:contracts   # requires forge on PATH
pnpm -C apps/docs-site generate:frontend    # optional typedoc
pnpm -C apps/docs-site sync-docs            # copies into apps/docs-site/docs/
```

After regen, run:

```bash
pnpm -C apps/docs-site check:generated-contract-docs
pnpm -C apps/docs-site check:contract-facts
```

## Known drift risks

Forge doc output reflects **NatSpec comments** in Solidity, which can lag refactors (e.g. retired 40/40/20 split language). The guard script flags stale split/deposit claims in generated contract markdown when present.

**Exception:** `CCALaunchStrategy` still exposes strategy-local `AUCTION_SPLIT_MPS` / `VESTING_SPLIT_MPS` / `LP_RESERVE_SPLIT_MPS` (40/40/20 MPS) in source — that is **not** the vault finalize split. Creator-facing **30/30/30/10** lives in `DeploymentBatcher` at `finalizePhase2`. Do not copy CCA strategy constants into public launch guides.
