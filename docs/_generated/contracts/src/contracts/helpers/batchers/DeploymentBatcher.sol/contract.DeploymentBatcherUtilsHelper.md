# DeploymentBatcherUtilsHelper
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/batchers/DeploymentBatcher.sol)


## Functions
### toLower


```solidity
function toLower(string calldata input) external pure returns (string memory);
```

### toUpper


```solidity
function toUpper(string calldata input) external pure returns (string memory);
```

### deriveBaseSalt


```solidity
function deriveBaseSalt(address creatorToken, address owner, uint256 chainId, string calldata version)
    external
    pure
    returns (bytes32);
```

### saltFor


```solidity
function saltFor(bytes32 baseSalt, string calldata label) external pure returns (bytes32);
```

### deriveShareOftSalt


```solidity
function deriveShareOftSalt(address owner, string calldata shareSymbolLower, string calldata version)
    external
    pure
    returns (bytes32);
```

### phase1ParamsHash


```solidity
function phase1ParamsHash(
    address creatorToken,
    address owner,
    string calldata vaultName,
    string calldata vaultSymbol,
    string calldata shareName,
    string calldata shareSymbol,
    string calldata version
) external pure returns (bytes32);
```

### phase1CodeIdsHash


```solidity
function phase1CodeIdsHash(bytes32 vault, bytes32 wrapper, bytes32 shareOFT, bytes32 oftBootstrap)
    external
    pure
    returns (bytes32);
```

