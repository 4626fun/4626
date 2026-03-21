# IStrategyValuation
[Git Source](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/contracts/interfaces/IStrategyValuation.sol)

**Title:**
IStrategyValuation

**Author:**
0xakita.eth

Optional strategy extension for valuation readiness checks.

Vaults can use this to gate ERC-4626 deposits/mints when a strategy cannot
produce a reliable valuation (e.g., oracle unavailable) to prevent share dilution.


## Functions
### isValuationReady

Whether this strategy's valuation inputs are currently healthy.

MUST NOT revert. Return false when valuation is unavailable/unreliable.


```solidity
function isValuationReady() external view returns (bool);
```

