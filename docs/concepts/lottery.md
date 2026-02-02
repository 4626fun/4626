---
title: Lottery
sidebar_position: 3
---

# Lottery

The lottery rewards random buyers with jackpot prizes funded by trading fees.

---

## How it works

1. User buys ■TOKEN on a DEX
2. Buy automatically enters the lottery
3. 69% of the 6.9% buy fee funds the jackpot
4. When jackpot threshold is reached, a random winner is selected via Chainlink VRF
5. Winner receives prize in vault shares

---

## Probability direction

ve4626 holders vote weekly to direct probability to specific vaults. Vaults with more votes give their buyers higher win rates.

| Vote share | Effect |
|------------|--------|
| 0% | Base probability only |
| 10% | +10% relative boost |
| 50% | +50% relative boost |

See [Governance](/governance) for voting mechanics.

---

## Eligibility

Only EOAs can win. Contracts are excluded to prevent gaming.

---

## Jackpot distribution

Distribution triggers when:
- Reserve exceeds threshold (configurable)
- Minimum interval has passed since last draw

Winners receive vault shares (■TOKEN or ▢TOKEN) which can be redeemed or held for yield.

---

## Security

| Protection | Purpose |
|------------|---------|
| Chainlink VRF | Verifiable, unpredictable randomness |
| EOA-only | Prevents contract gaming |
| Amount-weighted entries | Prevents dust spam |

---

## Related

- [Fee flow](/overview/fee-flow) - How fees fund the jackpot
- [Governance](/governance) - Voting mechanics
- [GaugeController](/contracts/governance/gauge-controller) - Contract API
