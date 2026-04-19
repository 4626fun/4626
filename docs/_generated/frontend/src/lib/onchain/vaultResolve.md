[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/onchain/vaultResolve

# src/lib/onchain/vaultResolve

## Type Aliases

### CreatorCoinInfo

> **CreatorCoinInfo** = `object`

Defined in: [src/lib/onchain/vaultResolve.ts:80](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L80)

#### Properties

##### creator

> **creator**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:89](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L89)

##### gaugeController

> **gaugeController**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:88](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L88)

##### isActive

> **isActive**: `boolean`

Defined in: [src/lib/onchain/vaultResolve.ts:90](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L90)

##### name

> **name**: `string`

Defined in: [src/lib/onchain/vaultResolve.ts:82](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L82)

##### oracle

> **oracle**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:87](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L87)

##### registeredAt

> **registeredAt**: `bigint` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:91](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L91)

##### shareOFT

> **shareOFT**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:85](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L85)

##### symbol

> **symbol**: `string`

Defined in: [src/lib/onchain/vaultResolve.ts:83](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L83)

##### token

> **token**: `Address`

Defined in: [src/lib/onchain/vaultResolve.ts:81](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L81)

##### vault

> **vault**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:84](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L84)

##### wrapper

> **wrapper**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:86](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L86)

***

### VaultResolved

> **VaultResolved** = `object`

Defined in: [src/lib/onchain/vaultResolve.ts:94](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L94)

#### Properties

##### ccaStrategy

> **ccaStrategy**: `Address` \| `null`

Defined in: [src/lib/onchain/vaultResolve.ts:97](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L97)

##### info

> **info**: [`CreatorCoinInfo`](#creatorcoininfo)

Defined in: [src/lib/onchain/vaultResolve.ts:96](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L96)

##### token

> **token**: `Address`

Defined in: [src/lib/onchain/vaultResolve.ts:95](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L95)

## Functions

### fetchCreatorCoinInfo()

> **fetchCreatorCoinInfo**\<`TTransport`, `TChain`\>(`publicClient`, `token`): `Promise`\<[`CreatorCoinInfo`](#creatorcoininfo) \| `null`\>

Defined in: [src/lib/onchain/vaultResolve.ts:155](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L155)

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

Defined in: [src/lib/onchain/vaultResolve.ts:112](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L112)

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

### resolveCreatorTradeTokenAddress()

> **resolveCreatorTradeTokenAddress**\<`TTransport`, `TChain`\>(`publicClient`, `addressLike`): `Promise`\<`` `0x${string}` `` \| `null`\>

Defined in: [src/lib/onchain/vaultResolve.ts:143](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L143)

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

`Promise`\<`` `0x${string}` `` \| `null`\>

***

### resolveVaultByAnyAddress()

> **resolveVaultByAnyAddress**\<`TTransport`, `TChain`\>(`publicClient`, `addressLike`): `Promise`\<[`VaultResolved`](#vaultresolved) \| `null`\>

Defined in: [src/lib/onchain/vaultResolve.ts:381](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/onchain/vaultResolve.ts#L381)

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

`Promise`\<[`VaultResolved`](#vaultresolved) \| `null`\>
