# IBaseSolanaBridge
[Git Source](https://github.com/creatorvault/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/contracts/services/bridge/interfaces/IBaseSolanaBridge.sol)

Minimal interface for Base's Solana Bridge contract on Base mainnet.
References:
- Base docs: `https://docs.base.org/base-chain/quickstart/base-solana-bridge`
- Bridge address (Base mainnet): 0x3eff766C76a1be2Ce1aCF2B69c78bCae257D5188
Notes:
- The bridge uses Solana pubkeys in the ABI; onchain this is encoded as `bytes32`.
- Amounts for Base→Solana transfers are expressed in *remote* token units and fit in `uint64`.


## Functions
### getPredictedTwinAddress

Predict the deterministic Twin contract for a Solana sender pubkey.

ABI uses `bytes32` for the Solana pubkey.


```solidity
function getPredictedTwinAddress(bytes32 sender) external view returns (address);
```

### bridgeToken

Bridge a token to Solana, optionally with Solana instructions.

This method is `payable` (bridge fees may be required).


```solidity
function bridgeToken(Transfer calldata transfer, Ix[] calldata ixs) external payable;
```

### bridgeCall

Bridge a pure Solana call (no token transfer).

This method is `payable` (bridge fees may be required).


```solidity
function bridgeCall(Ix[] calldata ixs) external payable;
```

## Structs
### Ix
Solana instruction structure (serialized and relayed to Solana).

Field names align with Base docs / verified sources.


```solidity
struct Ix {
    bytes32 programId;
    bytes[] serializedAccounts;
    bytes data;
}
```

### Transfer
Base↔Solana transfer descriptor.


```solidity
struct Transfer {
    address localToken;
    bytes32 remoteToken;
    bytes32 to;
    uint64 remoteAmount;
}
```

