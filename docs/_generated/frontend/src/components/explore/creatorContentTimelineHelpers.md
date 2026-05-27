[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/creatorContentTimelineHelpers

# src/components/explore/creatorContentTimelineHelpers

## Type Aliases

### TimelineDateParts

> **TimelineDateParts** = `object`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L3)

#### Properties

##### full

> **full**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:4](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L4)

##### monthDay

> **monthDay**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L6)

##### relative

> **relative**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L8)

##### timestamp

> **timestamp**: `number` \| `null`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L9)

##### weekday

> **weekday**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L5)

##### year

> **year**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L7)

***

### TimelineEntry

> **TimelineEntry** = `object`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L17)

#### Properties

##### coin

> **coin**: [`ZoraCoin`](../../lib/zora/types.md#zoracoin)

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L18)

##### date

> **date**: [`TimelineDateParts`](#timelinedateparts)

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L21)

##### side

> **side**: `"left"` \| `"right"`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L19)

##### year

> **year**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L20)

***

### TimelineYearGroup

> **TimelineYearGroup** = `object`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L12)

#### Properties

##### items

> **items**: [`ZoraCoin`](../../lib/zora/types.md#zoracoin)[]

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L14)

##### year

> **year**: `string`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L13)

## Functions

### buildTimelineEntries()

> **buildTimelineEntries**(`coins`): [`TimelineEntry`](#timelineentry)[]

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L89)

#### Parameters

##### coins

[`ZoraCoin`](../../lib/zora/types.md#zoracoin)[]

#### Returns

[`TimelineEntry`](#timelineentry)[]

***

### formatTimelineDateParts()

> **formatTimelineDateParts**(`value?`): [`TimelineDateParts`](#timelinedateparts)

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L33)

#### Parameters

##### value?

`string` | `null`

#### Returns

[`TimelineDateParts`](#timelinedateparts)

***

### groupTimelineCoinsByYear()

> **groupTimelineCoinsByYear**(`coins`): [`TimelineYearGroup`](#timelineyeargroup)[]

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:69](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L69)

#### Parameters

##### coins

[`ZoraCoin`](../../lib/zora/types.md#zoracoin)[]

#### Returns

[`TimelineYearGroup`](#timelineyeargroup)[]

***

### resolveTimelineSide()

> **resolveTimelineSide**(`globalIndex`): `"left"` \| `"right"`

Defined in: [src/components/explore/creatorContentTimelineHelpers.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/creatorContentTimelineHelpers.ts#L85)

#### Parameters

##### globalIndex

`number`

#### Returns

`"left"` \| `"right"`
