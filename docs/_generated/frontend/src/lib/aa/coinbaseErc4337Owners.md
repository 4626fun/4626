[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/aa/coinbaseErc4337Owners

# src/lib/aa/coinbaseErc4337Owners

## Type Aliases

### OwnersPublicClientLike

> **OwnersPublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L32)

#### Type Declaration

##### chain?

> `optional` **chain**: `object`

###### chain.id

> **id**: `number`

##### readContract()

> **readContract**: (`args`) => `Promise`\<`any`\>

###### Parameters

###### args

`any`

###### Returns

`Promise`\<`any`\>

## Functions

### fetchCoinbaseSmartWalletOwners()

> **fetchCoinbaseSmartWalletOwners**(`params`): `Promise`\<`` `0x${string}` ``[]\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:160](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L160)

#### Parameters

##### params

###### maxOwners?

`number`

###### publicClient

[`OwnersPublicClientLike`](#ownerspublicclientlike)

###### smartWallet

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` ``[]\>

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L76)

#### Parameters

##### params

###### maxScan?

`number`

###### ownerAddress

`` `0x${string}` ``

###### publicClient

[`OwnersPublicClientLike`](#ownerspublicclientlike)

###### smartWallet

`` `0x${string}` ``

###### useCache?

`boolean`

#### Returns

`Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

***

### resetOwnerIndexCacheForTests()

> **resetOwnerIndexCacheForTests**(): `void`

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L72)

#### Returns

`void`
