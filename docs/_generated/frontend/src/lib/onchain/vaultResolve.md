[**4626-miniapp**](../../../index.md)

***

[4626-miniapp](../../../index.md) / src/lib/onchain/vaultResolve

# src/lib/onchain/vaultResolve

## Type Aliases

### CreatorCoinInfo

> **CreatorCoinInfo** = `object`

Defined in: [lib/onchain/vaultResolve.ts:69](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L69)

#### Properties

##### creator

> **creator**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:78](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L78)

##### gaugeController

> **gaugeController**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:77](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L77)

##### isActive

> **isActive**: `boolean`

Defined in: [lib/onchain/vaultResolve.ts:79](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L79)

##### name

> **name**: `string`

Defined in: [lib/onchain/vaultResolve.ts:71](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L71)

##### oracle

> **oracle**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:76](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L76)

##### registeredAt

> **registeredAt**: `bigint` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:80](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L80)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:74](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L74)

##### symbol

> **symbol**: `string`

Defined in: [lib/onchain/vaultResolve.ts:72](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L72)

##### token

> **token**: `Address`

Defined in: [lib/onchain/vaultResolve.ts:70](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L70)

##### vault

> **vault**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:73](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L73)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:75](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L75)

***

### 4626Resolved

> **4626Resolved** = `object`

Defined in: [lib/onchain/vaultResolve.ts:83](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L83)

#### Properties

##### ccaStrategy

> **ccaStrategy**: `Address` \| `null`

Defined in: [lib/onchain/vaultResolve.ts:86](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L86)

##### info

> **info**: [`CreatorCoinInfo`](#creatorcoininfo)

Defined in: [lib/onchain/vaultResolve.ts:85](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L85)

##### token

> **token**: `Address`

Defined in: [lib/onchain/vaultResolve.ts:84](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L84)

## Functions

### fetchCcaStrategyForToken()

> **fetchCcaStrategyForToken**\<`TTransport`, `TChain`\>(`publicClient`, `token`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [lib/onchain/vaultResolve.ts:155](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L155)

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

Defined in: [lib/onchain/vaultResolve.ts:125](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L125)

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

Defined in: [lib/onchain/vaultResolve.ts:96](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L96)

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

### resolve4626ByAnyAddress()

> **resolve4626ByAnyAddress**\<`TTransport`, `TChain`\>(`publicClient`, `addressLike`): `Promise`\<[`4626Resolved`](#4626resolved) \| `null`\>

Defined in: [lib/onchain/vaultResolve.ts:171](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/onchain/vaultResolve.ts#L171)

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

`Promise`\<[`4626Resolved`](#4626resolved) \| `null`\>
