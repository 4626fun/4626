[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/lottery/\_amoePublishCron

# api/\_handlers/v1/lottery/\_amoePublishCron

## Interfaces

### AmoePublishCronHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:75](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L75)

Test seam — inject the four collaborators so the integration test can
drive the cron without snarkjs / RPC.

#### Properties

##### broadcast?

> `optional` **broadcast**: [`BroadcastSetPointsLedgerRoot`](../../../../server/_lib/lottery/amoeLedgerPublisher.md#broadcastsetpointsledgerroot)

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:77](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L77)

##### confirm?

> `optional` **confirm**: [`ConfirmTransactionReceipt`](../../../../server/_lib/lottery/amoeLedgerPublisher.md#confirmtransactionreceipt)

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:78](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L78)

##### db?

> `optional` **db**: [`AmoePublisherDb`](../../../../server/_lib/lottery/amoeLedgerPublisher.md#amoepublisherdb)

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L76)

##### lookupBurnContext?

> `optional` **lookupBurnContext**: [`LookupBurnContext`](../../../../server/_lib/lottery/amoeLedgerPublisher.md#lookupburncontext)

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:79](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L79)

##### nowSec?

> `optional` **nowSec**: `bigint`

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:83](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L83)

Override the now-source for epoch computation.

##### publisherVersion?

> `optional` **publisherVersion**: `string`

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L81)

Override the publisher version (production reads from process.env).

## Functions

### \_\_resetAmoePublishCronHandlerHooksForTest()

> **\_\_resetAmoePublishCronHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:94](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L94)

#### Returns

`void`

***

### \_\_setAmoePublishCronHandlerHooksForTest()

> **\_\_setAmoePublishCronHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:88](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L88)

#### Parameters

##### hooks

[`AmoePublishCronHandlerHooks`](#amoepublishcronhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/v1/lottery/\_amoePublishCron.ts:111](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoePublishCron.ts#L111)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse`\>
