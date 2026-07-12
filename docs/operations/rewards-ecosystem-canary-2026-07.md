# Rewards ecosystem canary (2026-07)

**Goal:** Deploy ve■4626 + gauge voting + bribes + partner streams + optional surface registry on Base **without** enabling lottery personal boost or gauge probability boost on day one.

**Companion:** [lottery-canary-checklist-2026-07.md](./lottery-canary-checklist-2026-07.md) (LM must keep `boostManager` / `vaultGaugeVoting` at `0x0` until lottery Phase 3).  
**Script:** [`script/DeployRewardsEcosystem.s.sol`](../../script/DeployRewardsEcosystem.s.sol)  
**Product map:** [hermes-v2-mapping.md](../contracts/governance/hermes-v2-mapping.md)  
**Factory lanes:** [ovault-factory-lanes.md](../contracts/deploy/ovault-factory-lanes.md)  
**Addresses source of truth:** [addresses.md](../reference/addresses.md)

---

## Scope

| Deploy | Role |
|--------|------|
| `ve4626` | Lock **■4626** only |
| `ve4626Utility` | ve33 + veLottery claim desk |
| `ve4626BoostManager` | Personal mult (wired later into LM) |
| `ve4626GaugeVoting` | Weekly probability budget votes |
| `ve4626VoterRewardsDistributor` | 21.39% voter fee claims |
| `BribesFactory4626` | CREATE2 `BribeDepot4626` |
| `RewardStreamFactory4626` | CREATE2 `RewardStream4626` |
| `GaugeSurfaceRegistry4626` | Optional votes/bribes/streams allowlist |

**Out of scope for this canary:**

- LotteryManager boost / gauge wiring (`WIRE_LOTTERY_MANAGER=0`)
- Full production surface-registry gate flip (`useSurfaceRegistry=true`) until whitelist is trusted
- Permanent deposit-only vault mode
- Hermes Flywheel / emissions minter

---

## Phase A — Preflight (read-only)

### A.1 Infra pins (v1.18.0)

| Role | Address (Base) |
|------|----------------|
| Registry4626 | `0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0` |
| LotteryManager4626 | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| Protocol treasury Safe | `0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3` |
| OVaultFactory4626 | `0x70d0D2411D362BA50821389383Fa6B829d736232` |
| DeploymentBatcher | `0x02D7abC547F8B1e7E2D7a919D8D1005918361750` |

```bash
export BASE_RPC_URL="${BASE_RPC_URL:-https://mainnet.base.org}"
export LM=0xB68F359e01626Ec5d15C624037311C70DacAba43

# Lottery must still be fail-closed on boost/gauge for this canary
cast call $LM "boostManager()(address)" --rpc-url $BASE_RPC_URL
cast call $LM "vaultGaugeVoting()(address)" --rpc-url $BASE_RPC_URL
# Expect: 0x0000…0000 for both
```

### A.2 Required inputs

| Input | Notes |
|-------|--------|
| `PRIVATE_KEY` | Deployer EOA (or Safe exec path — script is EOA broadcast) |
| `OWNER` | Contract owner (prefer protocol ops / Safe-controlled EOA for first canary) |
| `WRAPPED_SHARE_OFT` | **■4626** lock asset (protocol share stack — not a creator ShareOFT) |
| Gauge owner keys | `WIRE_EXISTING_GAUGES` defaults to **0** (canary-safe). Set `=1` only if broadcaster owns each gauge controller |
| `DEPOT_OWNER` | Optional; defaults to `OWNER`. Ownable on every CREATE2 `BribeDepot4626` (rollover / grace) |

Confirm `WRAPPED_SHARE_OFT` code exists and symbol/name match product ■4626 before broadcast.

### A.3 Compile + unit gates

```bash
export PATH="$HOME/.foundry/bin:$PATH"
forge test --match-path 'test/governance/*.t.sol' 
forge test --match-path 'test/deploy/OVaultFactory4626.LaneFacade.t.sol'
# Canary dry-run (no RPC): full stack wire + lock→vote→bribe/stream claim
forge test --match-path 'test/deploy/DeployRewardsEcosystem.Canary.t.sol' -vv
forge build --skip test
node scripts/export-v1-deployment-abis.mjs
# Frontend panels (optional)
pnpm -C frontend exec vitest run \
  src/components/ve33/BribeDepot4626Panel.test.tsx \
  src/components/ve33/RewardStream4626Panel.test.tsx \
  src/lib/governance/bribePreview.test.ts
```

`DeployRewardsEcosystem.Canary.t.sol` is the **automated dry-run** of canary posture (utility wiring, surface registry unarmed, e2e bribe/stream). Use the forge script only when you intend to broadcast.

---

## Phase B — Deploy (broadcast)

### B.1 Recommended canary env

```bash
export BASE_RPC_URL="https://mainnet.base.org"   # or private RPC
export PRIVATE_KEY=0x...
export OWNER=0x...                               # ops owner
export WRAPPED_SHARE_OFT=0x...                   # ■4626
export REGISTRY=0xDb8570Dd434b6fCb7f4463d1e7C6F01d4459A4E0
export LOTTERY_MANAGER=0xB68F359e01626Ec5d15C624037311C70DacAba43
export PROTOCOL_TREASURY=0x7d429eCbdcE5ff516D6e0a93299cbBa97203f2d3
export STREAM_OWNER=$OWNER
export DEPOT_OWNER=$OWNER              # BribeDepot Ownable (not the factory)

# Canary defaults (safe)
export WIRE_LOTTERY_MANAGER=0
export WIRE_EXISTING_GAUGES=0          # set 1 only if broadcaster owns gauges
export SET_VOTING_REGISTRY_WHITELIST=1
export DEPLOY_SURFACE_REGISTRY=1
export WIRE_SURFACE_REGISTRY=0         # deploy registry; do not arm gates yet
export DEPLOY_REWARD_STREAM_FACTORY=1
```

### B.2 Broadcast

```bash
forge script script/DeployRewardsEcosystem.s.sol:DeployRewardsEcosystem \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast \
  -vvvv
```

Dry-run first (no broadcast):

```bash
forge script script/DeployRewardsEcosystem.s.sol:DeployRewardsEcosystem \
  --rpc-url "$BASE_RPC_URL" \
  -vvvv
```

### B.3 Capture handoff

From script `=== SUMMARY ===` output, write `tmp/base-rewards-canary-handoff.env` (do not commit secrets):

```bash
# Example shape — fill from broadcast logs
VE4626=0x...
VE4626_UTILITY=0x...
VE4626_BOOST_MANAGER=0x...
VE4626_GAUGE_VOTING=0x...
VE4626_VOTER_REWARDS_DISTRIBUTOR=0x...
BRIBES_FACTORY_4626=0x...
REWARD_STREAM_FACTORY_4626=0x...
GAUGE_SURFACE_REGISTRY_4626=0x...
WRAPPED_SHARE_OFT=0x...
```

Update `deployments/base/contracts/governance/*.json` **address** / `deployedAt` / `deploymentTx` fields for each new contract (ABI already V1-exported).

---

## Phase C — Wire product surfaces (no LM boost)

### C.1 Frontend / Vercel env

| Vite | Server (if used) |
|------|------------------|
| `VITE_VE4626` | — |
| `VITE_VE4626_BOOST_MANAGER` | — |
| `VITE_VE4626_GAUGE_VOTING` | — |
| `VITE_VE4626_VOTER_REWARDS_DISTRIBUTOR` | — |
| `VITE_BRIBES_FACTORY_4626` | — |
| `VITE_REWARD_STREAM_FACTORY_4626` | — |
| `VITE_GAUGE_SURFACE_REGISTRY_4626` | — |

Redeploy app after env set. `/vote` shows gauge voting + bribe + stream panels when addresses are non-null.

### C.2 Optional: arm surface registry later

**Single policy surface:** bribe/stream factories always read `voting.canReceiveBribes` /
`canReceiveStreams` — there is no factory-local registry.

#### Hard order (do not reverse)

| Step | Action | Why |
|------|--------|-----|
| **1** | `setRegistrar(factory, true)` on surface registry | Fail-loud `registerSurface` reverts with `NotRegistrar` if skipped |
| **2** | `factory.setSurfaceRegistry(surf)` | Phase-1 / `registerDeployment*` auto-register vaults |
| **3** | `voting.setSurfaceRegistry(surf)` | Point eligibility views at registry (**keep** `useSurfaceRegistry=false`) |
| **4** | **Register every vault that must vote/bribe/stream** | Whitelist-only vaults freeze when surface mode arms |
| **5** | `voting.setUseSurfaceRegistry(true)` | **Last** — flips create/fund/vote/boost eligibility to surface flags |

**Never** call step 5 before step 4. Flipping `useSurfaceRegistry=true` while a gauge is only
on the local voting whitelist makes `canReceiveVotes/Bribes/Streams` false for that vault until
someone `registerSurface`s it. Existing epoch vote weight is **not** auto-cleared (mid-epoch
delist **burns** that share of the 69,420 PPM boost budget — see
[vault-gauge-voting](../contracts/governance/vault-gauge-voting.md#mid-epoch-delist--pause-boost-budget)).

#### Cast sequence

```bash
SURF=$GAUGE_SURFACE_REGISTRY_4626
VOTING=$VE4626_GAUGE_VOTING
FACTORY=$OVAULT_FACTORY   # 0x70d0D241…

# 1) Registrar FIRST — factory (and any ops bot) must be authorized before surfaceRegistry is set
cast send $SURF "setRegistrar(address,bool)" $FACTORY true \
  --rpc-url $BASE_RPC_URL --private-key $PK

# 2) Factory points at registry (fail-loud registerSurface on startPhase1 / registerDeployment*)
cast send $FACTORY "setSurfaceRegistry(address)" $SURF \
  --rpc-url $BASE_RPC_URL --private-key $PK

# 3) Point voting at registry (optional at deploy via WIRE_SURFACE_REGISTRY=1)
#    useSurfaceRegistry stays false until step 5
cast send $VOTING "setSurfaceRegistry(address)" $SURF \
  --rpc-url $BASE_RPC_URL --private-key $PK

# 4) Register existing canary vaults BEFORE arming surface mode
#    VaultKind.Creator = 0, Agent = 1 (IRegistry4626.VaultKind)
#    laneId = keccak256("creator") / keccak256("agent")
#    (new phase-1 deploys auto-register once factory is registrar + surfaceRegistry set)
LANE_CREATOR=$(cast keccak creator)
for V in $CANARY_VAULTS; do
  cast send $SURF "registerSurface(address,uint8,bytes32,bool,bool,bool)" \
    "$V" 0 "$LANE_CREATOR" true true true \
    --rpc-url $BASE_RPC_URL --private-key $PK
done
# Verify each vault (all three should be true once registered, not paused):
#   cast call $SURF "isRegistered(address)(bool)" $V
#   cast call $SURF "canReceiveVotes(address)(bool)" $V
#   cast call $VOTING "canReceiveBribes(address)(bool)" $V   # still whitelist until step 5

# 5) LAST: arm eligibility for votes + bribes + streams
cast send $VOTING "setUseSurfaceRegistry(bool)" true \
  --rpc-url $BASE_RPC_URL --private-key $PK
```

Until step 5, factories/voting keep **whitelist** semantics.

### C.3 Optional: OVaultFactory lane wiring (Phase A/B façade)

If factory is live but lanes unset:

1. Deploy `CreatorOvaultLane` / `AgentOvaultLane` with owner
2. `setCodeIds` from current bytecode store ids
3. `factory.setLane(Creator|Agent, lane)`
4. `factory.setDeploymentBatcher(0x02D7abC5…)`
5. Batcher treasury: `setAuthorizedPhaseCaller(factory, true)`

See [ovault-factory-lanes.md](../contracts/deploy/ovault-factory-lanes.md).

### C.4 Gauge fee branch

For each canary vault gauge (owner):

```text
setve4626GaugeVoting(voting)
setve4626VoterRewardsDistributor(distributor)
```

Script does this when `WIRE_EXISTING_GAUGES=1` and broadcaster owns gauges. Otherwise Safe/ops manual.

---

## Phase D — Functional canary (single vault)

### D.1 Vote path

1. Lock small ■4626 into `ve4626`
2. Claim ve33 via utility (if required for preferred vote path)
3. Whitelist vault (or surface registered + surface mode on)
4. `vote([vault], [100])` before freeze window
5. Confirm `getVaultWeight` / epoch on UI `/vote`

### D.2 Bribe path

1. `getOrCreateBribeDepot4626(vault)` (or UI create)
2. Approve + `bribe(token, amount)` into **current** epoch
3. After epoch ends: voter `claim(epoch, token)` pro-rata

### D.3 Stream path

1. `getOrCreateStream(vault)`
2. Stream owner `addRewardToken(token)`
3. `fund` → claim after epoch end

### D.4 Abort criteria

- Any accidental non-zero LM `boostManager` / `vaultGaugeVoting` without lottery Phase 3 plan → **clear immediately**
- Surface registry global pause if mis-registration blocks all votes
- Gauge wiring wrong distributor → stop fee notify until fixed

```bash
# Emergency: clear LM gauge/boost if wrongly set (owner)
cast send $LM "setBoostManager(address)" 0x0000000000000000000000000000000000000000 ...
cast send $LM "setve4626GaugeVoting(address)" 0x0000000000000000000000000000000000000000 ...
```

---

## Phase E — Lottery gauge/boost (separate window)

Only after [lottery canary](./lottery-canary-checklist-2026-07.md) Phase 2 is stable:

1. `WIRE_LOTTERY_MANAGER=1` is **not** re-run; instead owner sets:
   - `LM.setBoostManager(boostManager)`
   - `LM.setve4626GaugeVoting(voting)`
2. Observe personal mult + gauge PPM on one token
3. `armBoostSourceTimelock()` only when addresses frozen

---

## Verification checklist

| Check | Command / expect |
|-------|------------------|
| LM boost still off | `boostManager() == 0` |
| LM gauge still off | `vaultGaugeVoting() == 0` |
| Voting epoch advances | `currentEpoch()` + `timeUntilNextEpoch()` |
| Whitelist non-empty | `whitelistedVaultCount() > 0` (if seeded) |
| Bribes factory → voting | `bribesFactory.gaugeVoting() == voting` |
| Bribes factory depot owner | `bribesFactory.depotOwner() == DEPOT_OWNER` (not the factory) |
| Stream factory → voting | `streamFactory.gaugeVoting() == voting` |
| Surface order (if arming) | Registrar set **before** factory `setSurfaceRegistry`; all canary vaults `isRegistered` **before** `useSurfaceRegistry=true` |
| Surface mode off by default | `voting.useSurfaceRegistry() == false` until Phase C step 5 |
| Frontend panels | `/vote` not “Coming Soon” for configured addresses |
| Docs | Paste addresses into `docs/reference/addresses.md` |

---

## Handoff template (PR / ops note)

```markdown
## Rewards canary handoff

- Date:
- Broadcaster:
- WRAPPED_SHARE_OFT:
- ve4626:
- ve4626Utility / ve33 / veLottery:
- ve4626BoostManager:
- ve4626GaugeVoting:
- ve4626VoterRewardsDistributor:
- BribesFactory4626:
- RewardStreamFactory4626:
- GaugeSurfaceRegistry4626:
- WIRE_LOTTERY_MANAGER: 0
- WIRE_SURFACE_REGISTRY: 0/1
- Vercel env updated: y/n
- addresses.md updated: y/n
```
