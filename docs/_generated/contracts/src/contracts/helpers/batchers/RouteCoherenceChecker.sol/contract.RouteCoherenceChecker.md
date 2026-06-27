# RouteCoherenceChecker
[Git Source](https://github.com/wenakita/4626/blob/2951e17122326ff4a23b28e80356c44121ebf59c/contracts/helpers/batchers/RouteCoherenceChecker.sol)

**Title:**
RouteCoherenceChecker

Read-only helper to validate registry route wiring for a creator token.


## Constants
### registry

```solidity
ICreatorRegistry public immutable registry
```


## Functions
### constructor


```solidity
constructor(address registry_) ;
```

### checkRouteCoherence

Bit mapping for `mismatchBitmap`:
1 = vault mismatch
2 = shareOFT mismatch
4 = oracle mismatch
8 = gauge mismatch


```solidity
function checkRouteCoherence(
    address creatorToken,
    address expectedVault,
    address expectedShareOFT,
    address expectedOracle,
    address expectedGaugeController
) external view returns (RouteCoherenceStatus memory status);
```

## Errors
### ZeroAddress

```solidity
error ZeroAddress();
```

## Structs
### RouteCoherenceStatus

```solidity
struct RouteCoherenceStatus {
    bool ok;
    uint8 mismatchBitmap;
    bool active;
    address registryVault;
    address registryShareOFT;
    address registryOracle;
    address registryGaugeController;
}
```

