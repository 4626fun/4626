[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/sessionClient

# src/lib/deploy/sessionClient

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [src/lib/deploy/sessionClient.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L3)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [src/lib/deploy/sessionClient.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L3)

##### error?

> `optional` **error**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L3)

##### success

> **success**: `boolean`

Defined in: [src/lib/deploy/sessionClient.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L3)

***

### DeploySessionStatusData

> **DeploySessionStatusData** = `object`

Defined in: [src/lib/deploy/sessionClient.ts:13](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L13)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### lastError?

> `optional` **lastError**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:17](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L17)

##### lastTxHash?

> `optional` **lastTxHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:15](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L15)

##### lastUserOpHash?

> `optional` **lastUserOpHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:16](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L16)

##### sessionOwner?

> `optional` **sessionOwner**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:19](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L19)

##### sessionSignerAddress?

> `optional` **sessionSignerAddress**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:18](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L18)

##### step?

> `optional` **step**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:14](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L14)

***

### PostJsonWithTimeout()

> **PostJsonWithTimeout** = \<`T`\>(`params`) => `Promise`\<\{ `json`: [`ApiEnvelope`](#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

Defined in: [src/lib/deploy/sessionClient.ts:5](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L5)

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

`Promise`\<\{ `json`: [`ApiEnvelope`](#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

## Functions

### postDeploySessionRequestWithAuthRetry()

> **postDeploySessionRequestWithAuthRetry**\<`T`\>(`params`): `Promise`\<[`ApiEnvelope`](#apienvelope)\<`T`\>\>

Defined in: [src/lib/deploy/sessionClient.ts:32](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L32)

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

###### postJson

[`PostJsonWithTimeout`](#postjsonwithtimeout)

###### shouldRetryAuth?

(`message`) => `boolean`

###### url

`string`

#### Returns

`Promise`\<[`ApiEnvelope`](#apienvelope)\<`T`\>\>

***

### resumeAndPollDeploySession()

> **resumeAndPollDeploySession**(`params`): `Promise`\<[`DeploySessionStatusData`](#deploysessionstatusdata)\>

Defined in: [src/lib/deploy/sessionClient.ts:63](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L63)

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

Defined in: [src/lib/deploy/sessionClient.ts:23](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/deploy/sessionClient.ts#L23)

#### Parameters

##### message

`string`

#### Returns

`boolean`
