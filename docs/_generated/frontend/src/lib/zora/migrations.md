[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### extractMigratedCoinAddressFromLog()

> **extractMigratedCoinAddressFromLog**(`log`): `string` \| `null`

Defined in: [src/lib/zora/migrations.ts:171](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L171)

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

Defined in: [src/lib/zora/migrations.ts:322](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L322)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [src/lib/zora/migrations.ts:517](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L517)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/migrations.ts:483](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L483)

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

Defined in: [src/lib/zora/migrations.ts:492](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L492)

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

Defined in: [src/lib/zora/migrations.ts:162](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L162)

#### Parameters

##### bytecode

`string`

#### Returns

`string` \| `null`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [src/lib/zora/migrations.ts:510](https://github.com/wenakita/4626/blob/main/frontend/src/lib/zora/migrations.ts#L510)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
