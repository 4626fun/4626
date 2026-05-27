[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/exploreTableSparklines

# src/features/explore/exploreTableSparklines

## Type Aliases

### ExploreTableSparkline

> **ExploreTableSparkline** = `object`

Defined in: [src/features/explore/exploreTableSparklines.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L5)

#### Properties

##### changePercent

> **changePercent**: `number` \| `null`

Defined in: [src/features/explore/exploreTableSparklines.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L7)

##### values

> **values**: `number`[]

Defined in: [src/features/explore/exploreTableSparklines.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L6)

***

### ExploreTableSparklinesResponse

> **ExploreTableSparklinesResponse** = `object`

Defined in: [src/features/explore/exploreTableSparklines.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L10)

#### Properties

##### sparklines

> **sparklines**: `Record`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L11)

## Functions

### fetchExploreTableSparklines()

> **fetchExploreTableSparklines**(`coinAddresses`): `Promise`\<`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>\>

Defined in: [src/features/explore/exploreTableSparklines.ts:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L124)

#### Parameters

##### coinAddresses

`string`[]

#### Returns

`Promise`\<`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>\>

***

### mergeExploreTableSparklineMaps()

> **mergeExploreTableSparklineMaps**(...`sources`): `Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L110)

#### Parameters

##### sources

...readonly (`ReadonlyMap`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\> \| `undefined`)[]

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### readPersistedExploreTableSparklines()

> **readPersistedExploreTableSparklines**(): `Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

Defined in: [src/features/explore/exploreTableSparklines.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L56)

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### resolveExploreRowTrend30d()

> **resolveExploreRowTrend30d**(`coin`, `sparklines`): [`ExploreTableSparkline`](#exploretablesparkline) \| `null`

Defined in: [src/features/explore/exploreTableSparklines.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L22)

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

Defined in: [src/features/explore/exploreTableSparklines.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L41)

#### Parameters

##### coins

readonly `Pick`\<[`ZoraCoin`](../../lib/zora/types.md#zoracoin), `"address"` \| `"trend30d"`\>[]

#### Returns

`Map`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

***

### writePersistedExploreTableSparklines()

> **writePersistedExploreTableSparklines**(`entries`): `void`

Defined in: [src/features/explore/exploreTableSparklines.ts:81](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/explore/exploreTableSparklines.ts#L81)

#### Parameters

##### entries

`ReadonlyMap`\<`string`, [`ExploreTableSparkline`](#exploretablesparkline)\>

#### Returns

`void`
