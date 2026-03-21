[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/creator-coin-resolver

# src/lib/creator-coin-resolver

## Functions

### getAllOwners()

> **getAllOwners**(`coinAddress`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [src/lib/creator-coin-resolver.ts:104](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/creator-coin-resolver.ts#L104)

Get all owners of a CreatorCoin (capped to prevent DoS from malicious contracts).

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### getOwnerAt()

> **getOwnerAt**(`coinAddress`, `index`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator-coin-resolver.ts:82](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/creator-coin-resolver.ts#L82)

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

### getPayoutRecipient()

> **getPayoutRecipient**(`coinAddress`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/creator-coin-resolver.ts:60](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/creator-coin-resolver.ts#L60)

Get the payout recipient (creator's main address) from a CreatorCoin contract

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### isCreatorCoin()

> **isCreatorCoin**(`address`): `Promise`\<`boolean`\>

Defined in: [src/lib/creator-coin-resolver.ts:166](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/creator-coin-resolver.ts#L166)

Check if an address is a CreatorCoin contract

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>

***

### resolveCreatorAddress()

> **resolveCreatorAddress**(`addressOrCoin`): `Promise`\<`` `0x${string}` ``\>

Defined in: [src/lib/creator-coin-resolver.ts:136](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/creator-coin-resolver.ts#L136)

Resolve a CreatorCoin address to the creator's main wallet
Priority:
1. Payout recipient (most reliable)
2. Owner at index 2 (main EOA)
3. Fallback to the contract address itself

#### Parameters

##### addressOrCoin

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``\>
