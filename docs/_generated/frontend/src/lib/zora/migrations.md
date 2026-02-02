[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### fetchMigratedCoins()

> **fetchMigratedCoins**(): `Promise`\<`Set`\<`string`\>\>

Defined in: [lib/zora/migrations.ts:105](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/migrations.ts#L105)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [lib/zora/migrations.ts:229](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/migrations.ts#L229)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [lib/zora/migrations.ts:195](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/migrations.ts#L195)

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

Defined in: [lib/zora/migrations.ts:204](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/migrations.ts#L204)

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

Defined in: [lib/zora/migrations.ts:222](https://github.com/wenakita/4626/blob/fd199051169d23a9cf1f9ac62fff0899dc5c1eb1/frontend/src/lib/zora/migrations.ts#L222)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
