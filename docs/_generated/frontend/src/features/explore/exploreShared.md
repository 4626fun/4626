[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/exploreShared

# src/features/explore/exploreShared

## Functions

### dedupeExploreCoinsByCreatorIdentity()

> **dedupeExploreCoinsByCreatorIdentity**\<`T`\>(`coins`): `T`[]

Defined in: [src/features/explore/exploreShared.ts:337](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L337)

#### Type Parameters

##### T

`T` *extends* `ExploreCoinIdentity`

#### Parameters

##### coins

readonly `T`[]

#### Returns

`T`[]

***

### flattenExplorePagedNodes()

> **flattenExplorePagedNodes**\<`TNode`\>(`pages`, `options`): `TNode`[]

Defined in: [src/features/explore/exploreShared.ts:288](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L288)

#### Type Parameters

##### TNode

`TNode`

#### Parameters

##### pages

(`ExplorePage`\<`TNode`\> \| `null` \| `undefined`)[] | `null` | `undefined`

##### options

###### filter?

(`node`) => `boolean`

#### Returns

`TNode`[]

***

### formatCompactUsd()

> **formatCompactUsd**(`v`): `string`

Defined in: [src/features/explore/exploreShared.ts:428](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L428)

#### Parameters

##### v

`number` | `null` | `undefined`

#### Returns

`string`

***

### formatCount()

> **formatCount**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:388](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L388)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### formatDateLabel()

> **formatDateLabel**(`value?`): `string`

Defined in: [src/features/explore/exploreShared.ts:408](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L408)

#### Parameters

##### value?

`string`

#### Returns

`string`

***

### formatShortAddress()

> **formatShortAddress**(`value`, `fallback`): `string`

Defined in: [src/features/explore/exploreShared.ts:364](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L364)

#### Parameters

##### value

`string` | `null` | `undefined`

##### fallback

`string` = `'-'`

#### Returns

`string`

***

### formatTimestamp()

> **formatTimestamp**(`ts`): `string`

Defined in: [src/features/explore/exploreShared.ts:396](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L396)

#### Parameters

##### ts

`number`

#### Returns

`string`

***

### formatTokenAmount()

> **formatTokenAmount**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:419](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L419)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### formatUsd()

> **formatUsd**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:379](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L379)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### isSupportedExploreChain()

> **isSupportedExploreChain**(`chain`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:349](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L349)

#### Parameters

##### chain

`string`

#### Returns

`boolean`

***

### matchesCoinSearchQuery()

> **matchesCoinSearchQuery**(`coin`, `query`, `options`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L115)

#### Parameters

##### coin

`ExploreSearchableCoin`

##### query

`string`

##### options

`CoinSearchMatchOptions` = `{}`

#### Returns

`boolean`

***

### normalizeCoinSearchQuery()

> **normalizeCoinSearchQuery**(`query`): `object`

Defined in: [src/features/explore/exploreShared.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L101)

#### Parameters

##### query

`string`

#### Returns

`object`

##### raw

> **raw**: `string`

##### withoutAt

> **withoutAt**: `string`

##### withoutBasenameSuffix

> **withoutBasenameSuffix**: `string`

***

### normalizeExploreOption()

> **normalizeExploreOption**\<`TValue`\>(`value`, `allowed`, `fallback`): `TValue`

Defined in: [src/features/explore/exploreShared.ts:146](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L146)

#### Type Parameters

##### TValue

`TValue` *extends* `string`

#### Parameters

##### value

`string` | `null` | `undefined`

##### allowed

readonly `TValue`[]

##### fallback

`TValue`

#### Returns

`TValue`

***

### parseNumber()

> **parseNumber**(`value`): `number`

Defined in: [src/features/explore/exploreShared.ts:370](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L370)

#### Parameters

##### value

`string` | `number` | `null` | `undefined`

#### Returns

`number`

***

### recordExploreQueryRefresh()

> **recordExploreQueryRefresh**(`scope`, `query`): `void`

Defined in: [src/features/explore/exploreShared.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L94)

#### Parameters

##### scope

`string`

##### query

`string`

#### Returns

`void`

***

### recordExploreSearchInputUpdate()

> **recordExploreSearchInputUpdate**(`scope`, `query`): `void`

Defined in: [src/features/explore/exploreShared.ts:87](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L87)

#### Parameters

##### scope

`string`

##### query

`string`

#### Returns

`void`

***

### resolveExploreCreatorIdentityKey()

> **resolveExploreCreatorIdentityKey**(`coin`): `string`

Defined in: [src/features/explore/exploreShared.ts:319](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L319)

#### Parameters

##### coin

`ExploreCoinIdentity`

#### Returns

`string`

***

### setExploreSearchParam()

> **setExploreSearchParam**(`searchParams`, `setSearchParams`, `key`, `value`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:156](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L156)

#### Parameters

##### searchParams

`URLSearchParams`

##### setSearchParams

`ExploreSearchParamSetter`

##### key

`string`

##### value

`string`

#### Returns

`boolean`

***

### setExploreSearchQueryParam()

> **setExploreSearchQueryParam**(`searchParams`, `setSearchParams`, `query`, `key`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:169](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L169)

#### Parameters

##### searchParams

`URLSearchParams`

##### setSearchParams

`ExploreSearchParamSetter`

##### query

`string`

##### key

`string` = `'q'`

#### Returns

`boolean`

***

### toDisplayAssetUrl()

> **toDisplayAssetUrl**(`value?`): `string` \| `undefined`

Defined in: [src/features/explore/exploreShared.ts:353](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L353)

#### Parameters

##### value?

`string`

#### Returns

`string` \| `undefined`

***

### useDebouncedValue()

> **useDebouncedValue**\<`TValue`\>(`value`, `delayMs`): `TValue`

Defined in: [src/features/explore/exploreShared.ts:277](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L277)

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### value

`TValue`

##### delayMs

`number`

#### Returns

`TValue`

***

### useExploreSubnavParams()

> **useExploreSubnavParams**\<`TSort`, `TTime`\>(`options`): `object`

Defined in: [src/features/explore/exploreShared.ts:185](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreShared.ts#L185)

#### Type Parameters

##### TSort

`TSort` *extends* `string`

##### TTime

`TTime` *extends* `string`

#### Parameters

##### options

`ExploreSubnavParamsOptions`\<`TSort`, `TTime`\>

#### Returns

`object`

##### currentSort

> **currentSort**: `TSort`

##### currentTimeFilter

> **currentTimeFilter**: `TTime`

##### handleSearchChange()

> **handleSearchChange**: (`query`) => `void`

###### Parameters

###### query

`string`

###### Returns

`void`

##### handleSortChange()

> **handleSortChange**: (`sort`) => `void`

###### Parameters

###### sort

`string`

###### Returns

`void`

##### handleTimeFilterChange()

> **handleTimeFilterChange**: (`timeFilter`) => `void`

###### Parameters

###### timeFilter

`string`

###### Returns

`void`

##### searchQuery

> **searchQuery**: `string`
