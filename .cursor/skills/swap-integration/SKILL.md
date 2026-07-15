---
name: swap-integration
description: 4626 swap execution — txRouter, canonical4337, paymaster. Use for /swap bugs and swap wiring.
paths: frontend/src/pages/Swap.tsx, frontend/src/lib/tx/**, frontend/src/lib/uniswap/**, frontend/api/_handlers/paymaster/**
---

# 4626 swap integration

**Authority:** `.cursor/rules/swap-execution.mdc`, `docs/agent-context/archives/swap-execution.md`

**Validate:** `pnpm -C frontend validate:swap`

**Invariants:** sponsored canonical swaps use parent CSW + embedded EOA owner (`canonical4337`); do not fall back to direct gas sends when sponsorship is denied.
