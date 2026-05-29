[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/explore/useExploreTableSparklines

# src/features/explore/useExploreTableSparklines

## Functions

### useExploreTableSparklines()

> **useExploreTableSparklines**(`coinAddresses`, `seedCoins`): `object`

Defined in: [src/features/explore/useExploreTableSparklines.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/features/explore/useExploreTableSparklines.ts#L24)

#### Parameters

##### coinAddresses

readonly (`string` \| `null` \| `undefined`)[]

##### seedCoins

readonly `Pick`\<[`ZoraCoin`](../../lib/zora/types.md#zoracoin), `"address"` \| `"trend30d"`\>[] = `[]`

#### Returns

`object`

##### isFetching

> **isFetching**: `boolean` = `query.isFetching`

##### isLoading

> **isLoading**: `boolean`

##### sparklines

> **sparklines**: `Map`\<`string`, [`ExploreTableSparkline`](exploreTableSparklines.md#exploretablesparkline)\>
