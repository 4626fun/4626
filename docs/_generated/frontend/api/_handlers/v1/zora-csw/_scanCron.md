[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/zora-csw/\_scanCron

# api/\_handlers/v1/zora-csw/\_scanCron

## Interfaces

### ZoraCswScanCronHandlerHooks

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:62](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L62)

Test seam — inject collaborators so handler tests can drive the cron
without a real RPC client or Supabase.

#### Properties

##### db?

> `optional` **db**: `SupabaseClient`\<`any`, `"public"`, `"public"`, `any`, `any`\>

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:63](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L63)

##### fetchWindow()?

> `optional` **fetchWindow**: (`fromBlock`, `toBlock`) => `Promise`\<[`CswCreation`](../../../../server/_lib/zora-csw/scanCreations.md#cswcreation)[]\>

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L67)

Fetches creations for a single window.

###### Parameters

###### fromBlock

`bigint`

###### toBlock

`bigint`

###### Returns

`Promise`\<[`CswCreation`](../../../../server/_lib/zora-csw/scanCreations.md#cswcreation)[]\>

##### getTipBlock()?

> `optional` **getTipBlock**: () => `Promise`\<`bigint`\>

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:65](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L65)

Returns the chain tip block.

###### Returns

`Promise`\<`bigint`\>

## Functions

### \_\_resetZoraCswScanCronHandlerHooksForTest()

> **\_\_resetZoraCswScanCronHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L78)

#### Returns

`void`

***

### \_\_setZoraCswScanCronHandlerHooksForTest()

> **\_\_setZoraCswScanCronHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:72](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L72)

#### Parameters

##### hooks

[`ZoraCswScanCronHandlerHooks`](#zoracswscancronhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`void`\>

Defined in: [api/\_handlers/v1/zora-csw/\_scanCron.ts:185](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/zora-csw/_scanCron.ts#L185)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`void`\>
