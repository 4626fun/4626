---
title: 4626 Protocol
sidebar_position: 1
slug: /
---

# 4626 Protocol

4626 is a DeFi protocol for tokenized creator vaults on Base. It transforms Zora Creator Coins into yield-generating, cross-chain capable vault shares with integrated lottery mechanics and ve(3,3) governance.

---

## What 4626 does

| Problem | Solution |
|---------|----------|
| Creator tokens are illiquid | ERC-4626 vaults with automated yield strategies |
| Token launches favor insiders | Continuous Clearing Auction for fair price discovery |
| Assets locked to single chain | LayerZero OFT for cross-chain transfers |
| Passive holding is unrewarding | ve(3,3) voting directs jackpot probability |
| DeFi is complex | Account abstraction for 1-click vault activation |

---

## Documentation

| Section | Description |
|---------|-------------|
| [Overview](/overview) | Protocol architecture and core concepts |
| [Contracts](/contracts) | Smart contract documentation |
| [Guides](/guides) | Step-by-step tutorials |
| [Operations](/operations) | Deployment and automation |
| [Governance](/governance) | ve(3,3) voting system |
| [Reference](/reference) | Addresses, glossary, and technical details |

---

## Quick links

**For developers:**
- [Contract architecture](/overview/architecture)
- [Token model](/overview/token-model)
- [Strategy system](/contracts/strategies)

**For operators:**
- [Deploy a vault](/guides/deploy-vault)
- [Pre-launch checklist](/operations/deployment/pre-launch)
- [Automation](/operations/automation)

**For integrators:**
- [API reference](/api)
- [Contract addresses](/reference/addresses)

---

## Source

Documentation source lives in `4626/docs/`. The `apps/docs-site/docs/` directory is generated.

API documentation is auto-generated from:
- Contract NatSpec comments via `forge doc`
- Frontend TypeScript via `typedoc`
