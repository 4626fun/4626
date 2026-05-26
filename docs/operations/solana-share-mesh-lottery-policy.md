# Solana share mesh + lottery policy

Canonical product policy for Solana-side vault shares, pools, and lottery entry. Locked 2026-05-25.

Related: [AKITA Solana share-mesh audit](./akita-solana-share-mesh-audit.md), [AKITA keeper stack activation](./akita-keeper-stack-activation.md), [Solana bridge naming invariant](./solana-bridge-naming-invariant.md).

## Decisions (locked)

| # | Policy |
|---|--------|
| 1 | Tradable Solana shares come from **bridging ShareOFT from Base** (LayerZero share mesh via `solana_ovault_mesh` + `OVaultHubComposer` wiring). Not from a creator re-deposit loop. |
| 2 | **30% of minted ShareOFT auto-bridges to Solana at finalizePhase2** (LayerZero `send` to `solanaDestination` when OVault runtime is enabled on the batcher). This replaces the deprecated `solana_bridge_strategy` Phase-3 TVL lane. |
| 3 | **Lottery fires only on pool buy** of the share mesh token. Not on compose deposit, not on bridge receipt, not on creator-coin trades. |
| 4 | **Meteora DLMM** (or successor venue) pairs **share mesh** as the base asset — not bridge-wrapped creator SPL from the legacy `wrap-token` provisioner path. Pool parameters TBD. |
| 5 | **`relay_entries` is paused** until a share-mesh pool exists and the transfer hook (or equivalent) fires on **share mesh pool buys**. |

## Three pipes (do not conflate)

```text
PIPE A — User share distribution (lottery surface)
  Base ShareOFT ──LZ bridge──► Solana share mesh
       └── Meteora pool (share mesh + quote)
       └── Pool buy ──► lottery entry ──► Base CreatorLotteryManager (VRF)

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

1. Create Meteora DLMM (or chosen venue) with **share mesh mint** as base asset.
2. Attach transfer hook to **share mesh mint** (or use venue-compatible fee plane); allowlist pool program in `CreatorConfig`.
3. Update env:

```bash
# Example shape — use the actual share mesh mint pubkey, NOT creator SPL 9JWh…
SOLANA_SHARE_OFT_MAPPING='{"<share_mesh_mint>":"0x4df30fFfDA1D4A81bcf4DC778292Be8Ff9752a57"}'
SOLANA_CREATOR_MINTS=<share_mesh_mint>   # monitor PendingEntries on share mesh only
```

4. Re-enable:

```bash
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,winner_relay,relay_entries
SOLANA_ORCHESTRATOR_RELAY_ENTRIES_ENABLED=1
```

5. Verify one manual pool buy → PendingEntries PDA → `processLotteryEntryFromSolana` → `processSwapLottery` on Base.

## Meteora + Token-2022 caveat

Meteora DLMM rejects Token-2022 mints with Transfer Hook extension. If share mesh requires hook-on-mint for lottery detection:

- Prefer **standard SPL share mesh** + off-chain or adapter relay keyed to pool swap events, **or**
- Use a pool venue that supports Token-2022 + hook, **or**
- Keep Solana lottery relay disabled and rely on Base pool buys until resolved.

Do not provision legacy bridge-wrapped creator SPL pools and call them “share lottery.”

## Legacy paths (deprecated for lottery)

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
| **B** | Share mesh LP live; hook/relay mapped to share mesh → ShareOFT; `relay_entries` enabled |
| **C** | Strategy bridge / Meteora Alpha (optional); stays separate from user lottery pipe |
