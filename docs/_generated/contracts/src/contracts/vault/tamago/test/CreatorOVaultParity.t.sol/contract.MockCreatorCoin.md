# MockCreatorCoin
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/vault/tamago/test/CreatorOVaultParity.t.sol)

**Inherits:**
ERC20

Minimal mintable ERC-20 so we can seed CreatorOVault for view-function parity checks.


## Functions
### constructor


```solidity
constructor() ERC20("Mock Creator", "MOCK");
```

### mint


```solidity
function mint(address to, uint256 amount) external;
```

