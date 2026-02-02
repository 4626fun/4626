[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/creator-coin-resolver

# src/lib/creator-coin-resolver

## Functions

### getAllOwners()

> **getAllOwners**(`coinAddress`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [lib/creator-coin-resolver.ts:86](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/creator-coin-resolver.ts#L86)

Get all owners of a CreatorCoin

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### getOwnerAt()

> **getOwnerAt**(`coinAddress`, `index`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [lib/creator-coin-resolver.ts:66](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/creator-coin-resolver.ts#L66)

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

Defined in: [lib/creator-coin-resolver.ts:44](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/creator-coin-resolver.ts#L44)

Get the payout recipient (creator's main address) from a CreatorCoin contract

#### Parameters

##### coinAddress

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### isCreatorCoin()

> **isCreatorCoin**(`address`): `Promise`\<`boolean`\>

Defined in: [lib/creator-coin-resolver.ts:147](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/creator-coin-resolver.ts#L147)

Check if an address is a CreatorCoin contract

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean`\>

***

### resolveCreatorAddress()

> **resolveCreatorAddress**(`addressOrCoin`): `Promise`\<`` `0x${string}` ``\>

Defined in: [lib/creator-coin-resolver.ts:117](https://github.com/wenakita/4626/blob/2cd71abc97601febe38089cb23bfd133739e818d/frontend/src/lib/creator-coin-resolver.ts#L117)

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
