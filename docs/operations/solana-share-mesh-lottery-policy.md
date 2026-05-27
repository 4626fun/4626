# Solana share mesh + lottery policy

Canonical product policy for Solana-side vault shares, pools, and lottery entry. Locked 2026-05-25; **amended 2026-05-27** (B1/B2 mint fork + Meteora UI visibility).

Related: [Solana share mesh budget paths](./solana-share-mesh-budget-paths.md), [AKITA Solana share-mesh audit](./akita-solana-share-mesh-audit.md), [AKITA keeper stack activation](./akita-keeper-stack-activation.md).

## Decisions (locked)

| # | Policy |
|---|--------|
| 1 | Tradable Solana shares come from **bridging ShareOFT from Base** (LayerZero share mesh via `solana_ovault_mesh` + `OVaultHubComposer` wiring). Not from a creator re-deposit loop. |
| 2 | **30% of minted ShareOFT auto-bridges to Solana at finalizePhase2** (LayerZero `send` to `solanaDestination` when OVault runtime is enabled on the batcher). This replaces the deprecated `solana_bridge_strategy` Phase-3 TVL lane. |
| 3 | **Lottery fires only on pool buy** of the tradable share token (**B1:** LZ share mesh; **B2:** hook mint after badge). Not on compose deposit, not on bridge receipt, not on creator-coin trades. |
| 4 | **Meteora DLMM** pairs **share mesh** as the base asset — not bridge-wrapped creator SPL from the deprecated `wrap-token` provisioner path. Pool parameters TBD. |
| 5 | **`relay_entries` is paused** until a share-mesh pool exists **and** a lottery detection path is live on that mint (today: **B2 hook + `PendingEntries` only**; B1 off-chain relay is not shipped). |

## B1 vs B2 — implementation status (read before Phase B)

| Capability | **B1** — LZ standard SPL mesh + Meteora | **B2** — Token-2022 + `TransferHook` |
|------------|----------------------------------------|----------------------------------------|
| Meteora pool + UI (with LP seed) | **Supported now** (`create-dlmm-pool.ts`) | **Supported after** Meteora admin `token_badge` |
| Solana `relay_entries` → Base lottery | **Not wired in repo yet** — keep off; Base Uniswap lottery still works | **Supported now** (`keepr-solana-relay-entries`) |
| `SOLANA_CREATOR_MINTS` target | Share mesh mint (for future B1 indexer) | Share mesh **or** hook mint — must match relay grain |

**Default greenfield recommendation until B1 relay ships:** Path 1 + optional Meteora pool for Solana **trading visibility**; **Base ShareOFT buy lottery**; `relay_entries` **off**.

## Three pipes (do not conflate)

```text
PIPE A — User share distribution (lottery surface)
  Base ShareOFT ──LZ bridge──► Solana share mesh
       └── Meteora pool (share mesh + quote)
       └── Pool buy ──► lottery entry (B2: hook relay today; B1: TBD) ──► Base CreatorLotteryManager (VRF)

PIPE B — User vault entry from Solana (no lottery)
  Solana asset mesh (creator OFT) ──compose deposit──► OVaultHubComposer ──► ShareOFT on Base
  (Optional: bridge ShareOFT back to Solana via Pipe A)

PIPE C — Protocol strategy (not user lottery)
  SolanaBridgeStrategy ──► bridge creator to Solana custody / Meteora Alpha / keeper NAV
  Orthogonal to Pipe A; do not use bridge-wrapped creator SPL as the lottery token.
```

## Base reference behavior

On Base hub, lottery already triggers on **ShareOFT DEX buy** (`SwapOnly → non-SwapOnly` in `CreatorShareOFT._transferWithFees`). Deposits, wraps, and redeems are untaxed and do **not** enter the lottery.

Solana must mirror that economics: **secondary-market buy of vault shares**, not primary mint/deposit.

## Minting / infinite-mint guardrails

- **Vault mint/burn only on Base** (`CreatorOVaultWrapper.depositFor` / `withdrawFor`).
- **Bridging ShareOFT** Base → Solana relocates existing supply (LZ burn/mint), does not create new vault-backed shares.
- **Compose deposit** (Pipe B) mints new ShareOFT once per creator coin consumed in compose — not infinite if OFT burn-on-send is enforced; still **no lottery** on that step.
- **Do not** map bridge-wrapped creator SPL (`9JWh…` strict-parity mint) as the lottery share token — it is creator coin proxy, not share mesh.

## Keeper / orchestrator config

### Until Phase B (share-mesh pool live)

**Vercel** (`akita-llc/4626`):

```bash
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay
# Do NOT include relay_entries
```

**Vultr** (`/etc/4626/solana-keeper-orchestrator.env`):

```bash
SOLANA_ORCHESTRATOR_EXECUTE=1
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=0
# or omit relay_entries from reconcile request actions
```

Base ShareOFT Uniswap buys continue to enter the lottery on Base without Solana relay.

### Phase A — Share mesh on Solana (no lottery yet)

1. Confirm `solana_ovault_mesh` entitlement + `OVaultHubComposer` mesh config for the vault (`hubComposer`, `shareMeshToken`, `solanaSharePeer`, EID `30168`).
2. Bridge **ShareOFT** Base → Solana share mesh (operator/LP seed wallet).
3. Do **not** point `SOLANA_CREATOR_MINTS` / hook PDAs at bridge-wrapped creator SPL for lottery.

### Phase B — Pool + lottery relay

**Mint-type fork (do not skip):**

| Lane | Share mint | Meteora pool | Hook / `relay_entries` |
|------|------------|--------------|------------------------|
| **B1 — Meteora UI default** | LZ **standard SPL** share mesh (Path 1) | Pool **share mesh + WSOL/USDC** | Off-chain swap detection or alternate relay — **not** `setup-creator-full` Token-2022 hook on the LZ mint |
| **B2 — On-chain hook** | Token-2022 mint with `TransferHook` | Same mint only after Meteora **admin `token_badge`** | `setup-creator-full` PDAs + `relay_entries` |

Path 1 LZ share mesh and B2 `setup-creator-full` hook mints are **different grains**. Do not point Meteora, hook PDAs, and `SOLANA_CREATOR_MINTS` at three different mints.

1. **Pick lane** — B1 (LZ standard SPL mesh) or B2 (Token-2022 + `TransferHook` on a **single** tradable mint).
2. **B2 only (before pool create):** Meteora admin **`token_badge`** → `setup-creator-full` hook PDAs → allowlist Meteora program in `CreatorConfig`.
3. Create Meteora DLMM — **B1:** base = LZ share mesh mint; **B2:** base = hook mint from step 2. `ACTIVATION_DELAY_SECONDS=0` for immediate UI; `METEORA_HAS_ALPHA_VAULT=1` only for Alpha Vault launch lane.
4. Seed LP after pool create (bridge share supply from Base first if needed).
5. Update env (**B2 only today** — do not enable `relay_entries` for B1 until off-chain relay ships):

```bash
# Example shape — use the actual share mesh / hook mint pubkey, NOT creator SPL 9JWh…
SOLANA_SHARE_OFT_MAPPING='{"<mint_pubkey>":"<base_share_oft_address>"}'
SOLANA_CREATOR_MINTS=<mint_pubkey>   # B2: PendingEntries mint; must match relay grain
```

6. Re-enable (**B2 only**):

```bash
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
```

7. Verify one manual pool buy → **B2:** PendingEntries PDA → Base lottery; **B1:** confirm Meteora swap only (Solana lottery relay N/A until shipped).

## Meteora UI visibility

Meteora DLMM is **permissionless for standard SPL mints** — no manual “listing application.” A pool is discoverable on [app.meteora.ag](https://app.meteora.ag) when **pool + activation + liquidity** exist.

**Two different “badge” concepts (do not conflate):**

| Term | What it is | How to get it |
|------|------------|---------------|
| **Meteora admin `token_badge`** | On-chain PDA Meteora initializes for **permissioned Token-2022 extensions** (incl. `TransferHook`) | Meteora Google Form + Discord per [Token 2022 extensions](https://docs.meteora.ag/overview/products/dlmm/token-2022-extensions) — required **before** pool create on hook mints |
| **`prepare-token-badge.ts` payload** | Off-chain metadata / token-list JSON for wallets and indexers | `BADGE_TARGET=meteora pnpm -C kpr solana:prepare-token-badge` — improves name/logo display; **does not** replace admin `token_badge` |

Checklist:

1. **Pool the tradable mint** — for Path 2 target, that is the **LZ share mesh mint**, not bridge-wrapped creator SPL (`9JWh…`). Script: `kpr/scripts/solana/launch/create-dlmm-pool.ts`.
2. **Start trading immediately** — default `ACTIVATION_DELAY_SECONDS=0`. Alpha Vault launch lane only: `METEORA_HAS_ALPHA_VAULT=1` and `ACTIVATION_DELAY_SECONDS=604800` (creator-SPL provisioner auto-pool).
3. **Seed LP** after pool create. Creating the pool account alone is not enough for swaps or Jupiter routes.
4. **Display metadata** — at LZ deploy set symbol **`■<TICKER>`** and name **`{Creator} Share Token`** for that vault (same rule as deploy UI). Then run `prepare-token-badge` with matching `TOKEN_SYMBOL`, `TOKEN_NAME`, stable `TOKEN_METADATA_URI`, and `CREATOR_TOKEN`. Do **not** use creator-SPL lowercase wraps or `ws*` tickers.
5. **Token-2022 + TransferHook on the pool mint (B2 only)** — pool create fails without Meteora admin `token_badge`. If badge is blocked, use B1 (standard SPL mesh + Meteora) and keep Base-only hook lottery until product changes direction.
6. **Confirm in UI** — search mint or pool PDA on [app.meteora.ag/pools](https://app.meteora.ag/pools).

Full checklist table: [solana-share-mesh-budget-paths.md](./solana-share-mesh-budget-paths.md#meteora-ui-visibility-required-for-discoverable-trading).

## Meteora + Token-2022 caveat

**B1 (typical LZ OFT = standard SPL):** permissionless Meteora DLMM after pool create + LP seed. Solana lottery relay stays on Base until a B1 swap-indexer relay is implemented.

**B2 (Token-2022 + `TransferHook`):** Meteora treats `TransferHook` as **permissioned** — pool create fails until Meteora admin initializes **`token_badge`**. Then `setup-creator-full` PDAs + `relay_entries` match the shipped keeper path.

Do not provision bridge-wrapped creator SPL pools and call them “share lottery.”

## Deprecated paths (not lottery)

| Path | Status |
|------|--------|
| `SOLANA_CREATOR_MINTS` = bridge-wrapped creator SPL + `relay_entries` | **Wrong grain** — pause |
| Provisioner `POST /provision` DLMM on creator SPL | **Trading lane only** — not lottery share |
| `SolanaBridgeAdapter.buyAndEnterLottery` (Twin + Base swap) | Alternate; not canonical ovault-mesh story |
| Compose deposit Solana → Base | Valid vault entry; **no lottery** |

## Verification commands

```bash
# Bridge-wrapped creator parity (Pipe C / registration — not lottery token)
pnpm -C frontend exec tsx scripts/verify-solana-mint-parity.ts --creator 0x<creator>

# Orchestrator preflight (after env changes)
pnpm -C kpr preflight-orchestrator

# AKITA keeper smoke (Base registry — separate from Solana lottery)
./scripts/ops/test-akita-keeper-stack.sh
```

## Phase checklist

| Phase | Done when |
|-------|-----------|
| **A** | Share mesh mint exists on Solana; supply bridged from Base ShareOFT |
| **B** | Share mesh LP live on Meteora; **B2:** `relay_entries` on hook mint; **B1:** trading only until off-chain relay ships |
| **C** | Strategy bridge / Meteora Alpha (optional); stays separate from user lottery pipe |
