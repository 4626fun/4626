[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeRetryZk

# api/\_handlers/v1/lottery/\_amoeRetryZk

## Interfaces

### AmoeRetryZkHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:66](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L66)

Test seam — pluggable relay for the integration tests.

#### Properties

##### relay?

> `optional` **relay**: [`RetrySubmissionRelay`](../../../../server/_lib/lottery/amoeReplayRetry.md#retrysubmissionrelay)

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:67](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L67)

## Functions

### \_\_resetAmoeRetryZkHandlerHooksForTest()

> **\_\_resetAmoeRetryZkHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:76](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L76)

#### Returns

`void`

***

### \_\_setAmoeRetryZkHandlerHooksForTest()

> **\_\_setAmoeRetryZkHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:72](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L72)

#### Parameters

##### hooks

[`AmoeRetryZkHandlerHooks`](#amoeretryzkhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryZk.ts:80](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/v1/lottery/_amoeRetryZk.ts#L80)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>
