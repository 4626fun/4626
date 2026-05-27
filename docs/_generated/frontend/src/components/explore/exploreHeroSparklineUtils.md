[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/components/explore/exploreHeroSparklineUtils

# src/components/explore/exploreHeroSparklineUtils

## Type Aliases

### ExploreHeroSparklinePoint

> **ExploreHeroSparklinePoint** = `object`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L1)

#### Properties

##### creatorCoinsMarketCapUsd

> **creatorCoinsMarketCapUsd**: `number` \| `null`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:2](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L2)

***

### SparklineLayoutPoint

> **SparklineLayoutPoint** = `object`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L5)

#### Properties

##### x

> **x**: `number`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L6)

##### y

> **y**: `number`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L7)

## Functions

### buildSparklineLayout()

> **buildSparklineLayout**(`values`, `width`, `height`, `padding`): [`SparklineLayoutPoint`](#sparklinelayoutpoint)[]

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L18)

#### Parameters

##### values

readonly `number`[]

##### width

`number`

##### height

`number`

##### padding

`number` = `2`

#### Returns

[`SparklineLayoutPoint`](#sparklinelayoutpoint)[]

***

### extractIndexedMcapSparklineValues()

> **extractIndexedMcapSparklineValues**(`history`): `number`[]

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L10)

#### Parameters

##### history

readonly [`ExploreHeroSparklinePoint`](#exploreherosparklinepoint)[]

#### Returns

`number`[]

***

### layoutToAreaPath()

> **layoutToAreaPath**(`points`, `width`, `height`, `padding`): `string` \| `null`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L46)

#### Parameters

##### points

readonly [`SparklineLayoutPoint`](#sparklinelayoutpoint)[]

##### width

`number`

##### height

`number`

##### padding

`number` = `2`

#### Returns

`string` \| `null`

***

### layoutToPolyline()

> **layoutToPolyline**(`points`): `string`

Defined in: [src/components/explore/exploreHeroSparklineUtils.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/components/explore/exploreHeroSparklineUtils.ts#L42)

#### Parameters

##### points

readonly [`SparklineLayoutPoint`](#sparklinelayoutpoint)[]

#### Returns

`string`
