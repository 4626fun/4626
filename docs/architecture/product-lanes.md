---
title: Product lanes
sidebar_position: 1
---

# Product lanes (canonical)

Short reference for how 4626 splits **product vault lanes**, **value lanes**, and **runtime agent** automation. Folder layout: [`contracts/README.md`](../../contracts/README.md). High-level architecture: [index](./index.md).

## Three orthogonal axes

| Axis | Meaning | Do not confuse with |
|------|---------|---------------------|
| **Product vault lane** | `VaultKind.Creator` / `VaultKind.Agent` → `contracts/creator/` / `contracts/agent/` | XMTP / Keepr / ERC-8004 “agent” |
| **Value lanes** | Gauge + payout routing: jackpot **69%**, voters **21.39%**, burn **9.61%**, creator ongoing **0%** | Product folder |
| **Runtime agent** | Canonical CSW, XMTP Keepr, deploy-session automation | `VaultKind.Agent` |

```
contracts/
  shared/     # Registry, batcher, lottery, ve, strategies (all product lanes)
  creator/    # Zora creator-coin vault stack (■ / ▢)
  agent/      # AgentTokenV4 vault stack (◆ / ◇) — not XMTP/Keepr
  other/      # AlfaClub + future non-mesh products
```

## Wiring invariant: `getVaultKind` at deploy

`Registry4626.getVaultKind(token)` reads `AgentIntegrationMeta` (historical name for **lane** meta — rename to `LaneIntegrationMeta` only on a future registry epoch).

- **Deploy path:** `DeploymentBatcher` phase-2 sets meta via `setAgentIntegrationMeta` (authorized factory or owner).
- **Auth:** `setAgentIntegrationMeta` uses `onlyAuthorizedOrOwner` (same gate as `registerToken`). This is a Registry bytecode change — land with the next Registry / greenfield epoch; do not assume a live immutable registry can hot-patch.
- Unset meta defaults to `VaultKind.Creator`.

## Adding a future ecosystem

### Mesh path (ShareOFT + gauge + lottery)

New top-level `contracts/<ecosystem>/` fork (like `agent/`): ShareOFT, Wrapper, Gauge, RevenueRouter, Oracle, CoreModule kind, bytecode IDs, extend `VaultKind`, batcher + `deployLaneBytecode` branch, parity guard.

### Non-mesh path

`contracts/other/<product>/` outside Registry4626 mesh until the product needs ShareOFT / gauge / lottery (AlfaClub precedent).

## Known debt (document only)

- Batcher / API still name the underlying asset `creatorToken` for any lane.
- Solidity struct remains `AgentIntegrationMeta` (agent-flavored name for lane meta).
