[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/explore/tableColumns

# src/components/explore/tableColumns

## Type Aliases

### ExploreColumnAlign

> **ExploreColumnAlign** = `"left"` \| `"right"` \| `"center"`

Defined in: [src/components/explore/tableColumns.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L19)

***

### ExploreSortKey

> **ExploreSortKey** = `"volume"` \| `"marketCap"` \| `"priceChange"` \| `"new"` \| `"ethosScore"`

Defined in: [src/components/explore/tableColumns.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L3)

***

### ExploreTableColumn

> **ExploreTableColumn** = `object`

Defined in: [src/components/explore/tableColumns.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L21)

#### Properties

##### align?

> `optional` **align**: [`ExploreColumnAlign`](#explorecolumnalign)

Defined in: [src/components/explore/tableColumns.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L27)

##### group

> **group**: [`ExploreTableGroupId`](#exploretablegroupid-1)

Defined in: [src/components/explore/tableColumns.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L24)

##### id

> **id**: [`ExploreTableColumnId`](#exploretablecolumnid-1)

Defined in: [src/components/explore/tableColumns.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L22)

##### label

> **label**: `string`

Defined in: [src/components/explore/tableColumns.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L23)

##### sortKey?

> `optional` **sortKey**: [`ExploreSortKey`](#exploresortkey)

Defined in: [src/components/explore/tableColumns.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L29)

If set, clicking the header should map to this sort key.

##### sticky?

> `optional` **sticky**: `boolean`

Defined in: [src/components/explore/tableColumns.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L31)

Sticky-left column (rank/name only).

##### widthPx

> **widthPx**: `number`

Defined in: [src/components/explore/tableColumns.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L26)

Fixed pixel width for DeFiLlama-style dense tables.

***

### ExploreTableColumnId

> **ExploreTableColumnId** = `"rank"` \| `"name"` \| `"feeBadge"` \| `"holders"` \| `"ethosScore"` \| `"marketCap"` \| `"volume"` \| `"priceChange"` \| `"totalFees"` \| `"payoutTo"`

Defined in: [src/components/explore/tableColumns.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L7)

***

### ExploreTableGroup

> **ExploreTableGroup** = `object`

Defined in: [src/components/explore/tableColumns.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L34)

#### Properties

##### id

> **id**: [`ExploreTableGroupId`](#exploretablegroupid-1)

Defined in: [src/components/explore/tableColumns.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L35)

##### label

> **label**: `string`

Defined in: [src/components/explore/tableColumns.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L36)

***

### ExploreTableGroupId

> **ExploreTableGroupId** = `"identity"` \| `"market"` \| `"fees"` \| `"payout"`

Defined in: [src/components/explore/tableColumns.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L5)

***

### ExploreTableVariant

> **ExploreTableVariant** = `"creators"` \| `"content"`

Defined in: [src/components/explore/tableColumns.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L1)

## Variables

### EXPLORE\_TABLE\_GROUPS

> `const` **EXPLORE\_TABLE\_GROUPS**: readonly \[\{ `id`: `"identity"`; `label`: `"Identity"`; \}, \{ `id`: `"market"`; `label`: `"Market"`; \}, \{ `id`: `"fees"`; `label`: `"Fees"`; \}, \{ `id`: `"payout"`; `label`: `"Payout"`; \}\]

Defined in: [src/components/explore/tableColumns.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L39)

## Functions

### getExploreColumns()

> **getExploreColumns**(`opts`): [`ExploreTableColumn`](#exploretablecolumn)[]

Defined in: [src/components/explore/tableColumns.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L59)

#### Parameters

##### opts

###### collapseIdentity?

`boolean`

###### timeframe?

`string`

###### variant

[`ExploreTableVariant`](#exploretablevariant)

#### Returns

[`ExploreTableColumn`](#exploretablecolumn)[]

***

### getGridTemplateColumns()

> **getGridTemplateColumns**(`columns`): `string`

Defined in: [src/components/explore/tableColumns.ts:90](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L90)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`string`

***

### getHorizontalScrollStops()

> **getHorizontalScrollStops**(`columns`): `number`[]

Defined in: [src/components/explore/tableColumns.ts:105](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L105)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`number`[]

***

### getStickyLeftMap()

> **getStickyLeftMap**(`columns`): `Record`\<[`ExploreTableColumnId`](#exploretablecolumnid-1), `number`\>

Defined in: [src/components/explore/tableColumns.ts:94](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L94)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`Record`\<[`ExploreTableColumnId`](#exploretablecolumnid-1), `number`\>
