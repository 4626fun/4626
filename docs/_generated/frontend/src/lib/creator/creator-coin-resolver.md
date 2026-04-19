[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/creator/creator-coin-resolver

# src/lib/creator/creator-coin-resolver

## Functions

### getAllOwners()

> **getAllOwners**(`coinAddress`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:123](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/creator/creator-coin-resolver.ts#L123)

Get all owners of a CreatorCoin (capped to prevent DoS from malicious contracts).

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### getCreatorCoinPayoutRecipient()

> **getCreatorCoinPayoutRecipient**(`coinAddress`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:79](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/creator/creator-coin-resolver.ts#L79)

Resolve CreatorCoin payoutRecipient.

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### getOwnerAt()

> **getOwnerAt**(`coinAddress`, `index`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:101](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/creator/creator-coin-resolver.ts#L101)

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

Defined in: [src/lib/creator/creator-coin-resolver.ts:185](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/creator/creator-coin-resolver.ts#L185)

Check if an address is a CreatorCoin contract

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>

***

### resolveCreatorAddress()

> **resolveCreatorAddress**(`addressOrCoin`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:155](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/creator/creator-coin-resolver.ts#L155)

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
