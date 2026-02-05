[**creatorvault-miniapp**](../../../index.md)

***

[creatorvault-miniapp](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### fetchMigratedCoins()

> **fetchMigratedCoins**(): `Promise`\<`Set`\<`string`\>\>

Defined in: [lib/zora/migrations.ts:125](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/migrations.ts#L125)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [lib/zora/migrations.ts:249](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/migrations.ts#L249)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [lib/zora/migrations.ts:215](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/migrations.ts#L215)

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

Defined in: [lib/zora/migrations.ts:224](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/migrations.ts#L224)

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

Defined in: [lib/zora/migrations.ts:242](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/zora/migrations.ts#L242)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
