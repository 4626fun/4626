# Lottery canary Phase 0 status — 2026-07-11

> **Superseded snapshot:** the v1.18.0 addresses and read-only results below are
> retained as evidence from 2026-07-11. Current operations use v1.19.1:
> LotteryManager `0xB45E68a5867935a5734E4185977F81c528006650` and Registry
> `0x1365e9CEfc516f8A287c51FBaeF96FB4581c6CA2`.

## Cutover complete

| Item | Value |
|------|-------|
| Canonical `LotteryManager4626` (current) | `0xB45E68a5867935a5734E4185977F81c528006650` |
| Superseded canary LM (historical) | `0xB68F359e01626Ec5d15C624037311C70DacAba43` |
| PricingLib | `0x1d74A8e2F88eb12C167a912C6611407c4c4a7C6D` (pre-existing CREATE2) |
| Registry `getLotteryManager(8453)` | → new LM |
| AMOE router `manager()` | → new LM |
| Old LM `0xbE87AD…` | `isActive=false` |
| Deploy script | `script/DeployLotteryManagerCreate2V1180.s.sol` |

**Historical probe:** `pnpm -C frontend ops:verify-lottery-canary-phase0`

### Phase 0 after cutover

| Check | Live |
|-------|------|
| `boostManager` / `vaultGaugeVoting` | `0x0` |
| Boost timelock armed | `false` |
| `singleVaultJackpotOnly` | `true` |
| `deferredVrfQueueLength` | `0` |
| Oracle staleness / maxDev / window | `7200` / `2000` / `1800` |
| `lotteryConfig.isActive` | `true` (base-odds canary) |
| Readiness criticals | none |
| **blocker** | **null** — remediation bytecode live |

### Env

- Local + Vercel: `LOTTERY_MANAGER` / `VITE_LOTTERY_MANAGER` → new address; retired `CREATOR_LOTTERY_MANAGER` alias removed from active sync
- Fail-closed: `DEPLOY_ENFORCE_PHASE2_INVARIANTS=true`, `KEEPER_ENFORCE_COMPLETION_INVARIANTS=true`, `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`

### Next

Phase 2 soak (one lane, small notionals, boost still off). Do **not** wire `boostManager` or `armBoostSourceTimelock()` yet.
