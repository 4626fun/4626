---
title: Activate a vault
sidebar_position: 2
---

# Activate a vault

This guide covers activating a newly deployed creator vault, including wrapper configuration, ShareOFT deployment, and strategy setup.

**Prerequisite:** You have already [deployed a vault](/guides/deploy-vault).

---

## Activation overview

Activation connects all vault components:

```
Vault deployed
    │
    ▼
┌─────────────────────────┐
│   Configure Wrapper     │ ▢TOKEN ↔ ■TOKEN
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   Deploy ShareOFT       │ Cross-chain token
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│  Set GaugeController    │ Fee routing
└─────────────────────────┘
    │
    ▼
┌─────────────────────────┐
│   Add Strategies        │ Capital deployment
└─────────────────────────┘
    │
    ▼
Vault active
```

---

## Step 1: Configure wrapper

The wrapper converts between ▢TOKEN (vault shares) and ■TOKEN (tradeable OFT).

### Initialize wrapper

```solidity
wrapper.initialize(
    vault,          // CreatorOVault address
    "Wrapped AKITA",// ■TOKEN name
    "wAKITA"        // ■TOKEN symbol
);
```

### Set vault approval

```solidity
// Approve wrapper to transfer vault shares
vault.approve(address(wrapper), type(uint256).max);
```

### Verify configuration

```solidity
// Check wrapper is properly configured
require(wrapper.vault() == vault);
require(wrapper.shareOFT() == address(0)); // Set after ShareOFT deploy
```

---

## Step 2: Deploy ShareOFT

The ShareOFT is the cross-chain tradeable token.

### Deploy with CREATE2

```solidity
bytes32 salt = keccak256(abi.encodePacked(creatorCoin, deployer));

CreatorShareOFT shareOFT = new CreatorShareOFT{salt: salt}(
    "AKITA Share Token", // Name
    "sAKITA",            // Symbol (■AKITA)
    lzEndpoint,          // LayerZero endpoint
    wrapper              // Wrapper address
);
```

### Configure ShareOFT

```solidity
// Set address classifications
shareOFT.setAddressType(uniswapRouter, OperationType.SwapOnly);
shareOFT.setAddressType(uniswapPool, OperationType.SwapOnly);
shareOFT.setAddressType(vault, OperationType.NoFees);
shareOFT.setAddressType(gaugeController, OperationType.NoFees);
```

### Link wrapper to ShareOFT

```solidity
wrapper.setShareOFT(address(shareOFT));
```

---

## Step 3: Set GaugeController

The GaugeController routes trading fees.

### Deploy GaugeController

```solidity
CreatorGaugeController gaugeController = new CreatorGaugeController(
    vault,
    shareOFT,
    wrapper
);
```

### Configure recipients

```solidity
// Set lottery manager (69%)
gaugeController.setLotteryManager(lotteryManager);

// Set voter rewards (9.61%)
gaugeController.setVoterRewardsDistributor(voterRewards);

// Remaining 21.39% is burned automatically
```

### Link to ShareOFT

```solidity
shareOFT.setGaugeController(address(gaugeController));
```

---

## Step 4: Add strategies

Strategies deploy vault capital for yield.

### Add CCA strategy

```solidity
// For ■TOKEN fair launch
CCALaunchStrategy ccaStrategy = new CCALaunchStrategy(
    shareOFT,
    ccaFactory,
    weth
);

vault.addStrategy(address(ccaStrategy), 6900); // 69% allocation
```

### Add Charm strategy

```solidity
// For TOKEN LP yield
CreatorCharmStrategy charmStrategy = new CreatorCharmStrategy(
    vault,
    charmVault,
    creatorCoin
);

vault.addStrategy(address(charmStrategy), 2139); // 21.39% allocation
```

### Set idle buffer

```solidity
// Keep 10% idle for withdrawals
vault.setMinimumTotalIdle(vault.totalAssets() / 10);
```

---

## One-click activation

Use VaultActivationBatcher for streamlined activation:

```solidity
VaultActivationBatcher batcher = VaultActivationBatcher(BATCHER_ADDRESS);

batcher.activateVault(
    vault,
    creatorCoin,
    "Wrapped AKITA",
    "wAKITA",
    lzEndpoint,
    [ccaStrategy, charmStrategy],
    [6900, 2139]
);
```

This deploys and configures all components in a single transaction.

---

## Verification checklist

### Wrapper

- [ ] Wrapper initialized with correct vault
- [ ] Wrapper linked to ShareOFT
- [ ] Vault approved wrapper for max shares

### ShareOFT

- [ ] ShareOFT deployed with correct name/symbol
- [ ] Address types configured for pools/routers
- [ ] GaugeController linked

### GaugeController

- [ ] Lottery manager set (or address(0) for day-1)
- [ ] Voter rewards set (or address(0) for day-1)
- [ ] Fee split configured

### Strategies

- [ ] Strategies added with correct weights
- [ ] Total weights equal 10000 bps
- [ ] Idle buffer set appropriately

---

## Common issues

### Wrapper not linked

```
Error: ShareOFT not set
Solution: Call wrapper.setShareOFT(shareOFT)
```

### Address type not set

```
Error: Buy fees not being collected
Solution: Ensure DEX pools/routers are SwapOnly type
```

### Strategy weight overflow

```
Error: Weights exceed MAX_BPS
Solution: Ensure total strategy weights ≤ 10000
```

---

## Next steps

After activation:

1. [Launch token via CCA](/guides/launch-token)
2. [Set up automation](/operations/automation)
3. [Configure multisig](/operations/deployment/multisig/guide)

---

## Related

- [Deploy Vault](/guides/deploy-vault) - Initial deployment
- [Launch Token](/guides/launch-token) - CCA fair launch
- [Architecture](/overview/architecture) - System design
