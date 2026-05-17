# Randomness Router

Per-creator randomness selector. Lives at `contracts/utilities/lottery/randomness/RandomnessRouter.sol`. **Does not modify** `CreatorLotteryManager.sol`.

## Why a router (and not an inline change)

`CreatorLotteryManager.sol` is ~1500 lines, audit-locked, and uses a delegate-call admin module (`CreatorLotteryManagerAdminModule`) plus namespaced VRF keys to avoid local/cross-chain collisions. Editing the VRF call sites inline would invalidate the audit and cross-chain test matrix mid-hackathon.

Instead, the router is a sidecar:

```
┌──────────────────────────┐    requestRandomWords()
│  CreatorLotteryManager   │────────────────────────► CreatorVRFConsumerV2_5  (UNCHANGED)
│  (existing, untouched)   │
└──────────────────────────┘

┌──────────────────────────┐    resolve(coin)
│  RandomnessRouter (new)  │────────────────────────► IRandomnessSource
│                          │       acquireRequest    │  ├── ChainlinkVRFAdapter (REQUEST)
│  defaultSource           │       readPull          │  └── DrandRandomnessSource (PULL)
│  sourceOf[coin]          │
└──────────────────────────┘
```

## How a creator opts into drand

1. Governance calls `RandomnessRouter.setSourceFor(creatorCoin, drandSource)`.
2. The keeper (per the `amoe/relayer/drand` Swift package or any equivalent service) starts feeding rounds into `DrandRandomnessSource` for that coin's epochs.
3. When the lottery manager fires a roll for that coin, the keeper:
   a. computes `round = drandSource.roundAt(block.timestamp)`,
   b. reads `RandomnessRouter.readPull(coin, round)`,
   c. calls `CreatorLotteryManager.processPendingVrfResult(...)` (or whatever the manager exposes today) with that word as the seed.

No on-chain change to the lottery manager is required. The "wiring" is keeper-level.

## When to switch a coin back to Chainlink VRF

`clearSourceFor(coin)`. `resolve(coin)` falls back to the default source (`ChainlinkVRFAdapter`).

## Mode discovery

Sources self-report via `mode()`:

- REQUEST → router exposes `acquireRequest(coin)` which calls `source.request()` and returns the request id key.
- PULL    → router exposes `readPull(coin, key)` which returns the random word for that key.

Calling the wrong helper for a source mode reverts with `UnsupportedMode`.

## Future work

- A lightweight on-chain hook in `CreatorLotteryManager` so it can call `RandomnessRouter` itself instead of relying on the keeper. This is intentionally deferred — a hook means another upgrade and audit pass.
- A `MultiRelayerDrandSource` that replaces single-relayer trust with N-of-M agreement on `(round, hashedRoundCommit)`.
