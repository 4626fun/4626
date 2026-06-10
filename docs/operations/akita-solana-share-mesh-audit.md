# AKITA — Solana share-mesh gap audit

AKITA-specific on-chain/env gaps vs [share-mesh policy](./solana-share-mesh-lottery-policy.md). Runbooks: [budget paths](./solana-share-mesh-budget-paths.md).

Last verified: 2026-05-25 (re-run `read-akita-ovault-mesh-onchain.ts` before ops).

## Base (grandfathered vault — not the mesh wire target)

| Role | Address | Notes |
|------|---------|--------|
| Creator coin | `0x5b674196812451b7cec024fe9d22d2c0b172fa75` | |
| Legacy ShareOFT (`wsAKITA`) | `0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57` | Pre–Pipe-A vault receipt; wrapper still points here; **`totalSupply = 0`**; **do not** use as LayerZero mesh wire target |
| Vault / wrapper | `0x82C06EaAE27B1Ca31fA29F22341A162A670A4471` / `0x58Cd1E9248F89138208A601e95A531d3c0fa0c4f` | |

Base ShareOFT Uniswap buys on **legacy `wsAKITA`** = live lottery today on Base. Solana tradable share mesh uses a **separate** LZ mint (`■AKITA` on Solana oftStore) + a **new** Base mesh OFT wire — not `0x4df30…`.

## Gaps

| Item | Status |
|------|--------|
| `creatorMesh(AKITA)` on composer | **Unset** (zeros) |
| Batcher `solanaShareOftPeer()` | **Unset** — blocks Pipe A finalize |
| LZ share mesh on Solana | **Not deployed** |
| ShareOFT on adapter `0x700b4B…` | **Not registered** |
| Meteora on share mesh | **Not done** |
| Orchestrator `SOLANA_CREATOR_MINTS` | **`9JWh…`** — wrong grain (creator SPL) |
| `relay_entries` | **Must stay off** until share-mesh pool + B2 path |

## Wrong grain (do not use for lottery)

| Asset | Mint / mapping | Role |
|-------|----------------|------|
| Creator SPL | `9JWhbEAVpuHQdx1x5kSH62p6ZrWivqcBfARhvdLsLJdp` (`akita`/`akita`) | Legacy adapter grain — not share mesh |
| Current orchestrator env | `9JWh…` → ShareOFT | Misconfigured for policy |

Adapter parity (not share mesh): `pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts --creator 0x5b674196812451b7cec024fe9d22d2c0b172fa75`

## AKITA unblock sequence

Follow [budget paths](./solana-share-mesh-budget-paths.md) with AKITA constants:

- Share mesh Base OFT: deploy/wire **new** mesh OFT (not legacy `wsAKITA` `0x4df30…`)
- Creator coin: `0x5b674196812451b7cec024fe9d22d2c0b172fa75`
- Display: `TOKEN_SYMBOL='■AKITA'`, `TOKEN_NAME='Akita Share Token'`
- On-chain read: `pnpm -C frontend exec tsx scripts/ops/read-akita-ovault-mesh-onchain.ts`

**Now:** `KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay` only; do not enable `relay_entries` on `9JWh…`.

## Blockers

| Blocker | Blocks |
|---------|--------|
| No share mesh + peer | Pipe A |
| `relay_entries` on creator SPL | Wrong lottery entries |
| Adapter not registered | Strategy bridge preflight |
| B1 vs B2 not chosen | Phase B Meteora/hook plan |

Keeper/registry gaps (separate): [akita-keeper-stack-activation.md](./akita-keeper-stack-activation.md).
