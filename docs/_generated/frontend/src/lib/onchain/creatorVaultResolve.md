[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/onchain/creatorVaultResolve

# src/lib/onchain/creatorVaultResolve

## Type Aliases

### CreatorCoinInfo

> **CreatorCoinInfo** = `object`

Defined in: [lib/onchain/creatorVaultResolve.ts:69](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L69)

#### Properties

##### creator

> **creator**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:78](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L78)

##### gaugeController

> **gaugeController**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:77](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L77)

##### isActive

> **isActive**: `boolean`

Defined in: [lib/onchain/creatorVaultResolve.ts:79](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L79)

##### name

> **name**: `string`

Defined in: [lib/onchain/creatorVaultResolve.ts:71](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L71)

##### oracle

> **oracle**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:76](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L76)

##### registeredAt

> **registeredAt**: `bigint` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:80](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L80)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:74](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L74)

##### symbol

> **symbol**: `string`

Defined in: [lib/onchain/creatorVaultResolve.ts:72](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L72)

##### token

> **token**: `Address`

Defined in: [lib/onchain/creatorVaultResolve.ts:70](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L70)

##### vault

> **vault**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:73](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L73)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:75](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L75)

***

### CreatorVaultResolved

> **CreatorVaultResolved** = `object`

Defined in: [lib/onchain/creatorVaultResolve.ts:83](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L83)

#### Properties

##### ccaStrategy

> **ccaStrategy**: `Address` \| `null`

Defined in: [lib/onchain/creatorVaultResolve.ts:86](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L86)

##### info

> **info**: [`CreatorCoinInfo`](#creatorcoininfo)

Defined in: [lib/onchain/creatorVaultResolve.ts:85](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L85)

##### token

> **token**: `Address`

Defined in: [lib/onchain/creatorVaultResolve.ts:84](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L84)

## Functions

### fetchCcaStrategyForToken()

> **fetchCcaStrategyForToken**\<`TTransport`, `TChain`\>(`publicClient`, `token`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [lib/onchain/creatorVaultResolve.ts:155](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L155)

#### Type Parameters

##### TTransport

`TTransport` *extends* `Transport` = `Transport`

##### TChain

`TChain` *extends* `Chain` \| `undefined` = `Chain` \| `undefined`

#### Parameters

##### publicClient

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### fetchCreatorCoinInfo()

> **fetchCreatorCoinInfo**\<`TTransport`, `TChain`\>(`publicClient`, `token`): `Promise`\<[`CreatorCoinInfo`](#creatorcoininfo) \| `null`\>

Defined in: [lib/onchain/creatorVaultResolve.ts:125](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L125)

#### Type Parameters

##### TTransport

`TTransport` *extends* `Transport` = `Transport`

##### TChain

`TChain` *extends* `Chain` \| `undefined` = `Chain` \| `undefined`

#### Parameters

##### publicClient

##### token

`` `0x${string}` ``

#### Returns

`Promise`\<[`CreatorCoinInfo`](#creatorcoininfo) \| `null`\>

***

### resolveCreatorTokenFromAnyAddress()

> **resolveCreatorTokenFromAnyAddress**\<`TTransport`, `TChain`\>(`publicClient`, `addr`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [lib/onchain/creatorVaultResolve.ts:96](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L96)

#### Type Parameters

##### TTransport

`TTransport` *extends* `Transport` = `Transport`

##### TChain

`TChain` *extends* `Chain` \| `undefined` = `Chain` \| `undefined`

#### Parameters

##### publicClient

##### addr

`` `0x${string}` ``

#### Returns

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### resolveCreatorVaultByAnyAddress()

> **resolveCreatorVaultByAnyAddress**\<`TTransport`, `TChain`\>(`publicClient`, `addressLike`): `Promise`\<[`CreatorVaultResolved`](#creatorvaultresolved) \| `null`\>

Defined in: [lib/onchain/creatorVaultResolve.ts:171](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/onchain/creatorVaultResolve.ts#L171)

#### Type Parameters

##### TTransport

`TTransport` *extends* `Transport` = `Transport`

##### TChain

`TChain` *extends* `Chain` \| `undefined` = `Chain` \| `undefined`

#### Parameters

##### publicClient

##### addressLike

`string`

#### Returns

`Promise`\<[`CreatorVaultResolved`](#creatorvaultresolved) \| `null`\>
