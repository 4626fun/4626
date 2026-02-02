---
title: Governance
sidebar_position: 6
---

# Governance

This section documents the ve(3,3) governance model for the 4626 protocol.

**Who this is for:** Token holders, DAO participants, and governance researchers.

---

## Overview

4626 implements a ve(3,3) governance model where:
- Holders lock tokens to receive ve4626 (vote-escrowed 4626)
- ve4626 holders vote weekly on vault gauge allocations
- Voters receive a share of protocol fees proportional to their votes
- External parties can deposit bribes to incentivize votes

---

## Key concepts

### ve4626 (Vote-Escrowed 4626)

Lock 4626 tokens to receive ve4626, which provides:
- Voting power in gauge elections
- Share of voter rewards
- Governance participation rights

### Weekly epochs

Voting operates on weekly epochs:
- Vote once per epoch on vault allocations
- Claims only available after epoch ends
- Votes determine fee distribution for that epoch

### Gauges

Each whitelisted vault has a gauge that:
- Receives votes from ve4626 holders
- Determines share of voter rewards
- Can influence lottery probability boost

---

## Contracts

| Contract | Purpose |
|----------|---------|
| `ve4626` | Vote-escrowed token contract |
| `VaultGaugeVoting` | Weekly epoch voting |
| `VoterRewardsDistributor` | Fee distribution to voters |
| `CreatorGaugeController` | Fee routing and gauge management |
| `BribeDepot` | External bribe deposits |
| `BribesFactory` | Deploy bribe depots |

---

## Documentation

- [ve(3,3) Implementation](./ve33-progress.md) - Technical details of the voting system

---

## Day-1 configuration

The governance system can be launched in "simple mode":
- Leave `voterRewardsDistributor` unset on GaugeController
- Fees accumulate to protocol treasury
- No voting UI exposed
- Enable later when ready

See [ve(3,3) Implementation](./ve33-progress.md) for details.
