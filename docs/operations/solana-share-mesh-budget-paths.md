# Solana share mesh — budget paths (greenfield)

Operator budget and sequencing for Pipe A (30% ShareOFT auto-bridge at `finalizePhase2`) and optional Solana pool-buy lottery. Assumes current batcher cutover (`0xa99058f424FB3ACC639F59355C65C40149030651`) and policy in [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md) (**B1/B2 fork** — read policy implementation-status table before Phase B).

Related: [batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md), [verify-batcher-pipe-a-readiness.ts](../../frontend/scripts/ops/verify-batcher-pipe-a-readiness.ts).

## Scope (locked for current ops)

**Solana side = share token only.**

- Deploy and peer one **LayerZero share-mesh OFT** on Solana (EID `30168`) — vault shares bridged from Base `CreatorShareOFT`.
- Wire `solanaShareOftPeer(bytes32)` on the batcher to that mint’s peer address.
- **Do not** deploy a separate Solana **asset mesh** (creator-coin OFT) for this milestone. Compose-deposit (Pipe B) is out of scope until product asks for it.

What already exists and is reused:

- **`creator-share-hook`** on mainnet (`EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`) — **B2** on-chain lottery relay only; not a substitute for the LZ share OFT.

---

## Path comparison

| | **Path 1 — Share on Solana (minimum)** | **Path 2 — Pool + lottery (optional)** |
|---|---|---|
| **Goal** | Greenfield finalize bridges 30% ShareOFT → Solana share mint | Solana trading on Meteora (+ **B2:** pool-buy lottery relay to Base) |
| **Solana deploy** | **Share-mesh OFT only** | Reuses Path 1 mint + Meteora pool (+ B2 hook PDAs if on-chain relay) |
| **Solana lottery** | No — Base ShareOFT DEX buys only | **B2:** yes after pool + `relay_entries`. **B1:** Meteora trading only until off-chain relay ships |
| **One-time platform cost** | **~3.0–4.0 SOL** (measured rent below) + Base gas | **+ ~0.25–0.65 SOL** DLMM pool; **+ ~0.10 SOL** hook rent if **B2** |
| **Per vault (product)** | **`solana_ovault_mesh` — $100 USDC** | Same entitlement |
| **Per finalize** | LZ bridge fee + `msg.value` | Same |
| **Readiness** | `verify-batcher-pipe-a-readiness.ts` exit **0** | Path 1 + Meteora pool + LP; **B2** adds hook PDAs + keeper env |

### Measured costs (2026-05-27, local test validator + `solana rent`)

Public **devnet faucet was rate-limited** (`429` on `api.devnet.solana.com`). Costs were measured on a **local `solana-test-validator`** instead — rent uses the **same lamports/byte formula as mainnet**, so these numbers apply to production without spending real SOL.

Reproduce:

```bash
# Terminal 1 — local validator (unlimited faucet)
solana-test-validator --reset --quiet

# Terminal 2 — Path 1 program deploy proxy
solana airdrop 20 $(solana-keygen pubkey /tmp/4626-devnet-cost-probe.json) \
  --url http://127.0.0.1:8899 --keypair /tmp/4626-devnet-cost-probe.json
SOLANA_RPC_URL=http://127.0.0.1:8899 SKIP_METEORA=1 SKIP_HOOK=1 \
  pnpm -C kpr solana:cost-probe-devnet
```

| Component | Bytes | Measured (SOL) | How |
|-----------|-------|----------------|-----|
| **Path 1 — program deploy proxy** (323 KB hook `.so` ≈ LZ OFT size class) | 323,432 | **2.255** | Payer balance delta on local validator |
| **Path 1 — LZ OFT program (560 KB, LZ docs size)** | 573,440 | **3.992** | `solana rent 573440` (same formula as deploy) |
| Mint + escrow + OFT Store + PeerConfig | ~2 KB | **~0.02** | `solana rent` on account layout |
| **Path 1 subtotal (560 KB OFT + accounts)** | | **~4.0** | |
| **Path 2 — Token-2022 mint** (TransferFee + TransferHook) | 346 | **0.0033** | `solana rent` — **B2 only** |
| CreatorConfig PDA | 501 | **0.0044** | `solana rent` — **B2 only** |
| PendingEntries PDA | 12,352 | **0.0869** | `solana rent` — **B2 only** |
| WinnerRecord PDA | 89 | **0.0015** | `solana rent` — **B2 only** |
| **Path 2 hook subtotal (rent only)** | | **~0.10** | **B2 only** |
| **Path 2 — Meteora DLMM pool create** | multi-acct | **~0.25–0.6** | Not tx-measured (devnet clone missing token-launch proof); rent/docs estimate |
| **Path 1 + 2 (560 KB OFT + hook + pool)** | | **~4.4–4.7** | Full B2 stack; B1 omits ~0.10 hook rent |
| Tx fees + one retry buffer | | **~0.1** | |
| **Recommended ops wallet load** | | **6 SOL** | |
| **Expected actual spend (Path 1 deploy only)** | | **~4.0–4.5 SOL** | Dominated by 560 KB LZ OFT program rent; add ~0.25–0.6 SOL for Meteora pool (B1/B2) |

Replace Meteora pool row with a payer delta from the first successful devnet/mainnet pool create when token-launch proof accounts are wired.

**Devnet hook prerequisite:** `creator-share-hook` (`EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`) is **not** on public devnet by default. The cost probe measures hook PDAs via rent when the program is missing; full tx measurement requires a one-time devnet deploy with the program-id keypair:

```bash
# After building: cd programs/creator-share-hook && anchor build
COST_PROBE_HOOK_PROGRAM_KEYPAIR=/path/to/Ejpzi-keypair.json \
  SOLANA_RPC_URL=https://api.devnet.solana.com \
  pnpm -C kpr solana:cost-probe-devnet
```

When devnet faucet is limited, use local validator (same rent formula):

```bash
solana-test-validator --reset --url devnet --clone-upgradeable-program LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo --quiet
SOLANA_RPC_URL=http://127.0.0.1:8899 pnpm -C kpr solana:cost-probe-devnet
```

**Old wide bracket (2–8 SOL) was retired** — it mixed asset mesh, Alpha Vault, and worst-case retries. Current scope is share OFT + hook + DLMM pool only.

### Why ~2–4 SOL (not a wide 2–8 band)

Path 1 is **one** LZ OFT on Solana (share mesh), not asset mesh + share mesh. The repo has **no measured mainnet quote** for that deploy yet — the bracket is order-of-magnitude until the first LZ run:

| Component | Typical range | Notes |
|-----------|---------------|--------|
| Solana account rent (mint, OFT store, peer config) | **~0.02 SOL** | Measured via `solana rent` |
| LZ OFT program deploy | **~2.8–3.9 SOL** | Dominates Path 1; 560 KB ≈ 3.90 SOL per LZ docs |
| Deploy / init txs + retries | **~0.1–0.3 SOL** | Buffer |
| **`setSolanaShareOftPeer`** | Base gas only | Already scripted |
| **Asset mesh on Solana** | **$0 for this milestone** | Explicitly out of scope |

Replace the measured table above with Solscan payer deltas after the first mainnet run.

---

## Path 1 — Share token on Solana

**Unlocks:** Greenfield `finalizePhase2` with 30% ShareOFT auto-bridge to the Solana share mint.

### Budget

| Item | Est. cost | Payer |
|------|-----------|-------|
| LayerZero **share-mesh OFT** on Solana (EID `30168`) + peer to Base ShareOFT | **~4.0 SOL** (560 KB program rent + accounts) | Protocol (one-time, platform-wide) |
| Safe `setSolanaShareOftPeer(bytes32)` on batcher | **<$5** Base gas | Protocol treasury |
| Optional: per-vault registry peer seed | Base gas | Protocol |
| **`solana_ovault_mesh`** per vault | **$100 USDC** | Creator |
| 30% ShareOFT LZ `send` at finalize | **Variable** (LZ quote) | Creator tx |

### Checklist

1. **Deploy + peer (LayerZero ops, external to repo)**
   - Solana **share** OFT for EID `30168` (not creator/asset mesh)
   - Peer to Base `CreatorShareOFT` / share-mesh topology
   - Record **share-mesh peer bytes32** → batcher

2. **Wire batcher**
   ```bash
   pnpm -C frontend exec tsx scripts/ops/execute-batcher-share-oft-peer-safe.ts \
     --share-oft-peer 0x<64-hex-share-mesh-peer>
   ```

3. **Verify**
   ```bash
   pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts \
     --batcher 0xa99058f424FB3ACC639F59355C65C40149030651
   ```

4. **Greenfield deploy**
   - Creator activates `solana_ovault_mesh`
   - Payable `finalizePhase2` includes LZ fee for 30% bridge to share mint

5. **Keeper (until Phase 2)**
   ```bash
   KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay
   SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
   ```

**Done when:** readiness exit `0`; one greenfield finalize lands share supply on the Solana share mint.

---

## Path 2 — Pool + lottery (optional, after Path 1)

**Prerequisite:** Path 1 complete — share mint live and batcher peer set.

### Budget (incremental)

| Item | Est. cost | Lane |
|------|-----------|------|
| Bridge ShareOFT Base → Solana share mint (LP seed) | LZ fee on Base (not SOL) | B1 or B2 |
| Meteora DLMM on tradable share mint + quote | **~0.25–0.6 SOL** | B1 or B2 |
| Hook PDAs (`creator-share-hook`) | **~0.10 SOL** rent | **B2 only** |
| `relay_entries` orchestration | Ongoing SOL + Base gas | **B2 only** (keeper shipped) |

`configureCreatorMesh` / asset mesh on Base or Solana is **only required if** product later enables Pipe B compose-deposit — not for Path 1 or Path 2 lottery.

### Phase B checklist

See mint-type fork in [policy Phase B](./solana-share-mesh-lottery-policy.md#phase-b--pool--lottery-relay). Summary:

1. **Pick lane** — **B1:** LZ standard SPL share mesh; **B2:** Token-2022 + `TransferHook` (one mint for pool + relay; not the legacy creator SPL `9JWh…`).
2. **B2 only (before pool create):** Meteora admin `token_badge` → `setup-creator-full` hook PDAs → allowlist Meteora program in `CreatorConfig`.
3. Meteora DLMM — **B1:** base = LZ share mesh mint; **B2:** base = hook mint from step 2. Quote = WSOL/USDC. `ACTIVATION_DELAY_SECONDS=0`; `METEORA_HAS_ALPHA_VAULT=1` only for Alpha Vault lane.
4. Seed LP (bridge share supply from Base first if needed).
5. Orchestrator env (**B2 only** — skip for B1 Meteora-only):
   ```bash
   SOLANA_CREATOR_MINTS=<mint_pubkey>
   SOLANA_SHARE_OFT_MAPPING='{"<mint_pubkey>":"<base_share_oft_address>"}'
   KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
   SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
   ```
6. **B2:** test pool buy → `PendingEntries` → Base lottery. **B1:** test Meteora swap only; Base lottery via Uniswap.

### Meteora UI visibility (required for discoverable trading)

See also [policy — B1 vs B2 implementation status](./solana-share-mesh-lottery-policy.md#b1-vs-b2--implementation-status-read-before-phase-b).

Meteora DLMM is **permissionless for standard SPL mints** — no separate listing team. A pool shows on [app.meteora.ag](https://app.meteora.ag) when **pool + activation + liquidity** exist.

**Do not conflate:**

- **Meteora admin `token_badge`** — on-chain PDA for permissioned Token-2022 extensions (`TransferHook`, etc.). Required **before** pool create on hook mints. Process: [Token 2022 extensions](https://docs.meteora.ag/overview/products/dlmm/token-2022-extensions).
- **`prepare-token-badge.ts`** — generates wallet/token-list JSON for display. Run with `CREATOR_TOKEN` + stable `TOKEN_METADATA_URI`; does **not** submit to Meteora admin.

| Gate | Why it matters | Ops action |
|------|----------------|------------|
| **Correct mint** | Wrong grain = wrong pool | **Share mesh** LZ mint as `TOKEN_MINT_X` — not creator SPL `9JWh…` |
| **Pool exists on-chain** | UI indexes DLMM pair PDAs | `pnpm -C kpr solana:create-dlmm-pool` |
| **Activation time passed** | Pre-activation pools are not swappable | Default **`ACTIVATION_DELAY_SECONDS=0`**. Alpha Vault lane: `604800` + `METEORA_HAS_ALPHA_VAULT=1` |
| **Initial liquidity seeded** | Empty pools do not swap | Bridge shares from Base, then add DLMM LP (UI or SDK) |
| **Quote = WSOL/USDC** | Meteora UX default | `TOKEN_MINT_Y=NATIVE_MINT` (WSOL) unless product picks USDC |
| **Display metadata (optional)** | Name/logo in explorers/wallets | `BADGE_TARGET=meteora pnpm -C kpr solana:prepare-token-badge` |
| **Token-2022 + TransferHook (B2 only)** | Pool create fails without admin badge | Meteora `token_badge` **before** pool create, or use standard SPL mesh (B1) |

**Share-mesh target (Path 2):** pair **LZ share-mesh mint** + WSOL — not legacy bridge-wrapped creator SPL (`9JWh…`).

**Verify after provisioning:**

```bash
# 1) Pool PDA printed by create-dlmm-pool
open "https://app.meteora.ag/pools?search=<share_mesh_mint_or_pool_pda>"

# 2) Swap route exists (Jupiter aggregates Meteora when pool has liquidity)
# Search mint on jup.ag — "all tokens" if not yet on strict list
```

**Legacy provisioner note:** `SOLANA_AUTO_POOL=1` on `POST /provision` targets **creator SPL**, not share mesh — and passes `METEORA_HAS_ALPHA_VAULT=1` + 7-day activation for Alpha Vault launch. Do not use it for Path 2 share-mesh lottery.

---

## Sequencing

```text
P0  LZ share OFT on Solana + setSolanaShareOftPeer  →  greenfield Pipe A live
P1a (optional B1) Meteora pool + LP on LZ share mesh  →  Solana trading; Base lottery via Uniswap
P1b (optional B2) badge + hook PDAs + pool + relay_entries  →  Solana pool-buy lottery relay
```

Asset mesh on Solana: **not in current plan.**

**Pipe C (orthogonal):** bridge-wrapped creator SPL naming and adapter parity —
[solana-bridge-naming-invariant.md](./solana-bridge-naming-invariant.md). Do not
use that mint grain for share-mesh lottery.

---

## Reference addresses (current mainnet)

| Role | Address |
|------|---------|
| DeploymentBatcher (Pipe A) | `0xa99058f424FB3ACC639F59355C65C40149030651` |
| OVaultHubComposer | `0x7dF44cBB93a5191837a988f0Cc441E3811C39CD1` |
| Solana EID | `30168` |
| `creator-share-hook` program | `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` |

## Verification

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts
```

After share peer is wired:

```bash
pnpm -C frontend exec tsx scripts/ops/execute-batcher-share-oft-peer-safe.ts \
  --share-oft-peer 0x<peer>
```
