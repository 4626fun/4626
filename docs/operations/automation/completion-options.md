---
title: Completion options
sidebar_position: 3
---

# Automated auction completion options

This document describes options for automatically completing CCA auctions.

**Who this is for:** Protocol engineers implementing auction automation.

---

## The problem

Smart contracts are passive and can only run when:
1. Someone sends a transaction to them
2. Another contract calls them
3. An external system triggers them

Contracts cannot wake themselves up, execute on a schedule, or trigger based on time alone. This is by design for security and cost reasons.

---

## Solution 1: Chainlink Automation (recommended for production)

Decentralized network of keeper nodes that monitors your contract and automatically calls functions when conditions are met.

### Implementation

```solidity
import "@chainlink/contracts/src/v0.8/automation/AutomationCompatible.sol";

contract CCALaunchStrategy is AutomationCompatibleInterface {
    
    function checkUpkeep(bytes calldata)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory)
    {
        if (currentAuction == address(0)) {
            return (false, "");
        }
        
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        bool isGraduated = auction.isGraduated();
        bool hasEnded = block.number > auction.endBlock();
        
        upkeepNeeded = hasEnded && !isGraduated;
    }
    
    function performUpkeep(bytes calldata) external override {
        if (currentAuction == address(0)) revert NoActiveAuction();
        
        IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
        if (!auction.isGraduated()) revert AuctionNotGraduated();
        
        this.sweepCurrency();
    }
}
```

### Setup

1. Go to https://automation.chain.link
2. Connect wallet
3. Click "Register new Upkeep"
4. Select "Custom logic"
5. Enter your CCALaunchStrategy address
6. Fund with LINK tokens

### Configuration

- Check interval: Every hour
- Gas limit: 500,000
- Funding: ~5 LINK

### Trade-offs

| Pros | Cons |
|------|------|
| Fully decentralized | Costs LINK tokens (~$20-50 setup) |
| Highly reliable | Requires contract modification |
| No server maintenance | |
| Industry standard | |

---

## Solution 2: Gelato Network

Similar to Chainlink but from a different provider. Also decentralized automation, slightly cheaper.

### Trade-offs

| Pros | Cons |
|------|------|
| Decentralized | Less proven than Chainlink |
| Cheaper than Chainlink | Requires contract modification |
| Easy to use | |

---

## Solution 3: Incentivized permissionless

Make completion profitable for anyone to call.

### Implementation

```solidity
function sweepCurrency() external nonReentrant {
    if (currentAuction == address(0)) revert NoActiveAuction();
    
    IContinuousClearingAuction auction = IContinuousClearingAuction(currentAuction);
    
    (, uint256 endBlock,,) = auction.auctionParameters();
    if (block.number < endBlock) revert AuctionStillActive();
    
    uint256 raised = auction.currencyRaised();
    auction.sweepCurrency();
    
    // Incentive: Give 0.1% of raised ETH to caller
    uint256 incentive = raised / 1000;
    if (incentive > 0 && msg.sender != owner()) {
        payable(msg.sender).transfer(incentive);
    }
    
    graduatedAuction = currentAuction;
    isGraduated = true;
    
    emit AuctionGraduated(currentAuction, raised, 0);
    emit FundsSwept(currentAuction, raised);
}
```

### Example economics

For $10,000 raised:
- Incentive: $10 (0.1%)
- Anyone can call after auction ends
- Caller gets $10 for ~$1 gas
- Profitable = guaranteed execution

### Trade-offs

| Pros | Cons |
|------|------|
| Simple modification | Costs 0.1% of raised ETH |
| No ongoing costs | Requires redeployment |
| Decentralized | Still needs someone to notice |
| Market-driven reliability | |

---

## Solution 4: Keeper bot

Run your own bot to monitor and complete auctions.

### Implementation

```typescript
import { ethers } from 'ethers'

const provider = new ethers.JsonRpcProvider(process.env.BASE_RPC)
const wallet = new ethers.Wallet(process.env.KEEPER_KEY, provider)

const ccaStrategy = new ethers.Contract(
  strategyAddress,
  ['function getAuctionStatus() view returns (address, bool, bool, uint256, uint256)',
   'function sweepCurrency() external'],
  wallet
)

async function checkAndComplete() {
  const [auction, isActive, isGraduated] = await ccaStrategy.getAuctionStatus()
  
  if (!isActive && !isGraduated && auction !== ethers.ZeroAddress) {
    const tx = await ccaStrategy.sweepCurrency()
    await tx.wait()
  }
}

// Check every hour
setInterval(checkAndComplete, 60 * 60 * 1000)
```

### Trade-offs

| Pros | Cons |
|------|------|
| No contract changes needed | Centralized |
| Works with current deployment | Requires private key management |
| Free hosting available | Needs gas funds |
| Full control | |

---

## Comparison

| Solution | Cost | Decentralized | Requires redeploy | Setup time | Reliability |
|----------|------|---------------|-------------------|------------|-------------|
| Chainlink Automation | ~$50 LINK | Yes | Yes | 4 hours | High |
| Gelato Network | ~$30 | Yes | Yes | 3 hours | High |
| Incentivized | 0.1% raised | Yes | Yes | 2 hours | High |
| Keeper Bot | $0 hosting | No | No | 1 hour | Medium |

---

## Recommendations

### For immediate launch

1. Deploy keeper bot (1 hour setup)
2. Set calendar reminders as backup
3. Works with current deployment

### For production

1. Add incentive mechanism to contract
2. Redeploy CCALaunchStrategy
3. Completion is guaranteed (someone will claim the incentive)

---

## References

- [Full automation](./full-automation.md)
- [Quick start](./quick-start.md)
