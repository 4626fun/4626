[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### extractMigratedCoinAddressFromLog()

> **extractMigratedCoinAddressFromLog**(`log`): `string` \| `null`

Defined in: [src/lib/zora/migrations.ts:169](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L169)

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

Defined in: [src/lib/zora/migrations.ts:273](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L273)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [src/lib/zora/migrations.ts:442](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L442)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/migrations.ts:408](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L408)

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

Defined in: [src/lib/zora/migrations.ts:417](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L417)

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

Defined in: [src/lib/zora/migrations.ts:160](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L160)

#### Parameters

##### bytecode

`string`

#### Returns

`string` \| `null`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [src/lib/zora/migrations.ts:435](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L435)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
