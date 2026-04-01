[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### extractMigratedCoinAddressFromLog()

> **extractMigratedCoinAddressFromLog**(`log`): `string` \| `null`

Defined in: [src/lib/zora/migrations.ts:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L176)

#### Parameters

##### log

###### address?

`string`

###### data?

`string`

#### Returns

`string` \| `null`

***

### fetchMigratedCoins()

> **fetchMigratedCoins**(): `Promise`\<`Set`\<`string`\>\>

Defined in: [src/lib/zora/migrations.ts:327](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L327)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [src/lib/zora/migrations.ts:522](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L522)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/migrations.ts:488](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L488)

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

Defined in: [src/lib/zora/migrations.ts:497](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L497)

Synchronous check using cached data only
Returns undefined if cache is not available

#### Parameters

##### coinAddress

`string`

#### Returns

`boolean` \| `undefined`

***

### parseMinimalProxyImplementation()

> **parseMinimalProxyImplementation**(`bytecode`): `string` \| `null`

Defined in: [src/lib/zora/migrations.ts:167](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L167)

#### Parameters

##### bytecode

`string`

#### Returns

`string` \| `null`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [src/lib/zora/migrations.ts:515](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L515)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
