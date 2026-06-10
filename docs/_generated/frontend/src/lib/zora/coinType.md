[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/coinType

# src/lib/zora/coinType

## Type Aliases

### ZoraCoinType

> **ZoraCoinType** = `"CREATOR"` \| `"CONTENT"` \| `"TREND"`

Defined in: [src/lib/zora/coinType.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/coinType.ts#L1)

## Functions

### normalizeZoraCoinType()

> **normalizeZoraCoinType**(`raw`): [`ZoraCoinType`](#zoracointype)

Defined in: [src/lib/zora/coinType.ts:4](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/coinType.ts#L4)

Normalize Zora API coinType — defaults to CREATOR only when unknown.

#### Parameters

##### raw

`unknown`

#### Returns

[`ZoraCoinType`](#zoracointype)

***

### splitZoraHoldingsByCoinType()

> **splitZoraHoldingsByCoinType**\<`T`\>(`rows`): `object`

Defined in: [src/lib/zora/coinType.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/coinType.ts#L17)

#### Type Parameters

##### T

`T` *extends* `object`

#### Parameters

##### rows

`T`[]

#### Returns

`object`

##### content

> **content**: `T`[]

##### creator

> **creator**: `T`[]

##### trend

> **trend**: `T`[]

***

### zoraCoinTypeLabel()

> **zoraCoinTypeLabel**(`coinType`): `string`

Defined in: [src/lib/zora/coinType.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/coinType.ts#L11)

#### Parameters

##### coinType

[`ZoraCoinType`](#zoracointype)

#### Returns

`string`
