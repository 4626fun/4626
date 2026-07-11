---
title: LotteryManager4626
sidebar_position: 1
---

# LotteryManager4626

**Product role:** **Instant lottery** on hub-chain ShareOFT **buys** (Chainlink VRF) plus attested no-purchase AMOE entries — prizes paid from gauge jackpot reserves.

Shared lottery service deployed once per chain; serves all creator coins by resolving contract addresses from [Registry4626](/contracts/core/creator-registry).

## Purpose

The LotteryManager4626:
- Processes lottery entries from qualifying ShareOFT DEX **buys**
- Processes AMOE entries from server attestations (no purchase required)
- Integrates Chainlink VRF 2.5 for verifiable randomness
- Manages cross-chain winner notifications where configured
- Distributes prizes from active vault jackpot reserves

## Architecture

This is a **shared utility** deployed once per chain that serves ALL Creator Coins by looking up contracts from the registry.

**External pricing library:** USD pricing + oracle guards live in `LotteryManager4626PricingLib` (external CALL) so the main manager stays under EIP-170. Creation bytecode for `LotteryManager4626` therefore contains a library link:

- Foundry links the lib at CREATE2(`EIP-2470`, `create2_library_salt` default `0`) — currently `0x1d74A8e2…7C6D` for the current lib initcode.
- Deploy paths must deploy the lib first (`DeployLotteryManagerCreate2*.s.sol`), then the manager.
- Bytecode manifests must fully link placeholders via `script/lib/extract_linked_bytecode.py` (never truncate at `__$…$__`).

## Win Probability

**Formula**: `winChancePPM = swapValueUSD / 250_000` (capped), i.e. **$1 traded ≈ 0.0004%** instant win chance before boosts.

| Trade Size | Win Chance |
|------------|------------|
| $1 | 0.0004% |
| $100 | 0.04% |
| $1,000 | 0.4% |
| $10,000 | 4% (default pre-boost ceiling) |

Personal Curve boost (up to **2.5×**), optional gauge probability, and `maxWinChance` caps apply after the base formula. Readable proofs: [2.5× boost (proven)](/audits/aristotle/curve-boost) · [next targets](/audits/aristotle/lean-proof-targets).

## Key Functions

### Lottery Entry

```solidity
// Process swap-based lottery entry (called by authorized swap contracts)
function processSwapLottery(
    address buyer,
    address tokenIn,
    uint256 amountIn
) external payable returns (uint256 entryId);

// Process no-purchase AMOE entry (permissionless submit with backend attestation)
function submitAmoeEntry(
    address buyer,
    address creatorCoin,
    bytes32 nonce,
    uint256 deadline,
    bytes calldata signature
) external returns (uint256 entryId);
```

### VRF Callbacks

```solidity
// Local VRF callback
function receiveRandomWords(uint256 requestId, uint256[] memory randomWords) external;

// Cross-chain VRF callback
function receiveRandomWords(uint256[] memory randomWords, uint256 sequence) external;
```

### Configuration

```solidity
// Set lottery parameters
function setLotteryConfig(
    uint256 minSwap,
    uint256 rewardPercentage,
    bool isActive,
    uint256 baseWinChance,
    uint256 maxWinChance,
    uint256 usdMultiplierBps
) external onlyOwner;

// Configure AMOE signer and per-wallet epoch cap
function setAmoeSigner(address signer) external onlyOwner;
function setAmoeConfig(bool enabled, uint32 maxEntriesPerBuyerPerEpoch, uint256 epochDuration) external onlyOwner;
```

### Cross-Chain Fee Sponsorship Guardrails

When cross-chain VRF and winner callbacks are enabled, the manager can sponsor LayerZero native fees.
To prevent unbounded fee burn, `LotteryManager4626` uses a hybrid model:

Defaults (new deployments):
- Sponsorship is disabled by default (`vrfSponsorshipPolicy.enabled == false`, `callbackSponsorshipPolicy.enabled == false`).
- Sponsored VRF requires a higher minimum swap size (`sponsoredVrfMinSwapAmountUSD`, default `$10`).
- Sponsored traffic is rate-limited per epoch (defaults: VRF buyer `2`, VRF origin `10`, callback buyer `1`, callback origin `10`).

Funding model:
- **Caller-funded (exact fee)**: if a swap caller provides `msg.value`, it must equal the integrator-quoted `nativeFee`. If the VRF request send fails, the value is refunded and the entry is skipped.
- **Sponsored fallback (opt-in)**: if `msg.value == 0`, sponsorship may pay fees from the manager balance, but only under policy limits (max fee per message, budget per epoch, min sponsored swap, and rate limits).
- **Callback sponsorship limits**: winner callback sends are independently bounded and remain non-blocking.

Operator controls:

```solidity
function setSponsoredVrfMinSwapAmountUSD(uint256 minSwapAmountUSD) external;

function setSponsorshipRateLimits(
    uint32 vrfMaxPerBuyerPerEpoch,
    uint32 vrfMaxPerOriginPerEpoch,
    uint32 callbackMaxPerBuyerPerEpoch,
    uint32 callbackMaxPerOriginPerEpoch
) external;

function setVrfSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external;

function setCallbackSponsorshipPolicy(
    bool enabled,
    uint256 maxFeePerMessage,
    uint256 budgetPerEpoch,
    uint256 epochDuration
) external;
```

Observability events:

- `SponsorshipPolicyUpdated`
- `SponsorshipSpendRecorded`
- `SponsorshipSkipped`

## Prize Payout

Winners receive **69% of jackpot** from **ALL active creator vaults**:

```solidity
// Internal payout function
function _payoutLocalJackpot(
    address triggeringCoin,
    address winner,
    uint16 payoutBps  // 6900 = 69%
) internal returns (uint256 totalPaidOut);
```

## Boost Integration

Personal + gauge layers (single envelope — **no** lock-duration additive PPM):

```text
// Base from trade size
basePPM = min(swapUSD / 250_000, baseCeilingPPM)

// Personal (only if boostManager set + covered Share USD > 0):
//   l = min(creatorShareUSD, swapUSD)
//   L = total creator ShareOFT supply USD
//   ve = effective veLottery; Ve = live total ve4626 power
//   working = min(0.4·l + 0.6·L·(ve/Ve), l)
//   rawMult = working/(0.4·l)                         ∈ [1.0, 2.5]
//   coverage = l/swapUSD
//   (no position → personal mult inactive; basePPM unchanged)
effectiveMult = 1 + coverage·(rawMult - 1)
boostedPPM   = basePPM × effectiveMult

// Gauge (if vaultGaugeVoting set): + size-scaled vault PPM
// Hard cap: lotteryConfig.maxWinChance
```

Canonical product writeup: [ve■4626](/contracts/governance/ve4626) · naming: [ve-naming](/contracts/governance/ve-naming).

## Events

```solidity
event LotteryEntryCreated(address indexed creatorCoin, address indexed user, uint256 swapAmountUSD, uint256 winChancePPM, uint256 requestId);
event LotteryEntrySourceTagged(address indexed creatorCoin, address indexed user, uint256 indexed requestId, EntrySource source, uint256 amountUSD);
event AmoeEntrySubmitted(address indexed creatorCoin, address indexed user, bytes32 indexed nonce, uint256 requestId);
event LotteryWinner(address indexed creatorCoin, address indexed user, uint256 swapAmountUSD, uint256 rewardAmount, uint256 requestId);
event MultiTokenJackpotWon(address indexed triggeringCoin, address indexed winner, uint256 numVaultsPaid);
```
