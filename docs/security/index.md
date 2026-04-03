---
title: Security
sidebar_position: 5
---

# Security

4626 inherits Yearn V3's battle-tested security model with additional safeguards.

## Recent Hardening Notes

- [4626 Agent Security Model](./4626-agent-security-model.md)
- [Payout Router + CreatorCoin Control Hardening (March 2026)](./payout-router-ownership-hardening-2026-03.md)
- [Security Scan Overview](./scan-overview.md)
- Canonical disclosure policy: [SECURITY.md](https://github.com/wenakita/4626/blob/main/SECURITY.md)

For operational rollout posture (including deferred feature surfaces), see [Roadmap](/roadmap).

## Anti-Inflation Attack

| Protection | Description |
|------------|-------------|
| **Virtual shares offset** (1e3) | Prevents first-depositor inflation attacks |
| **Minimum first deposit** (50,000,000 tokens) | Ensures meaningful initial liquidity |
| **Price change limits** (10% max per tx) | Prevents manipulation |

## Flash Loan Protection

| Protection | Description |
|------------|-------------|
| **Block delay** | Between deposit/withdraw (same-block attacks prevented) |
| **Large withdrawal queue** | 100k+ tokens → queued with unlock period |
| **Profit unlocking** | Yearn V3 mechanism smooths out sudden PnL spikes |

## Access Control

| Role | Permissions |
|------|-------------|
| **Owner** | Full control (deployment, strategy management, emergency shutdown) |
| **Management** | Add/remove strategies, adjust allocations |
| **Keeper** | Report profits, tend strategies (operational role) |
| **EmergencyAdmin** | Shutdown vault in case of exploit (can't steal funds) |

## Whale Guards

| Guard | Description |
|-------|-------------|
| **Maximum single deposit** | Configurable per vault |
| **Graduated fee tiers** | For large DEX purchases (future feature) |

## Smart Wallet Compatibility

The lottery system supports all wallet types including smart contract wallets and ERC-4337 accounts.

### Supported Wallets

| Wallet Type | Status | Notes |
|-------------|--------|-------|
| **EOA (Externally Owned Account)** | ✅ Supported | Standard Ethereum wallets |
| **Coinbase Smart Wallet** | ✅ Supported | ERC-4337 account abstraction |
| **Safe (Gnosis)** | ✅ Supported | Multi-signature wallets |
| **Argent** | ✅ Supported | Social recovery wallets |
| **Proxy Wallets** | ✅ Supported | Transparent/UUPS proxies |
| **ERC-4337 Accounts** | ✅ Supported | Via bundler transactions |

### DEX Aggregator Support

DEX aggregators work out-of-the-box without code changes. Aggregator contracts are marked as `SwapOnly`, ensuring the final user recipient receives lottery entries:

| Aggregator | Support Method | User Entry |
|------------|----------------|------------|
| **1inch** | `SwapOnly` classification | Final recipient gets entry |
| **Paraswap** | `SwapOnly` classification | Final recipient gets entry |
| **LlamaSwap** | `SwapOnly` classification | Final recipient gets entry |
| **CoW Swap** | `SwapOnly` classification | Final recipient gets entry |
| **Uniswap Universal Router** | `SwapOnly` classification | Final recipient gets entry |
| **Multi-hop routes** | Chained `SwapOnly` | Final recipient gets entry |

## Test Coverage

The lottery system is tested against **88 edge cases** across multiple categories:

- **Wallet Type Tests** (5 tests) - EOA, Coinbase Smart Wallet, Safe, Argent, Proxy wallets
- **Transaction Origin Tests** (3 tests) - Direct EOA, ERC-4337 bundler, different tx.origin
- **Aggregator Scenarios** (4 tests) - Single-hop, multi-hop, split routes
- **Address Type Tests** (4 tests) - SwapOnly, NoFees, Unknown classifications
- **Amount Edge Cases** (4 tests) - Zero amount, 1 wei, large amounts, max uint128
- **State Edge Cases** (7 tests) - Lottery disabled, fees disabled, missing controllers
- **ILotteryBeneficiary Interface** (5 tests) - Valid/invalid addresses, reverts, gas consumption
- **Multiple Swap Tests** (3 tests) - Same block, different users, different blocks
- **Protocol-Specific Tests** (2 tests) - CoW Swap, Uniswap Universal Router
- **DeFi Recipient Tests** (3 tests) - Yield vaults, bridges, timelocks
- **Permission Tests** (2 tests) - Access control validation
- **Advanced Edge Cases** (18 tests) - Self-transfers, sandwich attacks, MEV bots
- **Fuzz Tests** (2 tests) - Random recipients and amounts

### Running Security Tests

```bash
# Run all lottery tests
forge test --match-path "test/CreatorShareOFT.Lottery.t.sol" -v

# Run all edge case tests
forge test --match-path "test/CreatorShareOFT.EdgeCases.t.sol" -v

# Run specific test
forge test --match-test test_SmartWallet_CanParticipateInLottery -vvv
```

## Audits

- **Internal audits** completed for core contracts (Vault, OFT, Lottery)
- **Public audit** (planned) via Code4rena or Spearbit
