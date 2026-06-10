[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/tableColumns

# src/components/explore/tableColumns

## Type Aliases

### ExploreColumnAlign

> **ExploreColumnAlign** = `"left"` \| `"right"` \| `"center"`

Defined in: [src/components/explore/tableColumns.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L18)

***

### ExploreSortKey

> **ExploreSortKey** = `"volume"` \| `"marketCap"` \| `"priceChange"` \| `"new"` \| `"ethosScore"`

Defined in: [src/components/explore/tableColumns.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L3)

***

### ExploreTableColumn

> **ExploreTableColumn** = `object`

Defined in: [src/components/explore/tableColumns.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L20)

#### Properties

##### align?

> `optional` **align**: [`ExploreColumnAlign`](#explorecolumnalign)

Defined in: [src/components/explore/tableColumns.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L26)

##### group

> **group**: [`ExploreTableGroupId`](#exploretablegroupid-1)

Defined in: [src/components/explore/tableColumns.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L23)

##### id

> **id**: [`ExploreTableColumnId`](#exploretablecolumnid-1)

Defined in: [src/components/explore/tableColumns.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L21)

##### label

> **label**: `string`

Defined in: [src/components/explore/tableColumns.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L22)

##### sortKey?

> `optional` **sortKey**: [`ExploreSortKey`](#exploresortkey)

Defined in: [src/components/explore/tableColumns.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L28)

If set, clicking the header should map to this sort key.

##### sticky?

> `optional` **sticky**: `boolean`

Defined in: [src/components/explore/tableColumns.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L30)

Sticky-left column (name only).

##### widthPx

> **widthPx**: `number`

Defined in: [src/components/explore/tableColumns.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L25)

Fixed pixel width for DeFiLlama-style dense tables.

***

### ExploreTableColumnId

> **ExploreTableColumnId** = `"name"` \| `"holders"` \| `"ethosScore"` \| `"marketCap"` \| `"volume"` \| `"priceChange"` \| `"trend30d"` \| `"totalFees"` \| `"payoutTo"`

Defined in: [src/components/explore/tableColumns.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L7)

***

### ExploreTableGroup

> **ExploreTableGroup** = `object`

Defined in: [src/components/explore/tableColumns.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L33)

#### Properties

##### id

> **id**: [`ExploreTableGroupId`](#exploretablegroupid-1)

Defined in: [src/components/explore/tableColumns.ts:34](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L34)

##### label

> **label**: `string`

Defined in: [src/components/explore/tableColumns.ts:35](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L35)

***

### ExploreTableGroupId

> **ExploreTableGroupId** = `"identity"` \| `"market"` \| `"fees"` \| `"payout"`

Defined in: [src/components/explore/tableColumns.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L5)

***

### ExploreTableVariant

> **ExploreTableVariant** = `"creators"` \| `"content"`

Defined in: [src/components/explore/tableColumns.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L1)

## Variables

### EXPLORE\_COLLAPSED\_IDENTITY\_WIDTH\_PX

> `const` **EXPLORE\_COLLAPSED\_IDENTITY\_WIDTH\_PX**: `72` = `72`

Defined in: [src/components/explore/tableColumns.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L46)

Sticky identity column width when horizontal scroll collapses token labels (avatar + Ethos badge).

***

### EXPLORE\_TABLE\_GROUPS

> `const` **EXPLORE\_TABLE\_GROUPS**: readonly \[\{ `id`: `"identity"`; `label`: `"Identity"`; \}, \{ `id`: `"market"`; `label`: `"Market"`; \}, \{ `id`: `"fees"`; `label`: `"Fees"`; \}, \{ `id`: `"payout"`; `label`: `"Payout"`; \}\]

Defined in: [src/components/explore/tableColumns.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L38)

## Functions

### getExploreColumns()

> **getExploreColumns**(`opts`): [`ExploreTableColumn`](#exploretablecolumn)[]

Defined in: [src/components/explore/tableColumns.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L61)

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

Defined in: [src/components/explore/tableColumns.ts:96](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L96)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`string`

***

### getHorizontalScrollStops()

> **getHorizontalScrollStops**(`columns`): `number`[]

Defined in: [src/components/explore/tableColumns.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L111)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`number`[]

***

### getStickyLeftMap()

> **getStickyLeftMap**(`columns`): `Record`\<[`ExploreTableColumnId`](#exploretablecolumnid-1), `number`\>

Defined in: [src/components/explore/tableColumns.ts:100](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/tableColumns.ts#L100)

#### Parameters

##### columns

[`ExploreTableColumn`](#exploretablecolumn)[]

#### Returns

`Record`\<[`ExploreTableColumnId`](#exploretablecolumnid-1), `number`\>
