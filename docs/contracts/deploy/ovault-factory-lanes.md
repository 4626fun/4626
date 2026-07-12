---
title: OVaultFactory4626 lane façade
sidebar_position: 3
---

# OVaultFactory4626 lane façade

Product entrypoint for vault stacks: **lane router** (creator / agent / future) over `DeploymentBatcher`.

## Layout

```
contracts/shared/deploy/
  factories/OVaultFactory4626.sol
  lanes/
    IOvaultLane.sol
    OvaultLaneBase.sol
    CreatorOvaultLane.sol
    AgentOvaultLane.sol
  batchers/DeploymentBatcher.sol   # multi-tx CREATE2 engine
```

## Phases

| Phase | Factory methods | Batcher target |
|-------|-----------------|----------------|
| **A** | `startPhase1`, `finalizePhase1` | `deployPhase1CoreWithSalt`, `finalizePhase1WithSalt` + **lane codeIds** |
| **B** | `startPhase2`, `startPhase2WithRolePolicy`, `finalizePhase2`, `finalizePhase2WithPermit2`, `startPhase3` | phase2 core/finalize + `deployPhase3Strategies` |
| Register | `registerDeployment` / `WithKind` | post-hoc record + optional registry + surface register |

`kind` argument selects the lane module (`laneOf[kind]`). Phase-1/2 core **force** lane bytecode ids; phase-2 finalize only requires the lane to be configured (metadata / auth).

### Phase-3 strategy codeIds

Callers may pass `StrategyCodeIds` explicitly, or pass all-zero and use factory defaults from `setDefaultStrategyCodeIds`.

## Auth

1. Caller is `authorizedDeployers` (or factory owner).
2. Factory is `DeploymentBatcher.authorizedPhaseCallers` (treasury sets on batcher).
3. Batcher `_requireOwner(params.owner)` allows authorized phase callers.

## Optional surface registry

`setSurfaceRegistry` → on **`startPhase1`** (vault address known) and `registerDeployment*`, **fail-loud** idempotent `registerSurface(vault, kind, laneId, votes/bribes/streams=true)`.

**Order (required):** `surfaceRegistry.setRegistrar(factory, true)` **then** `factory.setSurfaceRegistry(surf)`. Reversing that bricks phase-1 with `NotRegistrar`. Before arming `voting.setUseSurfaceRegistry(true)`, register every vault that must remain eligible (whitelist-only vaults freeze).

## Tests

`test/deploy/OVaultFactory4626.LaneFacade.t.sol`
