---
title: Launch checklist
sidebar_position: 2
---

# Launch checklist

Printable path for a **new** vault on Base (v1.14.1). Older vaults (e.g. AKITA) may differ.

Context: [Getting started](/getting-started) · App: [deploy/vault](https://app.4626.fun/deploy/vault)

## Before the app

- [ ] Creator coin **live on Base** (usually Zora)  
- [ ] **50M–100M** creator coin in wallet for activation  
- [ ] **4626 account** + wallet signing works  
- [ ] **[Launch bundle](/guides/strategy-bundle) paid** ($499 USDC) — deploy locked until active  

## Steps

| # | Step | What happens | Guide |
|---|------|--------------|-------|
| 1 | **Pay** | Unlock deploy | [Strategy bundle](/guides/strategy-bundle) |
| 2 | **Deploy** | Vault, shares, auction contracts created | [Launch vault](/guides/launch-token) |
| 3 | **Activate** | Deposit coin; fair auction starts | [Activate vault](/guides/activate-vault) |
| 4 | **Auction** | Buyers set price; you monitor in app | — |
| 5 | **Finalize** | Onchain completion; optional Solana bridge | [Solana share mesh](/overview/solana-share-mesh) |
| 6 | **Strategies** | Charm + Ajna attach (automatic) | [How it works](/overview/how-it-works) |

## Milestones: deployed → activated → live

| Stage | You have… | Public trading? |
|-------|-----------|-----------------|
| **Deployed** | Contracts onchain | No — no coin in vault yet |
| **Activated** | Coin in vault; auction **running** | Not yet — auction must finish |
| **Live on Base** | Auction **done**; ■ shares on DEX | Yes — fees + lottery on **buys** |

Treat **“live”** as auction complete + Base trading, not merely “I clicked activate.”

## After you’re live on Base

- **■ shares** trade on Base DEXs  
- **Buys** can enter the [lottery](/contracts/utilities/lottery-manager)  
- Trade fees flow through the [gauge](/contracts/governance/gauge-controller)  

## Solana (optional, can lag Base)

- Bridged **■ share** (not creator coin) may appear after finalize  
- Meteora pool trading may follow  
- Base lottery and trading do **not** require Solana  

## Reference

- Your stack → [CreatorRegistry](/contracts/core/creator-registry) at deploy  
- Shared infra → [Addresses](/reference/addresses) v1.14.1  

## Related

[Getting started](/getting-started) · [How it works](/overview/how-it-works)
