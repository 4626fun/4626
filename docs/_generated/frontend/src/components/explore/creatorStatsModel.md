[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/creatorStatsModel

# src/components/explore/creatorStatsModel

## Type Aliases

### BuildCreatorStatsInput

> **BuildCreatorStatsInput** = `object`

Defined in: [src/components/explore/creatorStatsModel.ts:22](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L22)

#### Properties

##### coinsCreated

> **coinsCreated**: `number`

Defined in: [src/components/explore/creatorStatsModel.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L30)

##### createdAt?

> `optional` **createdAt**: `string` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L31)

##### ethosAccentClass

> **ethosAccentClass**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:29](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L29)

##### ethosFooter?

> `optional` **ethosFooter**: `ReactNode`

Defined in: [src/components/explore/creatorStatsModel.ts:33](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L33)

##### ethosHasPositiveScore

> **ethosHasPositiveScore**: `boolean`

Defined in: [src/components/explore/creatorStatsModel.ts:28](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L28)

##### ethosScore?

> `optional` **ethosScore**: `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:27](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L27)

##### marketCap?

> `optional` **marketCap**: `string` \| `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L25)

##### totalVolume?

> `optional` **totalVolume**: `string` \| `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L24)

##### uniqueHolders?

> `optional` **uniqueHolders**: `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L26)

##### volume24h?

> `optional` **volume24h**: `string` \| `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L23)

##### volumeWindow

> **volumeWindow**: [`VolumeWindow`](#volumewindow-1)

Defined in: [src/components/explore/creatorStatsModel.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L32)

***

### CreatorStatItem

> **CreatorStatItem** = `object`

Defined in: [src/components/explore/creatorStatsModel.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L7)

#### Properties

##### display

> **display**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L12)

##### footer?

> `optional` **footer**: `ReactNode`

Defined in: [src/components/explore/creatorStatsModel.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L15)

##### id

> **id**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L8)

##### kind

> **kind**: [`CreatorStatKind`](#creatorstatkind)

Defined in: [src/components/explore/creatorStatsModel.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L10)

##### label

> **label**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L9)

##### raw?

> `optional` **raw**: `number` \| `null`

Defined in: [src/components/explore/creatorStatsModel.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L11)

##### toggleable?

> `optional` **toggleable**: `boolean`

Defined in: [src/components/explore/creatorStatsModel.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L17)

When true, label is clickable (volume window toggle).

##### toneClass

> **toneClass**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L13)

##### valueClassName?

> `optional` **valueClassName**: `string`

Defined in: [src/components/explore/creatorStatsModel.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L14)

***

### CreatorStatKind

> **CreatorStatKind** = `"currency"` \| `"integer"` \| `"date"` \| `"text"`

Defined in: [src/components/explore/creatorStatsModel.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L5)

***

### VolumeWindow

> **VolumeWindow** = `"24h"` \| `"all"`

Defined in: [src/components/explore/creatorStatsModel.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L20)

## Functions

### buildCreatorStats()

> **buildCreatorStats**(`input`): [`CreatorStatItem`](#creatorstatitem)[]

Defined in: [src/components/explore/creatorStatsModel.ts:110](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L110)

#### Parameters

##### input

[`BuildCreatorStatsInput`](#buildcreatorstatsinput)

#### Returns

[`CreatorStatItem`](#creatorstatitem)[]

***

### formatAnimatedStatValue()

> **formatAnimatedStatValue**(`kind`, `value`): `string`

Defined in: [src/components/explore/creatorStatsModel.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L52)

Format a partial numeric value during GSAP tween.

#### Parameters

##### kind

[`CreatorStatKind`](#creatorstatkind)

##### value

`number`

#### Returns

`string`

***

### getDiceRollStatDisplay()

> **getDiceRollStatDisplay**(`stat`, `focus`, `statIndex`): `string`

Defined in: [src/components/explore/creatorStatsModel.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L69)

Scroll-scrubbed odometer: flickering pseudo-random values during enter, then ease to target.
Deterministic from focus + stat index so scrub stays in sync.

#### Parameters

##### stat

`Pick`\<[`CreatorStatItem`](#creatorstatitem), `"kind"` \| `"raw"` \| `"display"`\>

##### focus

`number`

##### statIndex

`number`

#### Returns

`string`

***

### toStatsRailItems()

> **toStatsRailItems**(`stats`): `object`[]

Defined in: [src/components/explore/creatorStatsModel.ts:173](https://github.com/wenakita/4626/blob/main/frontend/src/components/explore/creatorStatsModel.ts#L173)

Rail-friendly shape (value + label) derived from CreatorStatItem.

#### Parameters

##### stats

[`CreatorStatItem`](#creatorstatitem)[]

#### Returns

`object`[]
