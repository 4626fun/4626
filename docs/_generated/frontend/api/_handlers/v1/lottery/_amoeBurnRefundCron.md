[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeBurnRefundCron

# api/\_handlers/v1/lottery/\_amoeBurnRefundCron

## Interfaces

### AmoeBurnRefundCronHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:70](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L70)

Test seam — inject the db and the runner so handler tests can drive
the cron without touching the real Postgres pool. `runTick` lets a
test stub the entire compose-and-iterate behaviour without
reconstructing the helper's internal SQL.

#### Properties

##### ageSec?

> `optional` **ageSec**: `number`

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L76)

##### db?

> `optional` **db**: [`AmoeBurnRefundDb`](../../../../server/_lib/lottery/amoeBurnRefund.md#amoeburnrefunddb)

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:71](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L71)

##### limit?

> `optional` **limit**: `number`

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:77](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L77)

##### runTick()?

> `optional` **runTick**: (`db`, `args`) => `Promise`\<[`RefundTickResult`](../../../../server/_lib/lottery/amoeBurnRefund.md#refundtickresult)\>

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:72](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L72)

###### Parameters

###### db

[`AmoeBurnRefundDb`](../../../../server/_lib/lottery/amoeBurnRefund.md#amoeburnrefunddb)

###### args

###### ageSec

`number`

###### limit

`number`

###### Returns

`Promise`\<[`RefundTickResult`](../../../../server/_lib/lottery/amoeBurnRefund.md#refundtickresult)\>

## Functions

### \_\_resetAmoeBurnRefundCronHandlerHooksForTest()

> **\_\_resetAmoeBurnRefundCronHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:88](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L88)

#### Returns

`void`

***

### \_\_setAmoeBurnRefundCronHandlerHooksForTest()

> **\_\_setAmoeBurnRefundCronHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:82](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L82)

#### Parameters

##### hooks

[`AmoeBurnRefundCronHandlerHooks`](#amoeburnrefundcronhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeBurnRefundCron.ts:92](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeBurnRefundCron.ts#L92)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse`\>
