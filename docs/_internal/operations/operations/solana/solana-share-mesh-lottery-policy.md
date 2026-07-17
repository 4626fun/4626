# Solana share mesh + lottery policy

Canonical product policy for Solana-side vault shares, pools, and lottery entry.

Related: [budget paths](../../solana/solana-share-mesh-budget-paths.md) (costs + runbooks), [AKITA gap audit](../../solana/akita-solana-share-mesh-audit.md).

## Decisions

| # | Policy |
|---|--------|
| 1 | Tradable Solana shares = **ShareOFT bridged from Base** (`solana_ovault_mesh` + `OVaultHubComposer`). Not creator re-deposit, not bridge-wrapped creator SPL. |
| 2 | **30% ShareOFT auto-bridges at `finalizePhase2`** when batcher OVault runtime is enabled. |
| 3 | **Lottery = pool buy of tradable share token only** — not compose deposit, bridge receipt, or creator-coin trades. |
| 4 | **Meteora base asset = share mesh mint** — not `wrap-token` creator SPL. |
| 5 | **Solana lottery relay is unavailable.** The former KPR entry-relay and winner-relay workflows were removed with the Twin transport. A pool or hook deployment does not enable a Solana lottery. |
| 6 | **Share symbol = `■<TICKER>`**, name = `{Creator} Share Token` — all creators, Base deploy UI + Solana LZ deploy (`frontend/src/lib/tokens/tokenSymbols.ts`). |
| 7 | **LZ ULN = 6-of-9 optional DVNs** on mainnet Base ↔ Solana — never single-DVN `1/1`. Nine-name pool (all on both chains): LayerZero Labs, Google, Nethermind, Horizen, Deutsche Telekom, Nansen, Frax, Wyoming, P-OPS; threshold **6**. Devnet rehearsal maxes at **2-of-3** (only three shared DVNs on arbsep ↔ solana-testnet). See [budget paths § ULN](../../solana/solana-share-mesh-budget-paths.md#uln-security--6-of-9-optional-dvns-mainnet). |

## Two lanes (do not conflate)

```text
A — Share mesh (lottery surface)        Base ShareOFT ──LZ──► Solana share mesh ──► Meteora pool buy
B — Compose deposit (DORMANT, no lottery) Solana asset mesh ──► OVaultHubComposer ──► ShareOFT on Base
```

**Lane B (compose deposit) is dormant, not deleted.** The creator coin (e.g. $AKITA) lives only on Base today — no Solana asset mesh token is configured, so `OVaultHubComposer` rejects compose deposits with `CreatorMeshNotConfigured` and the lane is inert by construction. The contract capability stays in place: if product later launches the canonical creator-coin bridge to Solana (**LayerZero OFT adapter lockbox — CCIP was evaluated and ruled out**), activating the lane is a `configureCreatorMesh(...)` call with the new `assetMeshToken` — no redeploy. Bridge design + activation checklist: [akita-oft-adapter-lockbox.md](../../../research/akita-oft-adapter-lockbox.md). Until then:

- Deposit-eligibility / asset-mesh readiness hints are **excluded from deploy preflight and infra status** (`depositEligible`, `solanaAssetMeshReady`, `assetPeerSet` removed) — the dormant lane must never gate or confuse vault deploys.
- Compose **redeem** (Solana shares → composer → creator coin paid out **on Base**) remains the supported share exit; the creator coin itself never leaves Base through this lane.

Do not use the historical bridge-wrapped creator SPL (for example AKITA
`9JWh…`) as the share-lottery token. The removed Twin adapter/provisioner grain
is out of scope for share-mesh policy.


## Canonical Solana lottery eligibility (SOL-P0-04, LZ-era)

| Lane | Mint | Venue | Solana lottery eligibility |
|------|------|-------|------------------------------|
| **B1 (default)** | LZ **standard SPL** share mesh (`■TICKER`) | Optional Meteora DLMM | **None** — lottery stays on Base Uniswap ShareOFT buys |
| **B2 (hook)** | **Token-2022 + TransferHook** share mint | Meteora DLMM **after** admin `token_badge` | Buy-path `LotteryEntryRecorded` only (one authentic event per qualifying transfer) |

**Resolution of the prior mint/pool contradiction:** Meteora does not accept TransferHook mints until an admin `token_badge` is issued. That is a sequenced B2 prerequisite, not a dual-mint design. B1 and B2 must never share the same mint identity.

**Ring buffer:** 256-entry `PendingEntries` is reconciliation-only (lossy). Canonical source = finalized buy-path tx logs keyed by `(cluster_genesis_hash, program_id, signature, instruction_index, event_index)`.

**Transport:** Twin adapter retired. Solana→Base submission is LayerZero `MSG_TYPE_LOTTERY_ENTRY` into current LM auth (`authorizedRemoteOFTs` / hub ShareOFT forwarder). Fail closed when the Solana lottery OApp peer is unavailable. Relay flag stays off.

**Identity:** Base beneficiary = parent CSW of the unique linked account whose canonical Solana wallet matches the buyer pubkey. Coverage forced to `0` (base-odds-only). Missing/ambiguous mapping → quarantine.

**Verdicts:** personal veLottery boost = NO; base-odds relay enablement = NO until inbox + LZ peer + ops canary.

## B1 vs B2 (Phase B fork)

| | **B1 — default** | **B2 — on-chain hook** |
|--|------------------|------------------------|
| Mint | LZ standard SPL share mesh | Token-2022 + `TransferHook` (one mint for pool + relay) |
| Meteora | `create-dlmm-pool.ts` after Path 1 | Meteora admin `token_badge` **before** pool create |
| Solana lottery relay | **Off** — Base Uniswap lottery | **Off** — architecture is not enablement-ready |

**Default:** Path 1 + optional B1 Meteora (trading on Solana; lottery on Base).

## Base lottery reference

Lottery on Base fires on **ShareOFT DEX buy** (`SwapOnly → non-SwapOnly`). Deposits/wraps/redeems do not enter.

Solana must mirror **secondary share buys**, not primary mint paths.

## Keeper config

The remaining Solana orchestrator actions are maintenance-only:

```bash
# Vercel
KEEPER_SOLANA_RECONCILE_ENABLED=1
KEEPER_SOLANA_RECONCILE_ACTIONS=settle_fees,price_monitor
```

`settle_fees` is Solana harvest-only: withheld Token-2022 fees remain in the
keeper ATA. The workflow must not call `receiveFeeFromSolana`, claim bridged
funds, or mark fees as bridged without an authenticated bridge-evidence design.
No such Base-forward lane is currently configured.

The removed `relay_entries` and `winner_relay` labels are not valid
orchestrator actions. The July relay audit is historical evidence, not an
enablement checklist.

## Phase checklist

| Phase | Done when |
|-------|-----------|
| **A** | LZ share mesh live; batcher peer set; supply bridged; mint metadata `■<TICKER>` |
| **B1** | Meteora pool + LP on share mesh; Meteora/Jupiter swappable; lottery remains on Base |
| **B2** | Deferred pending a new non-Twin relay architecture and end-to-end canary |

Execution steps, costs, and commands: [solana-share-mesh-budget-paths.md](../../solana/solana-share-mesh-budget-paths.md). Per-creator LZ + registry checklist: [solana-share-mesh-creator-provisioning.md](./solana-share-mesh-creator-provisioning.md).

**B2 hook upgrade (canonical ix names):** [creator-share-hook-mainnet-upgrade.md](../../solana/creator-share-hook-mainnet-upgrade.md) is historical evidence only. It does not provide an active relay architecture.

## Out of scope (not share lottery)

| Path | Why |
|------|-----|
| Historical creator SPL relay | Removed Twin grain |
| Historical `POST /provision` DLMM on creator SPL | Removed creator-SPL provisioner / Alpha Vault grain |
| Phase-3 Solana vault strategy TVL | Greenfield uses Pipe A 30% finalize bridge |
| Compose deposit | Dormant (no asset mesh configured; creator coin is Base-only). Would be a valid vault entry if a creator-coin bridge ever launches; never lottery-eligible |
| Historical adapter lottery entry | Removed Twin path |

## Verification

```bash
pnpm -C frontend exec tsx scripts/ops/verify-batcher-pipe-a-readiness.ts
```
