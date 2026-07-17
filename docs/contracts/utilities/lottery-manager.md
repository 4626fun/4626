---
title: LotteryManager4626
sidebar_position: 1
---

# LotteryManager4626

**Product role:** Instant lottery on hub-chain ShareOFT **buys** (Chainlink VRF) plus AMOE. Prizes paid in **ShareOFT ■** from the triggering gauge `jackpotReserve` (default single-vault).

Shared per-chain service; resolves each creator's stack from [Registry4626](/contracts/core/creator-registry). Processes lottery entries from qualifying ShareOFT DEX **buys** and AMOE entries from server attestations (no purchase required). Integrates Chainlink VRF 2.5 and pays winners from the triggering vault's gauge reserve (■).

## Deploy notes

USD pricing + oracle guards live in `LotteryManager4626PricingLib` (external CALL) so the main manager stays under EIP-170. Deploy the lib first (`DeployLotteryManagerCreate2*.s.sol`), then the manager. Foundry links the lib at CREATE2(`EIP-2470`, `create2_library_salt` default `0`) — currently `0x1d74A8e2…7C6D` for the current lib initcode. Bytecode manifests must fully link placeholders via `script/lib/extract_linked_bytecode.py`.

## Win Probability

**Formula**: `winChancePPM = swapValueUSD / 250_000` (capped), i.e. **$1 traded ≈ 0.0004%** instant win chance before boosts.

| Trade Size | Win Chance |
|------------|------------|
| $1 | 0.0004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% (default pre-boost ceiling) |

Personal Curve boost (up to **2.5×**), optional gauge probability, and `maxWinChance` caps apply after the base formula. See [ve■4626 reader guide](/overview/ve4626), [2.5× proof](/audits/aristotle/curve-boost), or [Lean targets](/audits/aristotle/lean-proof-targets).

## Key Functions

```solidity
function processSwapLottery(address buyer, address tokenIn, uint256 amountIn)
    external payable returns (uint256 entryId);
function submitAmoeEntry(address buyer, address creatorCoin, bytes32 nonce, uint256 deadline, bytes calldata signature)
    external returns (uint256 entryId);

function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;
function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external;

function setLotteryConfig(uint256 minSwap, uint256 rewardPercentage, bool isActive,
    uint256 baseWinChance, uint256 maxWinChance, uint256 usdMultiplierBps) external onlyOwner;
function setAmoeSigner(address signer) external onlyOwner;
function setAmoeConfig(bool enabled, uint32 maxEntriesPerBuyerPerEpoch, uint256 epochDuration) external onlyOwner;
```

## Cross-Chain Fee Sponsorship

Hybrid model prevents unbounded fee burn. Defaults: sponsorship disabled (`vrfSponsorshipPolicy.enabled == false`, `callbackSponsorshipPolicy.enabled == false`); sponsored VRF requires higher minimum swap (`sponsoredVrfMinSwapAmountUSD`, default `$10`); rate-limited per epoch (VRF buyer `2`, VRF origin `10`, callback buyer `1`, callback origin `10`).

- **Caller-funded**: `msg.value` must equal integrator-quoted `nativeFee`; refund + skip on VRF send failure.
- **Sponsored fallback (opt-in)**: if `msg.value == 0`, sponsorship pays from manager balance under policy limits.

```solidity
function setSponsoredVrfMinSwapAmountUSD(uint256 minSwapAmountUSD) external;
function setSponsorshipRateLimits(uint32 vrfMaxPerBuyerPerEpoch, uint32 vrfMaxPerOriginPerEpoch,
    uint32 callbackMaxPerBuyerPerEpoch, uint32 callbackMaxPerOriginPerEpoch) external;
function setVrfSponsorshipPolicy(bool enabled, uint256 maxFeePerMessage, uint256 budgetPerEpoch, uint256 epochDuration) external;
function setCallbackSponsorshipPolicy(bool enabled, uint256 maxFeePerMessage, uint256 budgetPerEpoch, uint256 epochDuration) external;
```

## Prize Payout

By default (`singleVaultJackpotOnly = true`), winners receive `rewardPercentage` (default **69%**) of the **triggering vault's** gauge `jackpotReserve` in **ShareOFT ■** via `gaugeController.payJackpot`. Multi-vault scanning only when `singleVaultJackpotOnly` is disabled. Payout asset is always ShareOFT ■, not vault shares ▢.

## Boost Integration

Personal + gauge layers (single envelope — **no** lock-duration additive PPM):

```text
basePPM = min(swapUSD / 250_000, baseCeilingPPM)
// Personal (boostManager set + covered Share USD > 0):
//   l = min(creatorShareUSD, swapUSD); L = total creator ShareOFT supply USD
//   ve = effective veLottery; Ve = live total ve4626 power
//   working = min(0.4·l + 0.6·L·(ve/Ve), l)
//   rawMult = working/(0.4·l) ∈ [1.0, 2.5]; coverage = l/swapUSD
effectiveMult = 1 + coverage·(rawMult - 1)
boostedPPM = basePPM × effectiveMult
// Gauge (if vaultGaugeVoting set): + size-scaled vault PPM; hard cap: maxWinChance
```

Reader journey: [ve■4626, ve33, and veLottery](/overview/ve4626).

Prev: [Share CCA Launch Arm](/contracts/strategies/cca-launch) · Next: [CreatorOracle](/contracts/utilities/creator-oracle)
