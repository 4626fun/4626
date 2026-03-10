# ILotteryBeneficiary
[Git Source](https://github.com/wenakita/4626/blob/a7a73da3f7c497451de25d8aa13ad38808135355/contracts/utilities/messaging/CreatorShareOFT.sol)

**Title:**
ILotteryBeneficiary

Interface for aggregators/multicall contracts to specify lottery beneficiary

Implement this on aggregator contracts to ensure users get lottery entries
when swapping through your protocol.


## Functions
### getLotteryBeneficiary

Returns the actual user who should receive lottery entries


```solidity
function getLotteryBeneficiary() external view returns (address beneficiary);
```
**Returns**

|Name|Type|Description|
|----|----|-----------|
|`beneficiary`|`address`|The address that should receive lottery entries Return address(0) to use the contract itself as beneficiary|


