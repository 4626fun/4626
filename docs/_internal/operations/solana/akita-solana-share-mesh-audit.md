# AKITA — Solana share-mesh gap audit

AKITA-specific on-chain/env gaps vs
[share-mesh policy](../operations/solana/solana-share-mesh-lottery-policy.md).
Runbooks: [budget paths](./solana-share-mesh-budget-paths.md) and
[per-creator provisioning](../operations/solana/solana-share-mesh-creator-provisioning.md).

Historical snapshot verified: 2026-05-25. Re-run
`read-akita-ovault-mesh-onchain.ts` before relying on any status below.
The active v1.19.0 batcher is
`0x02D7abC547F8B1e7E2D7a919D8D1005918361750`.

## Base snapshot (not the mesh wire target)

| Role | Address | Notes |
|------|---------|--------|
| Creator coin | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | |
| Current ShareOFT mapping (not `■AKITA`) | `0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57` | Pre–Pipe-A vault receipt; wrapper still points here; **`totalSupply = 0`**; **do not** use as LayerZero mesh wire target |
| Vault / wrapper | `0x82C06EaAE27B1Ca31fA29F22341A162A670A4471` / `0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f` | |

Base ShareOFT Uniswap buys on the **current AKITA ShareOFT mapping** (`0x4df30…`) = live lottery today on Base. Solana tradable share mesh uses a **separate** LZ mint (`■AKITA` on Solana oftStore) + a **new** Base mesh OFT wire.

## Historical gaps (2026-05-25)

| Item | Status |
|------|--------|
| `creatorMesh(AKITA)` on composer | **Unset** (zeros) |
| Batcher `solanaShareOftPeer()` | **Unset** — historical global-peer check; this field is retired and must not be repaired |
| LZ share mesh on Solana | **Not deployed** |
| ShareOFT on adapter `0x700b4B…` | **Not registered** — legacy Twin grain, not an active blocker |
| Meteora on share mesh | **Not done** |
| Orchestrator `SOLANA_CREATOR_MINTS` | **`9JWh…`** — wrong grain (creator SPL) |
| Solana lottery relay | **Unavailable** — Twin-dependent entry/winner workflows were removed |

## Wrong grain (do not use for lottery)

| Asset | Mint / mapping | Role |
|-------|----------------|------|
| Creator SPL | `9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp` (`akita`/`akita`) | Adapter grain — not share mesh |
| Current orchestrator env | `9JWh…` → ShareOFT | Misconfigured for policy |

Historical adapter parity (not share mesh):
`pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75`.
Do not use its result to gate the active LZ route.

## AKITA unblock sequence

Follow [budget paths](./solana-share-mesh-budget-paths.md) and
[per-creator provisioning](../operations/solana/solana-share-mesh-creator-provisioning.md)
with AKITA constants:

- Solana share mesh: reuse AKITA's existing LZ OFT store
  `G3rfXFKvARH8emUVkiu6RrdSkXZQFGfsqKbF9P7EqXeN` and mint
  `5puVV8bQZp4YoEfGq4RitQFRVC3SJiHBSydFuFZUXHQv`, or provision a replacement
  only through the canonical runbook
- Base ShareOFT: wire the **new** deploy's `■AKITA` ShareOFT to that store
- Registry: before finalize, explicitly call
  `Registry4626.setRemoteOFTPeerBytes32(AKITA, 30168, 0xdf9a9ef76562adbfe0231e2c5cee77f24a1f9eac519d3fbb029fe5b454d9cd3f)`
- Batcher: verify destination + OVault runtime only; there is no adapter/global-peer requirement
- Meteora: create the pool against the LZ share-mesh mint using the budget-path runbook
- Creator coin: `0x5b674196812451b7cec024fe9d22d2c0b172fa75`
- Display: `TOKEN_SYMBOL='■AKITA'`, `TOKEN_NAME='Akita Share Token'`
- On-chain read: `pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts`

**Now:** configure only current maintenance actions such as
`KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,price_monitor`; do not restore the
historical relay on `9JWh…`.

## Blockers

| Blocker | Blocks |
|---------|--------|
| No LZ store/mint or explicit registry peer | Pipe A |
| Historical creator-SPL relay | Removed wrong-grain path |
| Adapter not registered | Legacy Twin grain only; does not block active Pipe A |
| B1 pool not provisioned | Solana trading; B2 relay remains blocked |

Keeper/registry gaps (separate):
[akita-keeper-stack-activation.md](../akita/akita-keeper-stack-activation.md).
