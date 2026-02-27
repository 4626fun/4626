---
title: Developer Guide
sidebar_position: 7
---

# Developer Guide

This guide covers how to build on and contribute to 4626.

## Project Structure

```
4626/
  contracts/                      # Solidity contracts
    core/                         # Platform core
      CreatorRegistry.sol
    vault/                        # ERC-4626 vaults
      CreatorOVault.sol
      CreatorOVaultWrapper.sol
    services/messaging/           # LayerZero V2 OFT
      CreatorShareOFT.sol
    governance/                   # Tokenomics
      CreatorGaugeController.sol
      ve4626.sol
      ve4626BoostManager.sol
    services/lottery/             # Lottery system
      CreatorLotteryManager.sol
      vrf/                        # Chainlink VRF
        CreatorVRFConsumerV2_5.sol
    services/oracles/             # Price oracles
      CreatorOracle.sol
    vault/strategies/             # Yield strategies
      BaseCreatorStrategy.sol
      CCALaunchStrategy.sol
    factories/                    # Deployment factories
      CreatorOVaultFactory.sol
    helpers/                      # Batchers and infra helpers
      batchers/
      infra/
      hooks/
      routers/
    interfaces/                   # All interfaces
  frontend/                       # React frontend (Vite)
    src/
      components/                 # UI components
      pages/                      # Page routes
      lib/                        # Web3 utils
      config/                     # Contract addresses
    public/                       # Brand assets (logo, icons)
  deployments/                    # Deployed contract addresses
  script/                         # Foundry deploy scripts
```

## Development Commands

```bash
# Compile contracts
forge build

# Run tests with verbosity
forge test -vvv

# Run specific test
forge test --match-test testVaultDeposit -vvv

# Deploy to Base (example)
forge script script/DeployCreatorVault.s.sol \
  --rpc-url $BASE_RPC_URL \
  --broadcast \
  --verify

# Start frontend dev server
cd frontend && pnpm dev
```

## Repo Build Philosophy

This repo is intentionally split into:

- **Fast UI loop**: `frontend/` (Vite + React). Prefer `pnpm -C frontend dev` / `pnpm -C frontend build` for day-to-day changes.
- **Heavy onchain loop**: Foundry contracts at repo root. Run `forge build` / `forge test` when you're changing Solidity.

For the Vercel API surface, avoid "hidden" dynamic imports: add endpoints by registering them in `frontend/api/_handlers/_routes.ts` so the bundler includes them.

## Usage Examples

### For Creators

**Deploy a vault for your Creator Coin:**

```solidity
// Via Factory (or use web UI at erc4626.fun/deploy)
(address vault, address wrapper, address shareOFT) = factory.deployCreatorVault(
    0x5b67...75,                       // Your Creator Coin address
    "TOKEN Vault",                     // Vault name
    "▢TOKEN",                          // Vault symbol
    "TOKEN Share",                     // OFT name
    "■TOKEN",                          // OFT symbol
    "base",                            // Chain prefix
    msg.sender                         // Your address (revenue recipient)
);
```

**Configure DEX pools for trading fee:**

```solidity
shareOFT.setAddressType(uniswapV4Pool, OperationType.SwapOnly);
shareOFT.setGaugeController(gaugeControllerAddress);
```

**Add yield strategies:**

```solidity
vault.addStrategy(strategyAddress, 5000); // 50% allocation to strategy
```

### For Users

**Deposit Creator Coins:**

```solidity
IERC20(akitaToken).approve(vaultAddress, 1000e18);
vault.deposit(1000e18, msg.sender); // Receive ▢AKITA vault shares
```

**Wrap for cross-chain:**

```solidity
wrapper.wrap(shareAmount); // Convert ▢AKITA -> ■AKITA
```

**Bridge to another chain:**

```solidity
SendParam memory sendParams = SendParam({
    dstEid: 30110, // Arbitrum
    to: addressToBytes32(msg.sender),
    amountLD: 100e18,
    minAmountLD: 99e18,
    extraOptions: "",
    composeMsg: "",
    oftCmd: ""
});

shareOFT.send{value: fee}(sendParams, fee, msg.sender);
```

## Contributing

We welcome contributions from the community:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Write tests** for new features (`forge test`)
4. **Commit** changes (`git commit -m 'Add amazing feature'`)
5. **Push** to branch (`git push origin feature/amazing-feature`)
6. **Open** a Pull Request

### Code Style

- Follow existing Solidity style conventions
- Use NatSpec comments for all public functions
- Write comprehensive tests for new features
- Keep gas efficiency in mind

### Testing Requirements

- All new features must have test coverage
- Run full test suite before submitting PR: `forge test`
- Edge cases should be explicitly tested

## API Reference

- [Contract API](/api/contracts) - Auto-generated from NatSpec comments
- [Frontend API](/api/frontend) - Auto-generated from TSDoc comments
