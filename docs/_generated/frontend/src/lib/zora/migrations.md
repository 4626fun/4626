[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/migrations

# src/lib/zora/migrations

## Functions

### fetchMigratedCoins()

> **fetchMigratedCoins**(): `Promise`\<`Set`\<`string`\>\>

Defined in: [src/lib/zora/migrations.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrations.ts#L154)

#### Returns

`Promise`\<`Set`\<`string`\>\>

***

### getMigrationStats()

> **getMigrationStats**(): `Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

Defined in: [src/lib/zora/migrations.ts:216](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrations.ts#L216)

#### Returns

`Promise`\<\{ `count`: `number`; `lastUpdated`: `number`; \}\>

***

### hasCoinMigrated()

> **hasCoinMigrated**(`coinAddress`): `Promise`\<`boolean`\>

Defined in: [src/lib/zora/migrations.ts:194](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrations.ts#L194)

#### Parameters

##### coinAddress

`string`

#### Returns

`Promise`\<`boolean`\>

***

### hasCoinMigratedSync()

> **hasCoinMigratedSync**(`coinAddress`): `boolean` \| `undefined`

Defined in: [src/lib/zora/migrations.ts:199](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrations.ts#L199)

#### Parameters

##### coinAddress

`string`

#### Returns

`boolean` \| `undefined`

***

### preloadMigratedCoins()

> **preloadMigratedCoins**(): `void`

Defined in: [src/lib/zora/migrations.ts:212](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrations.ts#L212)

#### Returns

`void`

## References

### extractMigratedCoinAddressFromLog

Re-exports [extractMigratedCoinAddressFromLog](migrationScan.md#extractmigratedcoinaddressfromlog)

***

### LIQUIDITY\_MIGRATED\_TOPIC

Re-exports [LIQUIDITY_MIGRATED_TOPIC](migrationScan.md#liquidity_migrated_topic)

***

### MigratedCoinScanClient

Re-exports [MigratedCoinScanClient](migrationScan.md#migratedcoinscanclient)

***

### parseMinimalProxyImplementation

Re-exports [parseMinimalProxyImplementation](migrationScan.md#parseminimalproxyimplementation)

***

### ScanMigratedCoinsOptions

Re-exports [ScanMigratedCoinsOptions](migrationScan.md#scanmigratedcoinsoptions)

***

### scanMigratedCoinsWithClient

Re-exports [scanMigratedCoinsWithClient](migrationScan.md#scanmigratedcoinswithclient)

***

### V4\_LAUNCH\_BLOCK

Re-exports [V4_LAUNCH_BLOCK](migrationScan.md#v4_launch_block)
