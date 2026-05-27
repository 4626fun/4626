[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/zora/migrationScan

# src/lib/zora/migrationScan

## Type Aliases

### MigratedCoinScanClient

> **MigratedCoinScanClient** = `object`

Defined in: [src/lib/zora/migrationScan.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L19)

#### Methods

##### getBlockNumber()

> **getBlockNumber**(): `Promise`\<`bigint`\>

Defined in: [src/lib/zora/migrationScan.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L20)

###### Returns

`Promise`\<`bigint`\>

##### request()

> **request**(`args`): `Promise`\<`unknown`\>

Defined in: [src/lib/zora/migrationScan.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L21)

###### Parameters

###### args

###### method

`string`

###### params?

`unknown`

###### Returns

`Promise`\<`unknown`\>

***

### ScanMigratedCoinsOptions

> **ScanMigratedCoinsOptions** = `object`

Defined in: [src/lib/zora/migrationScan.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L24)

#### Properties

##### allowedImplementations?

> `optional` **allowedImplementations**: `Set`\<`string`\>

Defined in: [src/lib/zora/migrationScan.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L29)

##### fromBlock?

> `optional` **fromBlock**: `bigint`

Defined in: [src/lib/zora/migrationScan.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L25)

##### initialChunkDelta?

> `optional` **initialChunkDelta**: `bigint`

Defined in: [src/lib/zora/migrationScan.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L27)

##### topic?

> `optional` **topic**: `string`

Defined in: [src/lib/zora/migrationScan.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L26)

##### trustCheckConcurrency?

> `optional` **trustCheckConcurrency**: `number`

Defined in: [src/lib/zora/migrationScan.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L30)

##### verifyImplementation?

> `optional` **verifyImplementation**: `boolean`

Defined in: [src/lib/zora/migrationScan.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L28)

## Variables

### DEFAULT\_ZORA\_COIN\_IMPLEMENTATION\_ALLOWLIST

> `const` **DEFAULT\_ZORA\_COIN\_IMPLEMENTATION\_ALLOWLIST**: readonly \[`"0x88cc4e08c7608723f3e44e17ac669fb43b6a8313"`, `"0xca72309aaf706d290e08608b1af47943902f69b2"`\]

Defined in: [src/lib/zora/migrationScan.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L8)

***

### LIQUIDITY\_MIGRATED\_TOPIC

> `const` **LIQUIDITY\_MIGRATED\_TOPIC**: `"0x907fbdc07b1c9a591dc1287635b072fa848f4da7c86645dfc9b8bfb3b94f82ab"` = `'0x907fbdc07b1c9a591dc1287635b072fa848f4da7c86645dfc9b8bfb3b94f82ab'`

Defined in: [src/lib/zora/migrationScan.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L3)

***

### V4\_LAUNCH\_BLOCK

> `const` **V4\_LAUNCH\_BLOCK**: `31250000n` = `31250000n`

Defined in: [src/lib/zora/migrationScan.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L13)

## Functions

### extractMigratedCoinAddressFromLog()

> **extractMigratedCoinAddressFromLog**(`log`): `string` \| `null`

Defined in: [src/lib/zora/migrationScan.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L60)

#### Parameters

##### log

###### address?

`string`

###### data?

`string`

#### Returns

`string` \| `null`

***

### isPrunedHistoryError()

> **isPrunedHistoryError**(`error`): `boolean`

Defined in: [src/lib/zora/migrationScan.ts:220](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L220)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### parseAddressAllowlist()

> **parseAddressAllowlist**(`raw`, `fallback`): `Set`\<`string`\>

Defined in: [src/lib/zora/migrationScan.ts:37](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L37)

#### Parameters

##### raw

`string` | `undefined`

##### fallback

readonly `string`[]

#### Returns

`Set`\<`string`\>

***

### parseMinimalProxyImplementation()

> **parseMinimalProxyImplementation**(`bytecode`): `string` \| `null`

Defined in: [src/lib/zora/migrationScan.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L51)

#### Parameters

##### bytecode

`string`

#### Returns

`string` \| `null`

***

### scanMigratedCoinsWithClient()

> **scanMigratedCoinsWithClient**(`client`, `options`): `Promise`\<`Set`\<`string`\>\>

Defined in: [src/lib/zora/migrationScan.ts:225](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/zora/migrationScan.ts#L225)

#### Parameters

##### client

[`MigratedCoinScanClient`](#migratedcoinscanclient)

##### options

[`ScanMigratedCoinsOptions`](#scanmigratedcoinsoptions) = `{}`

#### Returns

`Promise`\<`Set`\<`string`\>\>
