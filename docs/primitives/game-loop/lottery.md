---
title: Lottery
sidebar_position: 20
slug: /primitives/game-loop/lottery
---

# Lottery

The lottery is the core engagement primitive: trading activity funds a pot, and winners are selected via VRF.

In 4626, this is a **Game Loop** boundary because it ties:

- fee routing (market activity)
- randomness assumptions (VRF)
- distribution of rewards (payout paths)

## What It Does

- collects the configured fee slice from trading activity
- funds a prize pot
- uses VRF-backed randomness to select winners
- routes payouts according to protocol configuration

## Related docs

- [Engagement (Game Loop)](/compressions/engagement)
- [Tokenomics](/tokenomics)
- [Contracts: Lottery Manager](/contracts/services/lottery-manager)
- [VRF callbacks (in Lottery Manager)](/contracts/services/lottery-manager)

---
title: Lottery
sidebar_position: 10
slug: /primitives/game-loop/lottery
---

# Lottery

The lottery is the core onchain engagement loop: DEX trades fund a prize pool and each qualifying trade has an instant chance to win, backed by verifiable randomness.

## Key Properties

- fee-funded (trading activity grows the pot)
- VRF-backed (randomness is verifiable)
- immediate (each qualifying trade is an independent roll)

## References

- [Tokenomics](/tokenomics)
- [Security](/security)
- [Contracts: Lottery Manager](/contracts/services/lottery-manager)

