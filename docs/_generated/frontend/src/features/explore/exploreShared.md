[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/explore/exploreShared

# src/features/explore/exploreShared

## Functions

### flattenExplorePagedNodes()

> **flattenExplorePagedNodes**\<`TNode`\>(`pages`, `options`): `TNode`[]

Defined in: [src/features/explore/exploreShared.ts:287](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L287)

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

### formatCount()

> **formatCount**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:346](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L346)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### formatDateLabel()

> **formatDateLabel**(`value?`): `string`

Defined in: [src/features/explore/exploreShared.ts:366](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L366)

#### Parameters

##### value?

`string`

#### Returns

`string`

***

### formatShortAddress()

> **formatShortAddress**(`value`, `fallback`): `string`

Defined in: [src/features/explore/exploreShared.ts:322](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L322)

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

Defined in: [src/features/explore/exploreShared.ts:354](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L354)

#### Parameters

##### ts

`number`

#### Returns

`string`

***

### formatTokenAmount()

> **formatTokenAmount**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:377](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L377)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### formatUsd()

> **formatUsd**(`value`): `string`

Defined in: [src/features/explore/exploreShared.ts:337](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L337)

#### Parameters

##### value

`number`

#### Returns

`string`

***

### isSupportedExploreChain()

> **isSupportedExploreChain**(`chain`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:307](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L307)

#### Parameters

##### chain

`string`

#### Returns

`boolean`

***

### matchesCoinSearchQuery()

> **matchesCoinSearchQuery**(`coin`, `query`, `options`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:114](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L114)

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

Defined in: [src/features/explore/exploreShared.ts:101](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L101)

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

Defined in: [src/features/explore/exploreShared.ts:145](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L145)

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

Defined in: [src/features/explore/exploreShared.ts:328](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L328)

#### Parameters

##### value

`string` | `number` | `null` | `undefined`

#### Returns

`number`

***

### recordExploreQueryRefresh()

> **recordExploreQueryRefresh**(`scope`, `query`): `void`

Defined in: [src/features/explore/exploreShared.ts:94](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L94)

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

Defined in: [src/features/explore/exploreShared.ts:87](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L87)

#### Parameters

##### scope

`string`

##### query

`string`

#### Returns

`void`

***

### setExploreSearchParam()

> **setExploreSearchParam**(`searchParams`, `setSearchParams`, `key`, `value`): `boolean`

Defined in: [src/features/explore/exploreShared.ts:155](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L155)

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

Defined in: [src/features/explore/exploreShared.ts:168](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L168)

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

Defined in: [src/features/explore/exploreShared.ts:311](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L311)

#### Parameters

##### value?

`string`

#### Returns

`string` \| `undefined`

***

### useDebouncedValue()

> **useDebouncedValue**\<`TValue`\>(`value`, `delayMs`): `TValue`

Defined in: [src/features/explore/exploreShared.ts:276](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L276)

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

Defined in: [src/features/explore/exploreShared.ts:184](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/explore/exploreShared.ts#L184)

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
