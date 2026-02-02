---
title: Glossary
sidebar_position: 2
---

# Glossary

Key terms and definitions used throughout 4626 documentation.

---

## Tokens

### TOKEN
The underlying creator coin. Issued by Zora's Creator Coin platform. This is what users deposit into vaults.

### ▢TOKEN (Vault Shares)
ERC-4626 vault share token issued when depositing TOKEN. Represents proportional ownership of vault assets. The ▢ symbol is pronounced "box" or "vault share."

### ■TOKEN (Wrapped Shares / ShareOFT)
LayerZero OFT wrapper around vault shares. Enables cross-chain transfers and DEX trading. The ■ symbol is pronounced "filled box" or "share token."

### ve4626
Vote-escrowed 4626 token. Created by locking ■4626 or ▢4626. Provides voting power in governance.

---

## Contracts

### CreatorOVault
The main ERC-4626 tokenized vault. Accepts TOKEN deposits, issues ▢TOKEN shares, deploys to strategies.

### CreatorOVaultWrapper
Converts between ▢TOKEN and ■TOKEN. Normalizes the 1000x decimals offset.

### CreatorShareOFT
LayerZero OFT implementation for ■TOKEN. Implements buy fee and lottery integration.

### CreatorGaugeController
Fee distribution hub. Receives trading fees and splits to lottery, burn, and voters.

### VaultGaugeVoting
Weekly epoch voting contract. ve4626 holders vote to direct lottery probability.

---

## Mechanisms

### CCA (Continuous Clearing Auction)
Uniswap's fair launch mechanism. All bidders pay the same clearing price. No sniping or MEV advantages.

### Clearing Price
The price at which supply meets demand in a CCA. All filled bids pay this price regardless of their max bid.

### Graduation
When a CCA auction ends and converts to a V4 liquidity pool.

### Price Per Share (PPS)
The value of one vault share in terms of underlying assets. Calculated as totalAssets / totalSupply.

### Profit Unlocking
Gradual release of vault profits over time. Prevents manipulation of price per share.

---

## Governance

### Epoch
A 7-day voting period in the governance system. Starts Thursday 00:00 UTC.

### ve(3,3)
Vote-escrow tokenomics model. Users lock tokens for voting power that decays over time. Combines with game theory for positive-sum outcomes.

### Gauge
A voting target that receives vote weight. In 4626, vaults are gauges.

### Bribe
External incentive deposited to attract votes for a specific vault.

### Probability Direction
Using votes to allocate lottery win probability to specific vaults.

---

## DeFi Terms

### ERC-4626
Ethereum standard for tokenized vaults. Defines deposit, withdraw, mint, redeem, and accounting functions.

### OFT (Omnichain Fungible Token)
LayerZero standard for cross-chain fungible tokens. Enables seamless transfers between chains.

### TVL (Total Value Locked)
Total assets deposited in a protocol or vault.

### APY (Annual Percentage Yield)
Annualized return rate including compounding.

### Slippage
Difference between expected and executed trade price.

---

## Security Terms

### Decimals Offset
Virtual shares added to vault accounting. Prevents first-depositor inflation attacks.

### Flash Loan Protection
Minimum delay between deposit and withdrawal. Prevents same-block manipulation.

### Large Withdrawal Queue
Queuing system for withdrawals above threshold. Prevents MEV extraction on big exits.

### Inflation Attack
Exploit where attacker manipulates share prices by depositing dust and inflating assets.

---

## Basis Points

A common unit in DeFi. 1 basis point = 0.01%.

| Value | Percentage |
|-------|------------|
| 1 bps | 0.01% |
| 100 bps | 1% |
| 690 bps | 6.9% |
| 1000 bps | 10% |
| 10000 bps | 100% |

---

## Chain IDs

| Network | Chain ID | LZ EID |
|---------|----------|--------|
| Base | 8453 | 30184 |
| Base Sepolia | 84532 | 40245 |
| Ethereum | 1 | 30101 |
| Arbitrum | 42161 | 30110 |
| Optimism | 10 | 30111 |
