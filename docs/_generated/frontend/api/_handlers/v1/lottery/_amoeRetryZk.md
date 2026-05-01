[**4626-app**](../../../../index.md)

***

[4626-app](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeRetryZk

# api/\_handlers/v1/lottery/\_amoeRetryZk

## Interfaces

### AmoeRetryZkHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L67)

Test seam — pluggable relay for the integration tests.

#### Properties

##### relay?

> `optional` **relay**: [`RetrySubmissionRelay`](../../../../server/_lib/lottery/amoeReplayRetry.md#retrysubmissionrelay)

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:68](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L68)

## Functions

### \_\_resetAmoeRetryZkHandlerHooksForTest()

> **\_\_resetAmoeRetryZkHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:77](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L77)

#### Returns

`void`

***

### \_\_setAmoeRetryZkHandlerHooksForTest()

> **\_\_setAmoeRetryZkHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:73](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L73)

#### Parameters

##### hooks

[`AmoeRetryZkHandlerHooks`](#amoeretryzkhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:81](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L81)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
