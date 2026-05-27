# Solana share mesh + lottery policy

Canonical product policy for Solana-side vault shares, pools, and lottery entry.

Related: [budget paths](./solana-share-mesh-budget-paths.md) (costs + runbooks), [AKITA gap audit](./akita-solana-share-mesh-audit.md).

## Decisions

| # | Policy |
|---|--------|
| 1 | Tradable Solana shares = **ShareOFT bridged from Base** (`solana_ovault_mesh` + `OVaultHubComposer`). Not creator re-deposit, not bridge-wrapped creator SPL. |
| 2 | **30% ShareOFT auto-bridges at `finalizePhase2`** when batcher OVault runtime is enabled (replaces deprecated `solana_bridge_strategy`). |
| 3 | **Lottery = pool buy of tradable share token only** — not compose deposit, bridge receipt, or creator-coin trades. |
| 4 | **Meteora base asset = share mesh mint** — not `wrap-token` creator SPL. |
| 5 | **`relay_entries` off** until share-mesh pool exists **and** a live detection path is wired (**B2 hook today**; B1 off-chain relay not shipped). |
| 6 | **Share symbol = `■<TICKER>`**, name = `{Creator} Share Token` — all creators, Base deploy UI + Solana LZ deploy (`frontend/src/lib/tokens/tokenSymbols.ts`). |

## Two lanes (do not conflate)

```text
A — Share mesh (lottery surface)   Base ShareOFT ──LZ──► Solana share mesh ──► Meteora pool buy
B — Compose deposit (no lottery)   Solana asset mesh ──► OVaultHubComposer ──► ShareOFT on Base
```

Do not use bridge-wrapped creator SPL (e.g. AKITA `9JWh…` via `SolanaBridgeAdapter`) as the share-lottery token. That legacy adapter/provisioner grain is out of scope for share-mesh policy.

## B1 vs B2 (Phase B fork)

| | **B1 — default** | **B2 — on-chain hook** |
|--|------------------|------------------------|
| Mint | LZ standard SPL share mesh | Token-2022 + `TransferHook` (one mint for pool + relay) |
| Meteora | `create-dlmm-pool.ts` after Path 1 | Meteora admin `token_badge` **before** pool create |
| Solana lottery relay | **Off** — Base Uniswap lottery | **`relay_entries` on** (`keepr-solana-relay-entries`) |

**Default:** Path 1 + optional B1 Meteora (trading on Solana; lottery on Base); keep `relay_entries` off.

## Base lottery reference

Lottery on Base fires on **ShareOFT DEX buy** (`SwapOnly → non-SwapOnly`). Deposits/wraps/redeems do not enter.

Solana must mirror **secondary share buys**, not primary mint paths.

## Keeper config

**Until Phase B (or B1-only Meteora):**

```bash
# Vercel
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay

# Vultr /etc/4626/solana-keeper-orchestrator.env
SOLANA_ORCHESTRATOR_EXECUTE=1
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
```

**B2 only — after verified pool buy:**

```bash
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
SOLANA_SHARE_OFT_MAPPING='{"<mint_pubkey>":"<base_share_oft_address>"}'
SOLANA_CREATOR_MINTS=<mint_pubkey>   # must match PendingEntries mint
```

## Phase checklist

| Phase | Done when |
|-------|-----------|
| **A** | LZ share mesh live; batcher peer set; supply bridged; mint metadata `■<TICKER>` |
| **B1** | Meteora pool + LP on share mesh; Meteora/Jupiter swappable; `relay_entries` still off |
| **B2** | B1 + hook PDAs + `relay_entries`; pool buy → Base lottery |

Execution steps, costs, and commands: [solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md).

## Deprecated (not share lottery)

| Path | Why |
|------|-----|
| `SOLANA_CREATOR_MINTS` = creator SPL + `relay_entries` | Wrong grain |
| `POST /provision` DLMM on creator SPL | Legacy provisioner / Alpha Vault — not share lottery |
| `solana_bridge_strategy` / `SolanaBridgeStrategy` TVL | Removed for greenfield; use Pipe A 30% finalize bridge |
| Compose deposit | Valid vault entry; no lottery |
| `SolanaBridgeAdapter.buyAndEnterLottery` | Non-canonical alternate |

## Verification

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
pnpm -C kpr preflight-orchestrator
```
