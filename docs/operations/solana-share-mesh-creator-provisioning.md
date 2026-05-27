# Solana share mesh — per-creator provisioning

Operator checklist to wire **creator N** (not only the first platform mesh) for Pipe A: Solana LZ OFT → DVN wire → registry peer → preflight → `finalizePhase2` bridge.

Related:

- Policy: [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md)
- Costs / Path 2: [solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md)
- LZ template: [templates/layerzero-share-mesh.config.ts](./templates/layerzero-share-mesh.config.ts)
- Platform batcher: [deployment/batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md)

## Creator #1 vs creator #N

| | **Creator #1 (platform bootstrap)** | **Creator #2+** |
|--|-------------------------------------|-----------------|
| Batcher `solanaShareOftPeer` | Set once via Safe (`execute-batcher-share-oft-peer-safe.ts`) as platform default | **Do not reuse** another creator's peer for a different share token |
| Registry peer | Can fall back to batcher default at first finalize | **`setRemoteOFTPeerBytes32` required before finalize** |
| Solana side | First LZ OFT deploy + wire | **New OFT store + mint per creator** (`■<TICKER>`) |
| DVN policy | Same template for every creator | Copy [layerzero-share-mesh.config.ts](./templates/layerzero-share-mesh.config.ts) |

Each creator gets their own Base `CreatorShareOFT` at vault deploy. Solana tradable shares are **that** creator's LZ mint — not a shared platform SPL ticker.

## Prerequisites

- [ ] Creator paid **`vault_full_deploy`** (includes `solana_ovault_mesh`) — row in `creator_strategy_features`
- [ ] Platform Pipe A shell ready: `pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts --batcher 0xa99058f424FB3ACC639F59355C65C40149030651` → exit **0** (after first mesh peer is set for creator #1)
- [ ] `SOLANA_PRIVATE_KEY` funded on mainnet (~4+ SOL Path 1 per creator; see budget doc)
- [ ] Paid Solana RPC (`SOLANA_RPC_URL` / `RPC_URL_SOLANA_TESTNET` for rehearsal)

Gather for this creator:

| Field | Example |
|-------|---------|
| `CREATOR_TOKEN` | Base creator coin address |
| Ticker / name | `AKITA`, `jesse` → symbol `■AKITA`, name `Akita Share Token` (`frontend/src/lib/tokens/tokenSymbols.ts`) |
| `REGISTRY` | Live `CreatorRegistry` address |
| Target EID | Solana mainnet **`30168`** |

---

## Step 1 — Solana LZ OFT (Path 1)

In a LayerZero `create-lz-oapp` scaffold (see budget doc devnet rehearsal):

```bash
# One-time per scaffold: anchor build, program deploy (mainnet), then per creator:
pnpm hardhat lz:oft:solana:create --eid 30168 --ci
# If setAuthority fails in Hardhat, fix mint authority with spl-token authorize → OFT store (devnet runbook)
pnpm hardhat lz:oft:solana:update-metadata --eid 30168 --name "Akita Share Token" --symbol "■AKITA"
pnpm hardhat lz:oft:solana:debug --eid 30168 --action oft-store
pnpm hardhat lz:oft:solana:debug --eid 30168 --action token
```

Record from `deployments/solana-mainnet/OFT.json` / debug output:

- `oftStore` / OFT store pubkey
- **Peer bytes32** for registry (OFT store identity used in `setPeer` — same value used in devnet rehearsal)
- SPL `mint` address (for Path 2 Meteora / keeper maps)

---

## Step 2 — Wire DVNs (platform template)

1. Copy [templates/layerzero-share-mesh.config.ts](./templates/layerzero-share-mesh.config.ts) → scaffold `layerzero.config.ts`
2. Point `getOftStoreAddress` / deployments at **this creator's** store
3. Deploy/wire Base-side MyOFT if not already paired to the same OApp config
4. Run:

```bash
export RPC_URL_SOLANA_TESTNET=https://your-devnet-rpc   # rehearsal only
pnpm hardhat lz:oft:solana:init-config --oapp-config layerzero.config.ts --ci
pnpm hardhat lz:oapp:wire --oapp-config layerzero.config.ts --ci
```

Verify ULN (mainnet Base ↔ Solana example):

```bash
pnpm hardhat lz:oft:solana:debug --eid 30168 --dst-eids 30184 --action peers
# Expect: optionalDVNThreshold: 6, nine optional DVNs, requiredDVNCount: 255 (none required)
```

**Hyperliquid:** when enabled, uncomment Base↔Hype (and optional Solana↔Hype) rows in the template — use **`MAINNET_HYPE_INTERSECT_SIX` (6-of-6)**, not the nine-name pool. See budget doc ULN section.

**Devnet:** full 6-of-9 is impossible on arbsep ↔ solana-testnet; template documents **2-of-3** ceiling there.

---

## Step 3 — Registry peer (creator #N)

Before this creator's vault **`finalizePhase2`**, set the Solana bytes32 peer on **`CreatorRegistry`** (not only batcher default):

```bash
export REGISTRY=0x…
export CREATOR_TOKEN=0x…
export SOLANA_EID=30168
export SOLANA_REMOTE_OFT_PEER_BYTES32=0x…   # from Step 1

forge script script/SeedCreatorRegistrySolanaPeer.s.sol:SeedCreatorRegistrySolanaPeer \
  --rpc-url "$BASE_RPC_URL" --broadcast
```

Optional OVault mesh fields (`OVAULT_HUB_COMPOSER`, `OVAULT_SHARE_MESH_TOKEN`, etc.) — set when composer/mesh tokens are known; see script header.

Verify read-only:

```bash
cast call "$REGISTRY" \
  "getRemoteOFTPeerBytes32(address,uint32)(bytes32)" "$CREATOR_TOKEN" 30168 \
  --rpc-url "$BASE_RPC_URL"
```

**Creator #1 only:** batcher `setSolanaShareOftPeer` can seed the first peer if registry was empty at finalize; still prefer explicit registry seed for auditability.

---

## Step 4 — Preflight (greenlight finalize)

- [ ] Registry peer **non-zero** for `(creatorToken, 30168)`
- [ ] Deploy session / UI preflight: share-bridge wiring shows `effectivePeer` matching registry
- [ ] `verify-batcher-pipe-a-readiness.ts` exit **0** (platform shell)
- [ ] Creator entitlement: `solana_ovault_mesh` active or pending on `creatorToken`
- [ ] LZ fee quote path succeeds for payable finalize (session create / `finalizeShareBridgeFee`)

Keeper enqueue (optional, non-blocking):

```bash
# After payment — logs checklist; does not deploy LZ automatically
POST /api/keeper/solana/provision-creator  # machine auth
```

---

## Step 5 — Deploy + finalize

Standard vault deploy through phase 2. On **`finalizePhase2`** / `finalizePhase2WithPermit2`:

- Batcher registers vault stack on `CreatorRegistry` if missing
- Uses registry peer (or batcher default only when registry peer unset)
- Calls `CreatorShareOFT.setPeer(30168, peer)` when mismatched
- Bridges **30%** ShareOFT to Solana via OVault composer path

After finalize, confirm Solana mint received supply and metadata `■<TICKER>`.

---

## Step 6 — Path 2 optional (Meteora / B2)

Only after Path 1 mint exists for **this** creator:

- B1: `TOKEN_MINT_X=<share_mesh_mint>`, `pnpm -C kpr solana:create-dlmm-pool`
- Upsert `creator_meteora_alpha_vaults`
- B2: hook PDAs + `relay_entries` per [lottery policy](./solana-share-mesh-lottery-policy.md)

Update keeper env maps with **this** mint → Base `CreatorShareOFT` address — not bridge-wrapped creator SPL.

---

## Quick verification matrix

| Check | Command / read |
|-------|----------------|
| Platform batcher | `verify-batcher-pipe-a-readiness.ts` → exit 0 |
| Per-creator registry peer | `getRemoteOFTPeerBytes32(creatorToken, 30168)` |
| ShareOFT peer | `cast call $SHARE_OFT "peers(uint32)(bytes32)" 30168` |
| Solana ULN | `lz:oft:solana:debug --action peers` |
| Solana metadata | `lz:oft:solana:debug --action token` |
| Entitlement | `creator_strategy_features` for `solana_ovault_mesh` |

---

## Common failures

| Symptom | Likely cause |
|---------|----------------|
| `SolanaShareOftPeerNotConfigured` at finalize | Registry peer zero and batcher default zero |
| Wrong Solana mint / no supply | Peer pointed at another creator's OFT store |
| Wire fails on DVN name | Name missing on one chain in pathway — shrink pool or pick intersection |
| `optionalDVNThreshold` > pool size | e.g. 6-of-9 on Hyperliquid leg — use Hype six-name block |
| Finalize peer mismatch | Registry peer ≠ `shareOFT.peers(30168)` — re-seed registry or manual `setPeer` |
