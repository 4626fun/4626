[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/creator/creator-coin-resolver

# src/lib/creator/creator-coin-resolver

## Functions

### getAllOwners()

> **getAllOwners**(`coinAddress`): `Promise`\<`string`[]\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:123](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/creator/creator-coin-resolver.ts#L123)

Get all owners of a CreatorCoin (capped to prevent DoS from malicious contracts).

#### Parameters

##### coinAddress

`string`

#### Returns

`Promise`\<`string`[]\>

***

### getCreatorCoinPayoutRecipient()

> **getCreatorCoinPayoutRecipient**(`coinAddress`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:79](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/creator/creator-coin-resolver.ts#L79)

Resolve CreatorCoin payoutRecipient.

#### Parameters

##### coinAddress

`string`

#### Returns

`Promise`\<`string` \| `null`\>

***

### getOwnerAt()

> **getOwnerAt**(`coinAddress`, `index`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:101](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/creator/creator-coin-resolver.ts#L101)

Get the owner at a specific index
Index 0: Coinbase Smart Account
Index 1: Privy
Index 2: Main EOA (Externally Owned Account)

#### Parameters

##### coinAddress

`string`

##### index

`number`

#### Returns

`Promise`\<`string` \| `null`\>

***

### isCreatorCoin()

> **isCreatorCoin**(`address`): `Promise`\<`boolean`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:185](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/creator/creator-coin-resolver.ts#L185)

Check if an address is a CreatorCoin contract

#### Parameters

##### address

`string`

#### Returns

`Promise`\<`boolean`\>

***

### resolveCreatorAddress()

> **resolveCreatorAddress**(`addressOrCoin`): `Promise`\<`string`\>

Defined in: [src/lib/creator/creator-coin-resolver.ts:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/creator/creator-coin-resolver.ts#L155)

Resolve a CreatorCoin address to the creator's main wallet
Priority:
1. payoutRecipient (most reliable)
2. Owner at index 2 (main EOA)
3. Fallback to the contract address itself

#### Parameters

##### addressOrCoin

`string`

#### Returns

`Promise`\<`string`\>
