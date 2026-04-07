---
name: contracts-change
description: Handles Solidity contracts, Foundry scripts, and contract-adjacent test changes.
triggers:
  - contracts/
  - script/
  - forge
scope:
  - contracts/
  - script/
  - test/
verification:
  - forge build
  - forge test
---

# contracts-change

Use this skill when work touches Solidity contracts, Foundry deployment scripts, or Foundry tests.

Guardrails:

- Preserve contract invariants and deployment assumptions documented in `AGENTS.md`.
- Prefer the smallest contract-surface change that satisfies the requirement.
- Treat bridge, fee-routing, and vault-accounting changes as high-risk and verify them with Foundry before broader sweeps.
