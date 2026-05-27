[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / api/\_handlers/v1/lottery/\_amoeRetryCron

# api/\_handlers/v1/lottery/\_amoeRetryCron

## Interfaces

### AmoeRetryCronHandlerHooks

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L43)

Test seam \u2014 inject a relay so the integration test can drive the
cron without snarkjs / RPC.

#### Properties

##### pickRows()?

> `optional` **pickRows**: (`limit`) => `Promise`\<[`AmoeSubmissionRow`](../../../../server/_lib/lottery/amoeReplayStore.md#amoesubmissionrow)[]\>

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L46)

Override the row picker (tests use this to bypass the DB).

###### Parameters

###### limit

`number`

###### Returns

`Promise`\<[`AmoeSubmissionRow`](../../../../server/_lib/lottery/amoeReplayStore.md#amoesubmissionrow)[]\>

##### relay?

> `optional` **relay**: [`RetrySubmissionRelay`](../../../../server/_lib/lottery/amoeReplayRetry.md#retrysubmissionrelay)

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L44)

##### retryOne()?

> `optional` **retryOne**: (`id`, `params`) => `Promise`\<[`RetrySubmissionOutcome`](../../../../server/_lib/lottery/amoeReplayRetry.md#retrysubmissionoutcome)\>

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:48](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L48)

Override `retrySubmissionByIdAsCron` for tests.

###### Parameters

###### id

`string`

###### params

[`CronRetrySubmissionParams`](../../../../server/_lib/lottery/amoeReplayRetry.md#cronretrysubmissionparams)

###### Returns

`Promise`\<[`RetrySubmissionOutcome`](../../../../server/_lib/lottery/amoeReplayRetry.md#retrysubmissionoutcome)\>

## Functions

### \_\_resetAmoeRetryCronHandlerHooksForTest()

> **\_\_resetAmoeRetryCronHandlerHooksForTest**(): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L60)

#### Returns

`void`

***

### \_\_setAmoeRetryCronHandlerHooksForTest()

> **\_\_setAmoeRetryCronHandlerHooksForTest**(`hooks`): `void`

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:56](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L56)

#### Parameters

##### hooks

[`AmoeRetryCronHandlerHooks`](#amoeretrycronhandlerhooks)

#### Returns

`void`

***

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse`\>

Defined in: [api/\_handlers/v1/lottery/\_amoeRetryCron.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/v1/lottery/_amoeRetryCron.ts#L66)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse`\>
