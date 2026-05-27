# Solana share mesh — budget paths (greenfield)

Operator budget and sequencing for Pipe A (30% ShareOFT auto-bridge at `finalizePhase2`) and optional Solana pool-buy lottery. Assumes current batcher cutover (`0xa99058f424FB3ACC639F59355C65C40149030651`) and policy in [solana-share-mesh-lottery-policy.md](./solana-share-mesh-lottery-policy.md).

Related: [batcher-pipe-a-cutover.md](./deployment/batcher-pipe-a-cutover.md), [verify-batcher-pipe-a-readiness.ts](../../frontend/scripts/ops/verify-batcher-pipe-a-readiness.ts).

## Scope (locked for current ops)

**Solana side = share token only.**

- Deploy and peer one **LayerZero share-mesh OFT** on Solana (EID `30168`) — vault shares bridged from Base `CreatorShareOFT`.
- Wire `solanaShareOftPeer(bytes32)` on the batcher to that mint’s peer address.
- **Do not** deploy a separate Solana **asset mesh** (creator-coin OFT) for this milestone. Compose-deposit (Pipe B) is out of scope until product asks for it.

What already exists and is reused:

- **`creator-share-hook`** on mainnet (`EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU`) — Phase B lottery only; not a substitute for the LZ share OFT.

---

## Path comparison

| | **Path 1 — Share on Solana (minimum)** | **Path 2 — Pool + lottery (optional)** |
|---|---|---|
| **Goal** | Greenfield finalize bridges 30% ShareOFT → Solana share mint | Pool-buy lottery relay on Solana |
| **Solana deploy** | **Share-mesh OFT only** | Reuses Path 1 mint + Meteora + hook PDAs |
| **Solana lottery** | No — Base ShareOFT DEX buys only | Yes — after Meteora pool + hook path |
| **One-time platform cost** | **~3.0–4.0 SOL** (measured rent below) + Base gas | **+ ~0.35–0.65 SOL** (hook + DLMM pool) |
| **Per vault (product)** | **`solana_ovault_mesh` — $100 USDC** | Same entitlement |
| **Per finalize** | LZ bridge fee + `msg.value` | Same |
| **Readiness** | `verify-batcher-pipe-a-readiness.ts` exit **0** | Path 1 + Phase B keeper env |

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
| **Path 2 — Token-2022 mint** (TransferFee + TransferHook) | 346 | **0.0033** | `solana rent` |
| CreatorConfig PDA | 501 | **0.0044** | `solana rent` |
| PendingEntries PDA | 12,352 | **0.0869** | `solana rent` |
| WinnerRecord PDA | 89 | **0.0015** | `solana rent` |
| **Path 2 hook subtotal (rent only)** | | **~0.10** | |
| **Path 2 — Meteora DLMM pool create** | multi-acct | **~0.25–0.6** | Not tx-measured (devnet clone missing token-launch proof); rent/docs estimate |
| **Path 1 + 2 (560 KB OFT + hook + pool)** | | **~4.4–4.7** | |
| Tx fees + one retry buffer | | **~0.1** | |
| **Recommended ops wallet load** | | **6 SOL** | |
| **Expected actual spend (clean run)** | | **~4.0–4.5 SOL** | Dominated by 560 KB LZ OFT program rent |

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

| Item | Est. cost |
|------|-----------|
| Bridge ShareOFT Base → Solana share mint (LP seed) | LZ fee on Base (not SOL) |
| Meteora DLMM on **share mint** + quote | **~0.25–0.6 SOL** |
| Hook PDAs on share mint (`creator-share-hook`) | **~0.10 SOL** rent |
| `relay_entries` orchestration | Ongoing SOL + Base gas |

`configureCreatorMesh` / asset mesh on Base or Solana is **only required if** product later enables Pipe B compose-deposit — not for Path 1 or Path 2 lottery.

### Phase B checklist

1. Meteora DLMM with **share mint** as base asset.
2. Init hook PDAs on share mint; allowlist pool program.
3. Orchestrator env:
   ```bash
   SOLANA_CREATOR_MINTS=<share_mesh_mint_pubkey>
   SOLANA_SHARE_OFT_MAPPING='{"<share_mesh_mint>":"<base_share_oft_address>"}'
   KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
   SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
   ```
4. Test: pool buy → `PendingEntries` → Base lottery.

---

## Sequencing

```text
P0  LZ share OFT on Solana + setSolanaShareOftPeer  →  greenfield Pipe A live
P1  (optional) Meteora pool + hook + relay_entries  →  Solana lottery
```

Asset mesh on Solana: **not in current plan.**

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
