# AKITA Solana share-mesh audit

Gap analysis for grandfathered AKITA against [Solana share mesh + lottery policy](./solana-share-mesh-lottery-policy.md).

Audit date: 2026-05-25. Sources: `AKITA_DEFAULTS`, root `.env` (`OVAULT_*`), `kpr/.env` orchestrator vars, `verify-solana-mint-parity.ts` (live Base + Solana RPC).

## Base stack (OK)

| Role | Address |
|------|---------|
| Creator coin | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` |
| Vault | `0x82C06EaAE27B1Ca31fA29F22341A162A670A4471` |
| Wrapper | `0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f` |
| ShareOFT | `0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57` |
| Gauge | `0xB471B53cD0A30289Bc3a2dc3c6dd913288F8baA1` |
| Oracle | `0x8C044aeF10d05bcC53912869db89f6e1f37bC6fC` |

Base ShareOFT lottery on Uniswap buys is the **live** jackpot path today.

## OVault / mesh (partial)

| Item | Status | Notes |
|------|--------|-------|
| `OVAULT_HUB_COMPOSER` | Deployed on Base | `0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1` |
| `OVAULT_SOLANA_EID` | In repo env | `30168` |
| `creatorMesh(akitaToken)` on composer | **NOT configured** | All zeros — verified 2026-05-25 via `read-akita-ovault-mesh-onchain.ts` |
| Split batcher `getOVaultRuntimeConfig` | **NOT enabled** | `hubComposer=0`, `enabled=false` on `0x16aEA…F1D8` |
| AKITA wrapper `isBeneficiaryOperator(composer)` | **N/A** | Grandfathered wrapper predates beneficiary-operator gate |
| `solana_ovault_mesh` paid feature | Unknown for AKITA | Grandfathered vault; may predate paid strategy rows |
| `shareMeshMint` / `assetMeshMint` | **Not in repo for AKITA** | No deploy-session mesh mint pubkeys recorded |
| Composer beneficiary on AKITA wrapper | **Cannot verify** | Old wrapper ABI — must upgrade/wire wrapper or use operator path before `configureCreatorMesh` |

## SolanaBridgeAdapter (canonical `0x700b4B…`) — on-chain 2026-05-25

| Token | `isRegistered` | `tokenToSolanaMint` |
|-------|----------------|---------------------|
| AKITA creator `0x5b6741…` | **false** | `0x00…00` |
| ShareOFT `0x4df30f…` | **false** | `0x00…00` |

Re-run anytime:

```bash
pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
# Uses BASE_READ_RPC_URL or BASE_RPC_URL from frontend/.env
```

| Item | Value |
|------|--------|
| Strict-parity mint (PDA) | `9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp` |
| On-chain Solana name/symbol | `akita` / `akita` (matches Base lowercase policy) |
| Canonical adapter `0x700b4B…` registration | **FAIL** — `tokenToSolanaMint` is zero |

```bash
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts \
  --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75
# exit 2: adapter_not_registered
```

## Bridge-wrapped creator SPL (legacy Pipe C — not lottery token)

Legacy adapter `0x90F578…` / `HuY4…9ouR` may still hold historical mapping — **not** canonical; see [solana-bridge-naming-invariant.md](./solana-bridge-naming-invariant.md).

## Current orchestrator env (WRONG grain for lottery policy)

From `kpr/.env` (production-shaped; rotate secrets independently):

| Variable | Current value | Policy fit |
|----------|---------------|------------|
| `SOLANA_CREATOR_MINTS` | `9JWh…LJdp` | **Wrong** — creator SPL, not share mesh |
| `SOLANA_SHARE_OFT_MAPPING` | `9JWh…` → ShareOFT | **Wrong** — maps creator mint as share |
| `SOLANA_BRIDGE_ADAPTER` | `0x700b4B…` | OK for registration; AKITA not registered |
| `KEEPER_SOLANA_RECONCILE_ACTIONS` (Vercel runbook) | **Set to** `settle_fees,winner_relay` only | Local `kpr/.env`: `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0` |

Enabling `relay_entries` today would relay hook entries keyed to **creator SPL**, not share-mesh pool buys.

## Share mesh on Solana (target — missing)

| Step | Status |
|------|--------|
| LZ share mesh mint deployed + peered to Base ShareOFT | **Not confirmed** |
| ShareOFT bridged Base → Solana for LP seed | **Not done** |
| Meteora pool base asset = share mesh | **Not done** (existing provisioner path targets creator SPL) |
| Transfer hook on share mesh + pool allowlist | **Not done** |
| `relay_entries` enabled | **Should stay off** |

## Meteora / provisioner (legacy vs target)

| Path | Asset | Lottery? |
|------|-------|----------|
| `POST /provision` + `create-dlmm-pool` (today) | Bridge-wrapped creator SPL `9JWh…` | **No** (wrong token; trading only) |
| Target Pipe A | Share mesh from Base ShareOFT bridge | **Yes** (pool buy only) |

Meteora rejects Token-2022 + Transfer Hook — resolve before enabling Solana hook lottery on DLMM (see policy doc).

## Recommended AKITA sequence

### Now (ops, no new mints)

1. **Vercel + Vultr:** `KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay` only; disable `relay_entries`.
2. **Do not** treat `9JWh…` hook relay as production lottery.
3. Continue Base lottery via ShareOFT Uniswap on Base.

### Phase A — Share mesh exists

1. Read on-chain: `OVaultHubComposer.creatorMesh(0x5b6741…)` and batcher `getOVaultRuntimeConfig()`.
2. If mesh unset: operator wiring via `OperationalWiring.s.sol` / registry peer seeding + `configureCreatorMesh` (asset mesh + **share mesh** tokens, peers, EID 30168).
3. Bridge AKITA ShareOFT `0x4df30f…` → Solana share mesh (record mint pubkey as **canonical lottery Solana mint**).

### Phase B — Pool + lottery relay

1. Create Meteora pool: **share mesh** + USDC/SOL (params TBD).
2. Init hook PDAs on **share mesh mint**; allowlist Meteora program.
3. Update orchestrator:

```bash
SOLANA_CREATOR_MINTS=<share_mesh_mint_pubkey>
SOLANA_SHARE_OFT_MAPPING='{"<share_mesh_mint_pubkey>":"0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57"}'
```

4. Re-enable `relay_entries`; run one test buy and confirm Base `processSwapLottery`.

### Optional (Pipe C — strategy)

- Register AKITA on canonical adapter (`registerSolanaBridgeToken`) for **strategy bridge**, independent of lottery.
- Still does not make `9JWh…` the lottery share token.

## Blockers summary

| Blocker | Blocks |
|---------|--------|
| No share mesh mint / peer for AKITA | Pipe A entirely |
| `relay_entries` on creator SPL | Wrong lottery entries if enabled |
| Adapter not registered | Strategy bridge + some preflight paths |
| Meteora + hook incompatibility | Solana pool-buy detection design |
| Grandfathered vault / no registry row | Keeper HTTP fan-out (separate — see keeper activation doc) |

## Cross-links

- [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md) — canonical policy
- [akita-keeper-stack-activation.md](./akita-keeper-stack-activation.md) — Base Charm/Ajna + orchestrator turn-on
- [solana-bridge-naming-invariant.md](./solana-bridge-naming-invariant.md) — creator SPL `9JWh…` derivation (not share mesh)
