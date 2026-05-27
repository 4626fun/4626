[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/sessionClient

# src/lib/deploy/sessionClient

## Type Aliases

### DeploySessionStatusData

> **DeploySessionStatusData** = `object`

Defined in: [src/lib/deploy/sessionClient.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L14)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### attemptCount?

> `optional` **attemptCount**: `number`

Defined in: [src/lib/deploy/sessionClient.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L19)

##### currentStage?

> `optional` **currentStage**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L17)

##### id?

> `optional` **id**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L15)

##### lastError?

> `optional` **lastError**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:23](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L23)

##### lastFailureCode?

> `optional` **lastFailureCode**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L24)

##### lastFailureStage?

> `optional` **lastFailureStage**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L25)

##### lastTxHash?

> `optional` **lastTxHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:21](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L21)

##### lastUserOpHash?

> `optional` **lastUserOpHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L22)

##### lockExpiresAt?

> `optional` **lockExpiresAt**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:27](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L27)

##### lockOwner?

> `optional` **lockOwner**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:26](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L26)

##### nextAction?

> `optional` **nextAction**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L30)

##### nextRunAfter?

> `optional` **nextRunAfter**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L20)

##### sessionOwner?

> `optional` **sessionOwner**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L29)

##### sessionSignerAddress?

> `optional` **sessionSignerAddress**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:28](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L28)

##### state?

> `optional` **state**: `"pending"` \| `"running"` \| `"completed"` \| `"failed"` \| `"cancelled"` \| `string`

Defined in: [src/lib/deploy/sessionClient.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L16)

##### step?

> `optional` **step**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L18)

***

### PostJsonWithTimeout()

> **PostJsonWithTimeout** = \<`T`\>(`params`) => `Promise`\<\{ `json`: [`ApiEnvelope`](../api/apiEnvelope.md#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

Defined in: [src/lib/deploy/sessionClient.ts:6](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L6)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### body

`unknown`

###### label

`string`

###### parseTimeoutMs?

`number`

###### requestTimeoutMs?

`number`

###### url

`string`

#### Returns

`Promise`\<\{ `json`: [`ApiEnvelope`](../api/apiEnvelope.md#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

## Functions

### postDeploySessionRequestWithAuthRetry()

> **postDeploySessionRequestWithAuthRetry**\<`T`\>(`params`): `Promise`\<[`ApiEnvelope`](../api/apiEnvelope.md#apienvelope)\<`T`\>\>

Defined in: [src/lib/deploy/sessionClient.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L43)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### body

`unknown`

###### ensurePaymasterSession

() => `Promise`\<`void`\>

###### label

`string`

###### maxAuthRetries?

`number`

###### parseTimeoutMs?

`number`

###### postJson

[`PostJsonWithTimeout`](#postjsonwithtimeout)

###### requestTimeoutMs?

`number`

###### shouldRetryAuth?

(`message`) => `boolean`

###### url

`string`

#### Returns

`Promise`\<[`ApiEnvelope`](../api/apiEnvelope.md#apienvelope)\<`T`\>\>

***

### resumeAndPollDeploySession()

> **resumeAndPollDeploySession**(`params`): `Promise`\<[`DeploySessionStatusData`](#deploysessionstatusdata)\>

Defined in: [src/lib/deploy/sessionClient.ts:78](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L78)

#### Parameters

##### params

###### clearDeploySession

() => `void`

###### ensureDeploySessionSignerInstalled

(`sessionSigner`) => `Promise`\<`void`\>

###### ensurePaymasterSession

() => `Promise`\<`void`\>

###### initialDelayMs?

`number`

###### maxDelayMs?

`number`

###### maxDurationMs?

`number`

###### now?

() => `number`

###### onCompleted?

(`data`) => `void`

###### onStatus?

(`data`) => `void`

###### postJson

[`PostJsonWithTimeout`](#postjsonwithtimeout)

###### sessionId

`string`

###### sleep?

(`ms`) => `Promise`\<`void`\>

#### Returns

`Promise`\<[`DeploySessionStatusData`](#deploysessionstatusdata)\>

***

### shouldRetryDeploySessionAuth()

> **shouldRetryDeploySessionAuth**(`message`): `boolean`

Defined in: [src/lib/deploy/sessionClient.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/deploy/sessionClient.ts#L34)

#### Parameters

##### message

`string`

#### Returns

`boolean`

## References

### ApiEnvelope

Re-exports [ApiEnvelope](../api/apiEnvelope.md#apienvelope)
