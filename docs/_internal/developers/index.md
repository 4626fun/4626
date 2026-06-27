---
title: Developers
sidebar_position: 4
slug: /developers
last_updated: '2026-04-11'
---

# Developers

This lane is for engineers building features, APIs, contracts, and integrations in the 4626 monorepo.

## Start Here

- [Frontend Overview](/frontend)
- [Architecture](/architecture)
- [Reference Index](/reference)
- [API Reference](/api)

## Core Surfaces

- **Frontend app + API handlers**: `frontend/`
- **Contracts + deploy scripts**: repo root Foundry workspace (`forge`)
- **Automation/runtime services**: [Operators/SRE](/operators) lane

## Standard Local Loops

```bash
# frontend
pnpm -C frontend dev
pnpm -C frontend lint
pnpm -C frontend typecheck
pnpm -C frontend test

# contracts
forge build
forge test
```

## Key References

- [Chains](/reference/chains)
- [Current Contract Inventory](/reference/current-contract-inventory)
- [ERC-4337 Debugging](/reference/erc4337-debugging)
- [Account Context](/reference/account-context)

## Contribution Path

1. Work from `main` unless a task requires another base.
2. Keep changes scoped, test locally, and keep docs in sync.
3. Ship via PR or direct merge flow used by the repo owners.

For deployment/runbook responsibilities, use [Operators/SRE](/operators). For protocol integration specifics, use [Protocol Integrators](/protocols).
