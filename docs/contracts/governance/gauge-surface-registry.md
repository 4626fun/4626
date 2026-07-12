---
title: GaugeSurfaceRegistry4626
sidebar_position: 4
---

# GaugeSurfaceRegistry4626

Hermes-inspired **gauge surface registry**: the allowlist of what may receive **votes**, **bribes**, and **partner reward streams**.

## Purpose

`ve4626GaugeVoting` still owns vote **weights**. This registry only answers capability questions:

| Capability | Used by |
|------------|---------|
| `votes` | `ve4626GaugeVoting.canReceiveVotes` / vote + boostPPM when `useSurfaceRegistry` |
| `bribes` | Always via `ve4626GaugeVoting.canReceiveBribes` (factory create + depot fund) |
| `streams` | Always via `ve4626GaugeVoting.canReceiveStreams` (factory create + stream fund) |

A **surface** is typically the **vault address** (gauge id) — same convention as bribe depots and reward streams.

## Layout

```
contracts/shared/governance/surfaces/
  IGaugeSurfaceRegistry.sol
  GaugeSurfaceRegistry4626.sol
```

## Surface record

```solidity
struct Surface {
    bool registered;
    bool votes;
    bool bribes;
    bool streams;
    bool paused;   // freezes all capabilities for this surface
    VaultKind kind;
    bytes32 laneId; // e.g. keccak256("creator") / keccak256("agent")
}
```

Plus **global pause** (`setGlobalPaused`) for emergency freezes.

## Wiring (optional, backward compatible)

**Single policy surface:** factories do **not** hold a local surface registry. Create and fund always call
`ve4626GaugeVoting.canReceiveBribes` / `canReceiveStreams` (whitelist when surface mode off; registry when armed).

| Component | Behavior when registry unset / `useSurfaceRegistry=false` |
|-----------|----------------------------------------------------------|
| `OVaultFactory4626` | No auto-register until `setSurfaceRegistry` |
| `ve4626GaugeVoting` | Local vault whitelist (`setVaultWhitelist`) for votes/bribes/streams |
| `BribesFactory4626` | `voting.canReceiveBribes` (whitelist); depots Ownable = `depotOwner` ctor arg |
| `RewardStreamFactory4626` | `voting.canReceiveStreams` (whitelist); streams Ownable = `streamOwner` |

When wired:

1. **Deploy register** — `OVaultFactory4626` (if `surfaceRegistry` set) **fail-loud** idempotent `registerSurface` on **`startPhase1`** (vault known) and legacy `registerDeployment*` (factory must be a registrar first).
2. **Arm eligibility** — owner sets `setSurfaceRegistry` + `setUseSurfaceRegistry(true)` on `ve4626GaugeVoting` only (factories inherit via voting views).
3. **Fund paths** — `BribeDepot4626.bribe` → `canReceiveBribes`; `RewardStream4626.fund` → `canReceiveStreams`.
4. **Emergency reset** — `emergencyResetAllVotes` zeros every vault that received weight this epoch (tracked in `_epochVotedVaults`), not only the local whitelist.

### Mid-epoch capability changes

Pausing or clearing `votes` / `bribes` / `streams` on a surface takes effect **immediately** for
new vote/create/fund actions. Existing epoch vote weight is **not** auto-cleared. For lottery
boost, ineligible vaults get **0** PPM while their weight remains in the epoch total, so that
budget slice is **burned** until re-vote or epoch end (see
[vault-gauge-voting](./vault-gauge-voting.md#mid-epoch-delist--pause-boost-budget)). Bribe/stream
claims for **past** epochs intentionally ignore live eligibility.

## Admin

- **Owner**: `setRegistrar`, `setGlobalPaused`, full registrar powers.
- **Registrar** (e.g. factory or ops bot): `registerSurface`, `setCapabilities`, `removeSurface`.

## What this is not

- Not Hermes `BaseV2Gauge` / emissions gauge lifecycle.
- Not a replacement for fee `CreatorGaugeController` / `AgentGaugeController`.
- Not vote-weight storage (still `ve4626GaugeVoting`).

## Frontend

- `/vote` bribe panel: `frontend/src/components/ve33/BribeDepot4626Panel.tsx`
- Hook: `frontend/src/hooks/useBribes4626.ts`
- Env: `VITE_BRIBES_FACTORY_4626`, `VITE_VE4626_GAUGE_VOTING` (and optional `VITE_GAUGE_SURFACE_REGISTRY_4626`)

## Tests

`test/governance/GaugeSurfaceRegistry4626.t.sol`  
`frontend/src/lib/governance/bribePreview.test.ts`
