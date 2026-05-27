[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/coinbaseErc4337Owners

# src/lib/aa/coinbaseErc4337Owners

## Type Aliases

### OwnersPublicClientLike

> **OwnersPublicClientLike** = `object` & `Record`\<`string`, `any`\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:38](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L38)

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

> **fetchCoinbaseSmartWalletOwners**(`params`): `Promise`\<`string`[]\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:222](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L222)

#### Parameters

##### params

###### maxOwners?

`number`

###### publicClient

[`OwnersPublicClientLike`](#ownerspublicclientlike)

###### smartWallet

`string`

#### Returns

`Promise`\<`string`[]\>

***

### findCoinbaseSmartWalletOwnerIndex()

> **findCoinbaseSmartWalletOwnerIndex**(`params`): `Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L100)

#### Parameters

##### params

###### maxScan?

`number`

###### ownerAddress

`string`

###### publicClient

[`OwnersPublicClientLike`](#ownerspublicclientlike)

###### smartWallet

`string`

###### useCache?

`boolean`

#### Returns

`Promise`\<\{ `ownerCount`: `number`; `ownerIndex`: `number` \| `null`; \}\>

***

### resetOwnerIndexCacheForTests()

> **resetOwnerIndexCacheForTests**(): `void`

Defined in: [src/lib/aa/coinbaseErc4337Owners.ts:96](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/coinbaseErc4337Owners.ts#L96)

#### Returns

`void`
