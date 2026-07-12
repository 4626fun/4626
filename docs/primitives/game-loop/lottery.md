---
title: Lottery
sidebar_position: 20
slug: /primitives/game-loop/lottery
---

# Lottery

The lottery is the core engagement primitive: **qualifying ShareOFT buys** (and AMOE) fund the jackpot; VRF selects winners; payouts are **ShareOFT ■** from the triggering vault’s gauge.

In 4626, this is a **Game Loop** boundary because it ties:

- fee routing (buy-side market activity)
- randomness assumptions (VRF)
- distribution of rewards (gauge `jackpotReserve` → winner)
- AMOE eligibility and abuse controls (no-purchase entry path)

## What It Does

- collects the configured fee slice from qualifying **buys**
- funds a prize pot (`jackpotReserve` in ShareOFT ■)
- uses VRF-backed randomness to select winners
- pays from the triggering vault’s gauge by default (single-vault mode)
- supports no-purchase entries through signed AMOE attestations settled onchain

## Key Properties

- fee-funded (qualifying buys grow the pot)
- no-purchase path (AMOE exists and is materially usable)
- VRF-backed (randomness is verifiable)
- immediate (each qualifying entry is an independent roll)
- abuse-aware (nonce replay guards + per-epoch caps + server attestation checks)

## References

- [Engagement (Game Loop)](/compressions/engagement)
- [Tokenomics](/tokenomics)
- [Security](/security)
- [Contracts: Lottery Manager](/contracts/utilities/lottery-manager)
- [Token units](/reference/glossary#token-units)
