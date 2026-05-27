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
| Per vault | `solana_ovault_mesh` $100 USDC + LZ finalize fee | Same |
| Ready when | `verify-batcher-pipe-a-readiness.ts` exit **0** | Path 1 + pool + LP (+ B2 env) |

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
4. Creator activates `solana_ovault_mesh`; `finalizePhase2` bridges 30% ShareOFT.
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
