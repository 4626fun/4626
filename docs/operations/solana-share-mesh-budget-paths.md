# Solana share mesh — budget & runbook

Operator costs and sequencing for **Pipe A** (30% ShareOFT auto-bridge at `finalizePhase2`) and optional **Path 2** (Meteora + lottery).

Policy: [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md). Batcher: `0xa99058f424FB3ACC639F59355C65C40149030651`.

## Scope

- **In:** one LZ **share-mesh OFT** on Solana (EID `30168`) + `setSolanaShareOftPeer` + optional Meteora/lottery (B1/B2).
- **Out:** compose deposit lane (Pipe B), bridge-wrapped creator SPL as lottery token, `POST /provision` auto-pool for share mesh.

Reused on mainnet: `creator-share-hook` (`EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`) — **B2 relay only**, not a substitute for LZ share OFT.

## Path comparison

| | **Path 1 — minimum** | **Path 2 — optional** |
|--|------------------------|------------------------|
| Delivers | 30% ShareOFT → Solana share mint | Meteora trading (+ B2: pool-buy lottery relay) |
| Solana lottery | No (Base ShareOFT buys) | B2: yes; B1: trading only |
| Platform SOL (one-time) | **~4.0** | + **~0.25–0.6** pool; + **~0.10** hook if B2 |
| Per vault | **`vault_full_deploy` $499 USDC** (bundles Charm + Ajna + share mesh + Meteora add-on) + LZ finalize fee | Same |
| Ready when | `verify-batcher-pipe-a-readiness.ts` exit **0** | Path 1 + pool + LP (+ B2 env) |

### Devnet rehearsal (before mainnet LZ)

Rehearse Base wiring + Solana rent without touching mainnet batcher:

```bash
pnpm -C frontend ops:pipe-a-devnet-rehearsal
```

Runs Forge `ShareOftPeer` tests, Vitest wiring/fee suites, and optional `pnpm -C kpr solana:cost-probe-devnet` (Path 1 rent proxy). Set `SOLANA_PRIVATE_KEY` and a **paid** `SOLANA_RPC_URL` or `RPC_URL_SOLANA_TESTNET` — public `api.devnet.solana.com` often returns 429.

Full LZ OFT store + peer bytes32 on devnet (EID **40168**) still uses LayerZero `create-lz-oapp` + `hardhat lz:oft:solana:create`. **Do not** call mainnet `setSolanaShareOftPeer` with a devnet peer — mainnet uses EID **30168**.

### ULN security — 6-of-9 optional DVNs (mainnet)

Share-mesh LZ wiring must **not** use a single-DVN `1/1` stack. Production **Base ↔ Solana** (EID `30184` ↔ `30168`) uses **no required DVNs** and **6-of-9 optional** — any six of nine independent verifiers must sign:

```typescript
// [ requiredDVN[], [ optionalDVN[], threshold ] ]
const MAINNET_SHARE_MESH_OPTIONAL_DVNS = [
  'LayerZero Labs',
  'Google',
  'Nethermind',
  'Horizen',
  'Deutsche Telekom',
  'Nansen',
  'Frax',
  'Wyoming',
  'P-OPS',
] as const

[[], [[...MAINNET_SHARE_MESH_OPTIONAL_DVNS], 6]]
```

All nine names appear on **both** `base` and `solana` in [LayerZero metadata](https://metadata.layerzero-api.com/v1/metadata) (16-chain intersection today). Re-verify before wire; do not include a name that exists on only one side.

**Devnet ceiling:** `solana-testnet` ↔ `arbitrum-sepolia` shares only **three** DVNs (LayerZero Labs, Paxos, Anchorage). Rehearsal wiring uses **2-of-3 optional** — you cannot exercise full 6-of-9 on that pathway until mainnet or a testnet pair with ≥9 shared DVNs exists.

After changing DVNs, re-run `hardhat lz:oft:solana:init-config` + `hardhat lz:oapp:wire --ci`, then confirm:

```bash
pnpm hardhat lz:oft:solana:debug --eid 40168 --dst-eids 40231 --action peers
# devnet: optionalDVNThreshold: 2, optionalDVNs: LayerZero Labs, Paxos, Anchorage
# mainnet: optionalDVNThreshold: 6, nine optional DVNs (no required list)
```

Trade-offs vs 2-of-2 required: higher DVN fees (~6 verifiers billed per message), slower tail latency (wait for sixth verifier), but no single-DVN failure mode and no two-operator collusion window.

**Template + per-creator runbook:** copy [templates/layerzero-share-mesh.config.ts](./templates/layerzero-share-mesh.config.ts) into each `create-lz-oapp` scaffold; follow [solana-share-mesh-creator-provisioning.md](./solana-share-mesh-creator-provisioning.md) for creator #N (registry peer → preflight → finalize).

## Measured costs (2026-05-27, local validator)

Rent formula matches mainnet. Reproduce: `pnpm -C kpr solana:cost-probe-devnet` (see `kpr/README.md`).

| Component | SOL | Notes |
|-----------|-----|--------|
| LZ OFT program (~560 KB) | **3.99** | Dominates Path 1 |
| Mint + OFT store + peer | **~0.02** | |
| **Path 1 subtotal** | **~4.0** | |
| Meteora DLMM pool | **~0.25–0.6** | Estimate until first measured pool tx |
| Hook PDAs (B2) | **~0.10** | |
| Buffer + fees | **~0.1** | |
| **Ops wallet load** | **6** | Expect **~4.0–4.5** Path 1; + pool (+ hook if B2) |

## Path 1 — Share mesh live

1. **Deploy + peer** (LayerZero ops): Solana share OFT EID `30168`, peer to Base `CreatorShareOFT`; set mint metadata **`■<TICKER>`** / **`{Creator} Share Token`**.
2. **Wire batcher:**
   ```bash
   pnpm -C frontend exec tsx scripts/ops/execute-batcher-share-oft-peer-safe.ts \
     --share-oft-peer 0x<64-hex-peer>
   ```
3. **Verify:**
   ```bash
   pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
     --batcher 0xa99058f424FB3ACC639F59355C65C40149030651
   ```
4. Creator pays **`vault_full_deploy`** ($499); deploy preflight uses share-mesh OVault checks (not legacy creator-SPL registration). `finalizePhase2` bridges 30% ShareOFT.
5. Keeper until Path 2: `KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay`, `SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0`.

## Path 2 — Meteora (+ optional B2 lottery)

Prerequisite: Path 1 complete.

### B1 (default) — trading

1. `TOKEN_MINT_X=<share_mesh_mint>`, `TOKEN_MINT_Y=WSOL`, `ACTIVATION_DELAY_SECONDS=0` — no alpha vault flag.
2. `pnpm -C kpr solana:create-dlmm-pool`
3. Bridge shares from Base; seed LP.
4. `prepare-token-badge` (below). Keep `relay_entries` **off**.

### B2 — on-chain lottery relay

1. Meteora admin **`token_badge`** → `setup-creator-full` PDAs → allowlist Meteora program (**before** pool).
2. Pool on **same** hook mint; seed LP.
3. Enable orchestrator env (see policy). Test pool buy → `PendingEntries` → Base lottery.

### Meteora UI + display

Pool appears on [app.meteora.ag](https://app.meteora.ag) when **pool + activation passed + LP seeded**.

| Gate | Action |
|------|--------|
| Correct mint | Share mesh LZ mint — not creator SPL `9JWh…` |
| Pool + activation | `create-dlmm-pool`; default immediate activation |
| Liquidity | Bridge + add LP |
| Symbol/name | **`■<TICKER>`** at LZ deploy + badge script |

**Two “badge” types:** Meteora admin `token_badge` (B2 Token-2022 only) ≠ `prepare-token-badge.ts` (wallet/Jupiter JSON).

```bash
TOKEN_MINT=<share_mesh_mint> \
TOKEN_NAME="<Creator> Share Token" \
TOKEN_SYMBOL='■<TICKER>' \
TOKEN_METADATA_URI=<https_or_ipfs_uri> \
CREATOR_TOKEN=0x<creator_coin> \
BADGE_TARGET=meteora \
pnpm -C kpr solana:prepare-token-badge
```

**Do not use:** creator SPL lowercase wraps (`akita`/`akita`), `ws*` tickers, or `SOLANA_AUTO_POOL=1` provisioner path (creator SPL + 7-day activation).



## App wiring (4626 backend)

After **`vault_full_deploy`** payment or post-deploy vault economy provision:

1. `dispatchProvisioning` → `enqueueSolanaShareMeshProvisioning` inserts a keeper `internal_api` job.
2. Keeper worker (`pnpm -C frontend keeper:jobs:worker`) POSTs `/api/keeper/solana/provision-creator` (machine auth).
3. Handler confirms entitlement, stamps activation metadata, pings `SOLANA_ORCHESTRATOR_URL/healthz`, returns operator checklist.

Deploy session preflight (`_continueCore` / `_statusCore`) defaults to **`ensureShareMeshOvaultPreflight`**:

- `getOVaultRuntimeConfig` on the deployment batcher must be enabled.
- `assertShareBridgeOftWiringForFinalize` validates Pipe A wiring for the finalize call.

Set `DEPLOY_SOLANA_LEGACY_BRIDGE_PREFLIGHT=1` only when intentionally running the retired creator-SPL `/api/deploy/registerSolanaBridgeToken` path.

Disable automatic queue enqueue with `SOLANA_SHARE_MESH_PROVISIONING_ENABLED=0` (operator manual follow-up only).

## Sequencing

```text
P0  LZ share OFT + setSolanaShareOftPeer     →  Pipe A live
P1a B1: Meteora pool + LP on share mesh       →  Solana trading (lottery on Base)
P1b B2: badge + hook + pool + relay_entries   →  Solana pool-buy lottery
```

Wrong-grain warning: do not point share-mesh Meteora or `relay_entries` at bridge-wrapped creator SPL mints (e.g. AKITA `9JWh…`). Adapter/provisioner naming rules live in [solana-bridge-naming-invariant.md](./solana-bridge-naming-invariant.md) for historical parity checks only.

## Reference (mainnet)

| Role | Address |
|------|---------|
| DeploymentBatcher | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| OVaultHubComposer | `0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1` |
| Solana EID | `30168` |
| creator-share-hook | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |
