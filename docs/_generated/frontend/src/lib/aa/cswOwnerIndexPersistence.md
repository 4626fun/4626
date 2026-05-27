[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/aa/cswOwnerIndexPersistence

# src/lib/aa/cswOwnerIndexPersistence

## Type Aliases

### PersistedCswOwnerIndex

> **PersistedCswOwnerIndex** = `object`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L5)

#### Properties

##### ownerCountSnapshot

> **ownerCountSnapshot**: `number`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L7)

##### ownerIndex

> **ownerIndex**: `number`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L6)

##### savedAt

> **savedAt**: `number`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L8)

## Functions

### clearCswOwnerIndexPersistenceForTests()

> **clearCswOwnerIndexPersistenceForTests**(): `void`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L90)

#### Returns

`void`

***

### clearPersistedCswOwnerIndex()

> **clearPersistedCswOwnerIndex**(`params`): `void`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L77)

#### Parameters

##### params

###### chainId

`number`

###### ownerAddress

`string`

###### smartWallet

`string`

#### Returns

`void`

***

### readPersistedCswOwnerIndex()

> **readPersistedCswOwnerIndex**(`params`): [`PersistedCswOwnerIndex`](#persistedcswownerindex) \| `null`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L27)

#### Parameters

##### params

###### chainId

`number`

###### ownerAddress

`string`

###### smartWallet

`string`

#### Returns

[`PersistedCswOwnerIndex`](#persistedcswownerindex) \| `null`

***

### writePersistedCswOwnerIndex()

> **writePersistedCswOwnerIndex**(`params`): `void`

Defined in: [src/lib/aa/cswOwnerIndexPersistence.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/aa/cswOwnerIndexPersistence.ts#L52)

#### Parameters

##### params

###### chainId

`number`

###### ownerAddress

`string`

###### ownerCountSnapshot

`number`

###### ownerIndex

`number`

###### smartWallet

`string`

#### Returns

`void`
