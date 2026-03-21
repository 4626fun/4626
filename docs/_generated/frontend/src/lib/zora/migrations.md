[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### extractMigratedCoinAddressFromLog()

> **extractMigratedCoinAddressFromLog**(`log`): `string` \| `null`

Defined in: [src/lib/zora/migrations.ts:146](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L146)

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

Defined in: [src/lib/zora/migrations.ts:227](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L227)

Fetch all migrated coin addresses from LiquidityMigrated events

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [src/lib/zora/migrations.ts:378](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L378)

Get migration stats

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/migrations.ts:344](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L344)

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

Defined in: [src/lib/zora/migrations.ts:353](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L353)

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

Defined in: [src/lib/zora/migrations.ts:137](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L137)

#### Parameters

##### bytecode

`string`

#### Returns

`string` \| `null`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [src/lib/zora/migrations.ts:371](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/zora/migrations.ts#L371)

Preload migrated coins cache
Call this early in the app lifecycle

#### Returns

`void`
