---
title: Lottery
sidebar_position: 20
slug: /primitives/game-loop/lottery
---

# Lottery

The lottery is the core engagement primitive: trade activity funds the jackpot, winners are selected via VRF, and AMOE provides a no-purchase entry path.

In 4626, this is a **Game Loop** boundary because it ties:

- fee routing (market activity)
- randomness assumptions (VRF)
- distribution of rewards (payout paths)
- AMOE eligibility and abuse controls (no-purchase entry path)

## What It Does

- collects the configured fee slice from trading activity
- funds a prize pot
- uses VRF-backed randomness to select winners
- routes payouts according to protocol configuration
- supports no-purchase entries through signed AMOE attestations settled onchain

## Key Properties

- fee-funded (trading activity grows the pot)
- no-purchase path (AMOE exists and is materially usable)
- VRF-backed (randomness is verifiable)
- immediate (each qualifying entry is an independent roll)
- abuse-aware (nonce replay guards + per-epoch caps + server attestation checks)

## References

- [Engagement (Game Loop)](/compressions/engagement)
- [Tokenomics](/tokenomics)
- [Security](/security)
- [Contracts: Lottery Manager](/contracts/utilities/lottery-manager)

