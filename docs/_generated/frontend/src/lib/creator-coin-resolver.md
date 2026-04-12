[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/creator-coin-resolver

# src/lib/creator-coin-resolver

## Functions

### getAllOwners()

> **getAllOwners**(`coinAddress`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [src/lib/creator-coin-resolver.ts:110](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/creator-coin-resolver.ts#L110)

Get all owners of a CreatorCoin (capped to prevent DoS from malicious contracts).

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### getCreatorCoinPayoutRecipient()

> **getCreatorCoinPayoutRecipient**(`coinAddress`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator-coin-resolver.ts:66](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/creator-coin-resolver.ts#L66)

Resolve CreatorCoin payoutRecipient.

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### getOwnerAt()

> **getOwnerAt**(`coinAddress`, `index`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator-coin-resolver.ts:88](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/creator-coin-resolver.ts#L88)

Get the owner at a specific index
Index 0: Coinbase Smart Account
Index 1: Privy
Index 2: Main EOA (Externally Owned Account)

#### Parameters

##### coinAddress

`` `0x${string}` ``

##### index

`number`

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### isCreatorCoin()

> **isCreatorCoin**(`address`): `Promise`\<`boolean`\>

Defined in: [src/lib/creator-coin-resolver.ts:172](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/creator-coin-resolver.ts#L172)

Check if an address is a CreatorCoin contract

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>

***

### resolveCreatorAddress()

> **resolveCreatorAddress**(`addressOrCoin`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/creator-coin-resolver.ts:142](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/creator-coin-resolver.ts#L142)

Resolve a CreatorCoin address to the creator's main wallet
Priority:
1. payoutRecipient (most reliable)
2. Owner at index 2 (main EOA)
3. Fallback to the contract address itself

#### Parameters

##### addressOrCoin

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``\>
