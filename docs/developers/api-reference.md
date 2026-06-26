---
title: API reference (local generation)
sidebar_position: 2
---

# API reference

The public docs site publishes **curated** guides and runbooks only. Full API dumps are generated from source in the monorepo when you need them locally.

## Generate locally

From the repo root:

```bash
pnpm docs:refresh
```

This runs:

1. **TypeDoc** on stable frontend/server library surfaces → `docs/_generated/frontend/`
2. **`forge doc`** on Solidity contracts → `docs/_generated/contracts/`
3. **Sync + postprocess** into `apps/docs-site/docs/api/` (full mode)

To browse generated docs in dev:

```bash
DOCS_PUBLISH_CURATED=0 pnpm -C apps/docs-site prepare:content
pnpm -C apps/docs-site start
```

## What to read instead

| Need | Doc |
|------|-----|
| Live contract addresses | [Addresses](/reference/addresses) |
| Contract behavior (narrative) | [Contracts](/contracts) |
| Wallet / execution model | [Wallet architecture](/wallet-architecture) |
| HTTP keeper routes | [Keeper HTTP API](/operations/automation/keeper-http-api) |

NatSpec and TSDoc stay in source — the site does not mirror every symbol as a page.
