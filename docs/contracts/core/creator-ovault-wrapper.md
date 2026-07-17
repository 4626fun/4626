---
title: CreatorOVaultWrapper
sidebar_position: 3
---

# CreatorOVaultWrapper

**Product role:** Converts **▢ vault shares** ↔ **■ ShareOFT** for DEX trading and LayerZero bridging. Raw wrap is **1000 ▢ : 1 ■**; `deposit()` presents **~1 creator coin → ~1 ■**.

[Token units](/reference/glossary#token-units)

## Normalization

Vault `_decimalsOffset() = 3` (~1000 ▢ per creator coin at bootstrap). The wrapper cancels that offset:

| Direction | Math |
|-----------|------|
| Wrap | `■ = ▢ / 1000` |
| Unwrap | `▢ = ■ × 1000` |
| `deposit()` / `withdraw()` | ~1 creator coin ↔ ~1 ■ |

Wrap/unwrap fees default to **0** (`setFees`, capped). Bridging does not dilute vault ownership. Remote spokes hold **■ only** — no local vault or creator-coin redeem.

## Key Functions

```solidity
function deposit(uint256 amount) external returns (uint256 shareOFTOut);
function withdraw(uint256 amount) external returns (uint256 creatorCoinOut);
function wrap(uint256 amount) external returns (uint256 amountOut);   // ÷1000
function unwrap(uint256 amount) external returns (uint256 amountOut); // ×1000
```

## Flows

```
▢ vault shares ──wrap(÷1000)──► ■ ShareOFT ──bridge──► remote ■
■ ShareOFT ──unwrap(×1000)──► ▢ ──redeem──► creator coin   [Base / hub only]
```

## Gauge integration

On ShareOFT fee distribute, the gauge **splits in ■ first**. Only the **9.61% burn slice** calls `unwrap()`; those ▢ are burned for PPS.

Prev: [CreatorShareOFT](/contracts/core/creator-share-oft) · Next: [CreatorGaugeController](/contracts/governance/gauge-controller)
