[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### fetchMigratedCoins()

> **fetchMigratedCoins**(): `Promise`\<`Set`\<`string`\>\>

Defined in: [lib/zora/migrations.ts:73](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/migrations.ts#L73)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [lib/zora/migrations.ts:178](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/migrations.ts#L178)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [lib/zora/migrations.ts:144](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/migrations.ts#L144)

Check if a specific coin has migrated to V4

#### Parameters

##### coinAddress

`string`

The coin contract address

#### Returns

`Promise`\<`boolean`\>

true if the coin has migrated, false otherwise

***

### hasCoinMigratedSync()

> **hasCoinMigratedSync**(`coinAddress`): `boolean` \| `undefined`

Defined in: [lib/zora/migrations.ts:153](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/migrations.ts#L153)

Synchronous check using cached data only
Returns undefined if cache is not available

#### Parameters

##### coinAddress

`string`

#### Returns

`boolean` \| `undefined`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [lib/zora/migrations.ts:171](https://github.com/wenakita/4626/blob/d2887a577bbbcd8195e2d76fc50368643edd1f1a/frontend/src/lib/zora/migrations.ts#L171)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
