[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/zora-csw/scanCreations

# server/\_lib/zora-csw/scanCreations

## Type Aliases

### CswCreation

> **CswCreation** = `object`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L71)

#### Properties

##### baseOwner

> **baseOwner**: `Address`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:73](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L73)

##### blockNumber

> **blockNumber**: `bigint`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:76](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L76)

##### cswAddress

> **cswAddress**: `Address`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L72)

##### initialOwners

> **initialOwners**: `Address`[]

Defined in: [server/\_lib/zora-csw/scanCreations.ts:74](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L74)

##### logIndex

> **logIndex**: `number`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L78)

##### nonce

> **nonce**: `bigint`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:75](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L75)

##### txHash

> **txHash**: `Hex`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:77](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L77)

## Variables

### DEFAULT\_GETLOGS\_WINDOW

> `const` **DEFAULT\_GETLOGS\_WINDOW**: `10000n` = `10_000n`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L45)

Default per-tick window cap if `INDEXER_GETLOGS_WINDOW` is unset.

***

### SAFETY\_CONFIRMATIONS

> `const` **SAFETY\_CONFIRMATIONS**: `12n` = `12n`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L42)

Block confirmations required before a log is considered safe to
persist. Base produces ~2s blocks and finality (post-Bedrock) is
effectively reached well before 12 confs, but we keep a buffer to
absorb minor reorgs around L1 batch posting without re-indexing.

***

### ZORA\_ACCOUNT\_MANAGER\_ADDRESS

> `const` **ZORA\_ACCOUNT\_MANAGER\_ADDRESS**: `Address` = `'0x0Ba958A449701907302e28F5955fa9d16dDC45c3'`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L33)

Zora's account-manager proxy on Base mainnet — same address used by
`indexer/src/constants.ts`. Re-declared here so the frontend has no
runtime dep on the indexer/ workspace.

## Functions

### fetchCreationsWindow()

> **fetchCreationsWindow**(`client`, `fromBlock`, `toBlock`): `Promise`\<[`CswCreation`](#cswcreation)[]\>

Defined in: [server/\_lib/zora-csw/scanCreations.ts:127](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L127)

Fetch a single block window and decode the events. Failures bubble
up — the caller (cron handler) catches them and surfaces as a
`tick: 'errored'` so the schedule keeps ticking.

#### Parameters

##### client

##### fromBlock

`bigint`

##### toBlock

`bigint`

#### Returns

`Promise`\<[`CswCreation`](#cswcreation)[]\>

***

### planScanWindow()

> **planScanWindow**(`args`): \{ `fromBlock`: `bigint`; `toBlock`: `bigint`; \} \| `null`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:187](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L187)

Compute the [fromBlock, toBlock] pair for a single scan tick.

- `tipBlock` is the current chain head.
- `lastScannedBlock` is the high-water mark from the state row.

`toBlock = tipBlock - SAFETY_CONFIRMATIONS` so we only persist
blocks that are unlikely to reorg. `fromBlock = lastScannedBlock + 1`,
capped to `fromBlock + windowSize - 1` so we never ask the bundler/
RPC for more than the configured window.

Returns `null` if there's no work — either we're already caught up
to the safety horizon, or the chain hasn't advanced past the
checkpoint.

#### Parameters

##### args

###### lastScannedBlock

`bigint`

###### safetyConfirmations?

`bigint`

###### tipBlock

`bigint`

###### windowSize

`bigint`

#### Returns

\{ `fromBlock`: `bigint`; `toBlock`: `bigint`; \} \| `null`

***

### readGetLogsWindow()

> **readGetLogsWindow**(): `bigint`

Defined in: [server/\_lib/zora-csw/scanCreations.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/zora-csw/scanCreations.ts#L106)

#### Returns

`bigint`
