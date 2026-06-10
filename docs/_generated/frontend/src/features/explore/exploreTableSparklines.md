[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/exploreTableSparklines

# src/features/explore/exploreTableSparklines

## Type Aliases

### ExploreTableSparkline

> **ExploreTableSparkline** = `object`

Defined in: [src/features/explore/exploreTableSparklines.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L5)

#### Properties

##### changePercent

> **changePercent**: `number` \| `null`

Defined in: [src/features/explore/exploreTableSparklines.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L7)

##### values

> **values**: `number`[]

Defined in: [src/features/explore/exploreTableSparklines.ts:6](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L6)

***

### ExploreTableSparklinesResponse

> **ExploreTableSparklinesResponse** = `object`

Defined in: [src/features/explore/exploreTableSparklines.ts:10](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L10)

#### Properties

##### sparklines

> **sparklines**: `Record`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:11](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L11)

## Functions

### fetchExploreTableSparklines()

> **fetchExploreTableSparklines**(`coinAddresses`): `Promise`\<`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>\>

Defined in: [src/features/explore/exploreTableSparklines.ts:126](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L126)

#### Parameters

##### coinAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>\>

***

### mergeExploreTableSparklineMaps()

> **mergeExploreTableSparklineMaps**(...`sources`): `Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L112)

#### Parameters

##### sources

...readonly (`ReadonlyMap`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\> \| `undefined`)[]

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### readPersistedExploreTableSparklines()

> **readPersistedExploreTableSparklines**(): `Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L58)

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### resolveExploreRowTrend30d()

> **resolveExploreRowTrend30d**(`coin`, `sparklines`): [`ExploreTableSparkline`](#exploretablesparkline) \| `null`

Defined in: [src/features/explore/exploreTableSparklines.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L31)

#### Parameters

##### coin

`Pick`\<[`ZoraCoin`](../../lib/zora/types.md#zoracoin), `"address"` \| `"trend30d"`\> | `null` | `undefined`

##### sparklines

`ReadonlyMap`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

#### Returns

[`ExploreTableSparkline`](#exploretablesparkline) \| `null`

***

### seedSparklinesFromCoins()

> **seedSparklinesFromCoins**(`coins`): `Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L45)

#### Parameters

##### coins

readonly `Pick`\<[`ZoraCoin`](../../lib/zora/types.md#zoracoin), `"address"` \| `"trend30d"`\>[]

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### writePersistedExploreTableSparklines()

> **writePersistedExploreTableSparklines**(`entries`): `void`

Defined in: [src/features/explore/exploreTableSparklines.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/exploreTableSparklines.ts#L83)

#### Parameters

##### entries

`ReadonlyMap`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

#### Returns

`void`
