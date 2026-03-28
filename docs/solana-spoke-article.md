# 4626 Goes Multichain: Solana as a Spoke Chain

## The Problem

Creator tokens live on Base. The vault infrastructure, the lottery, the fee distribution, the CCA fair launch — it all runs on a single chain. That's fine until your audience is split across ecosystems.

Solana has the traders. Base has the infrastructure. The question was never "should we go multichain?" — it was "how do you bridge a complex DeFi protocol to a fundamentally different runtime without fragmenting everything?"

## The Architecture: Hub and Spoke

We didn't deploy a second vault on Solana. We didn't duplicate the lottery. We didn't split the jackpot across chains.

Base stays the hub. Solana is a spoke. The spoke captures activity — fees, buy events, lottery entries — and relays everything to the hub for processing.

One lottery. One jackpot. One gauge controller. Two chains of traders feeding into it.

### How It Works

**On Solana:** An SPL Token-2022 mint with two extensions:
- **TransferFeeConfig** charges 6.9% on every transfer (buys, sells, wallet-to-wallet). This is Solana TransferFeeConfig behavior and is not equivalent to EVM native transfer triggers.
- **Transfer Hook** detects buys by checking if the source account belongs to a known AMM pool. Buy detected? A lottery entry gets recorded into an on-chain ring buffer (PendingEntries PDA). Sells and regular transfers still pay the fee — they just don't enter the lottery.

**The relay layer (Keepr):** Five workflows run on our existing XMTP agent infrastructure:
- **Entry relay:** Drains the PendingEntries buffer every 30s, batches entries, and calls `processSwapLottery()` on Base via the SolanaBridgeAdapter
- **Fee settlement:** Harvests withheld TransferFeeConfig fees and bridges them to the GaugeController on Base
- **Winner relay:** When Base picks a lottery winner, Keepr writes the result to a WinnerRecord PDA on Solana so the frontend can show it
- **Graduation sync:** When the Base CCA graduates on Day 7, Keepr closes the Solana Alpha Vault and opens the DLMM pool for trading
- **Price monitor:** Compares Solana DLMM price to Base post-graduation pool price, alerts or auto-recenters bins if deviation exceeds thresholds (15% alert, 20% recenter, 50% halt)

**On Base:** The SolanaBridgeAdapter receives entries and fees from the Keepr's Twin contract. Every Solana signer has a deterministic proxy (Twin) on Base — the adapter verifies `msg.sender == Twin(keeperPubkey)` and checks an allowlist before forwarding to the lottery or gauge. No new trust assumptions. Same auth model we already use for all Solana-to-Base calls.

## The Fair Launch: Parallel Across Chains

When a creator launches, there are two fixed allocation layers:

1. **Launch split (Phase 2, Base):** 40% CCA auction / 40% creator vesting / 20% LP reserve in the current deployment batcher flow.
2. **Underlying vault target:** 30% Charm, 30% Ajna, 30% reserved for Solana execution, 10% idle buffer.

The Solana reserve is executed out-of-band through the Solana provisioner + Meteora path (DLMM + Alpha Vault), while Base remains the canonical control plane for deployment, ownership, and settlement.

### Why Meteora?

Token-2022 with Transfer Hook is not universally supported on Solana DEXes:

- **Raydium:** Explicitly blocks Transfer Hook tokens. Dead end.
- **Orca:** Requires a manual TokenBadge approval with uncertain timeline.
- **Meteora:** Permissionless for both TransferFeeConfig and Transfer Hook extensions. Requires revoking the hook *reassignment* authority (not the hook itself — it keeps running). Also ships Alpha Vault, the closest Solana analogue to our CCA. And Meteora pools get priority routing on Jupiter, which is where the volume is.

The venue choice is a constraint, not a preference.

## Authority Lifecycle

Deploying an upgradeable program with a reassignable hook is a trust concern. We handle it in phases:

- **Phase A (Launch):** Transfer program upgrade authority and mint authority to a multisig. Reversible. Operational safety while we validate everything works in production.
- **Phase B (Day 7-21):** Revoke hook reassignment authority. The hook is now permanently locked to our program. It still executes on every transfer — you just can't point the mint at a different hook program anymore. This is also the requirement for Meteora permissionless listing.
- **Phase C (Day 21+, optional):** Revoke program upgrade authority entirely. Full immutability. Only do this when you're confident the program is bug-free.

Each phase is a one-way ratchet. Authority can be revoked but never re-granted.

## Solana Winners Can Claim Without ETH

A Solana user who wins the lottery has never touched Base. Their prize sits in a Twin contract on Base that they've never interacted with directly. The guided claim flow:

1. Frontend resolves the user's Twin via `getPredictedTwinAddress(solanaPubkey)`
2. Shows the prize details and Twin balance on Base
3. User clicks "Claim to Solana"
4. A single Solana transaction fires two EVM calls through the Base-Solana bridge: approve the adapter, then `bridgeToSolana()`
5. Prize arrives in their Solana wallet as a wrapped SPL token

No ETH in the wallet. No switching networks. No bridge UI. One button.

## What's Deployed

All code is built and tested:

- **Anchor program** (`creator_share_hook`): 7 instructions, 3 PDA account types, ring buffer with 256-entry capacity and drop-oldest overflow. 30 integration tests passing.
- **SolanaBridgeAdapter extensions**: `receiveFeeFromSolana()`, `processLotteryEntryFromSolana()` with per-token decimal scaling, keeper allowlists with Twin auth
- **Deployment batcher**: Hardcoded 40/20/40 split with min 5M / max 50M deposit enforcement. 23 Foundry tests including 4 fuzz suites passing.
- **5 Keepr CRE workflows**: Entry relay, fee settlement, winner relay, graduation sync, price monitoring — all running on the existing XMTP agent stack
- **Deployment scripts**: Token-2022 mint creation, PDA initialization, Meteora DLMM pool + Alpha Vault setup via SDK, phased authority revocation
- **ClaimPrizeToSolana UI**: Full guided claim flow with approve-and-bridge two-step, Twin resolution, balance checks, and calldata fallback for disconnected users

The existing Solana program at `EjpziSWGRcEiDHLXft5etbUtcJiZxEttkwz1tqiuzzWU` will be upgraded in place — no new deployment cost, same program ID, all PDAs valid from day one.

## What This Means

Every creator who launches on 4626 gets native Solana liquidity automatically. No extra configuration. No second deployment. The 20% Solana allocation, the DLMM pool, the Alpha Vault, the fee relay, the lottery participation — it's all infrastructure-level. It just happens.

Solana traders enter the same lottery as Base traders. The jackpot doesn't fragment. The fees don't scatter. One hub, multiple spokes, unified economics.

Base is the brain. Solana is the reach.

---

*4626 is building the infrastructure layer for creator token economies. Hub-and-spoke multichain, ERC-4337 smart wallets, Chainlink VRF lottery, and now native Solana liquidity.*

*Follow along: [4626.fun](https://4626.fun)*
