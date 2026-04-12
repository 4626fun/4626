[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/deploy/sessionClient

# src/lib/deploy/sessionClient

## Type Aliases

### DeploySessionStatusData

> **DeploySessionStatusData** = `object`

Defined in: [src/lib/deploy/sessionClient.ts:14](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L14)

#### Indexable

\[`key`: `string`\]: `unknown`

#### Properties

##### lastError?

> `optional` **lastError**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:18](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L18)

##### lastTxHash?

> `optional` **lastTxHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L16)

##### lastUserOpHash?

> `optional` **lastUserOpHash**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:17](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L17)

##### sessionOwner?

> `optional` **sessionOwner**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:20](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L20)

##### sessionSignerAddress?

> `optional` **sessionSignerAddress**: `string` \| `null`

Defined in: [src/lib/deploy/sessionClient.ts:19](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L19)

##### step?

> `optional` **step**: `string`

Defined in: [src/lib/deploy/sessionClient.ts:15](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L15)

***

### PostJsonWithTimeout()

> **PostJsonWithTimeout** = \<`T`\>(`params`) => `Promise`\<\{ `json`: [`ApiEnvelope`](../apiEnvelope.md#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

Defined in: [src/lib/deploy/sessionClient.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L6)

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

`Promise`\<\{ `json`: [`ApiEnvelope`](../apiEnvelope.md#apienvelope)\<`T`\> \| `null`; `response`: `Response`; \}\>

## Functions

### postDeploySessionRequestWithAuthRetry()

> **postDeploySessionRequestWithAuthRetry**\<`T`\>(`params`): `Promise`\<[`ApiEnvelope`](../apiEnvelope.md#apienvelope)\<`T`\>\>

Defined in: [src/lib/deploy/sessionClient.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L33)

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

`Promise`\<[`ApiEnvelope`](../apiEnvelope.md#apienvelope)\<`T`\>\>

***

### resumeAndPollDeploySession()

> **resumeAndPollDeploySession**(`params`): `Promise`\<[`DeploySessionStatusData`](#deploysessionstatusdata)\>

Defined in: [src/lib/deploy/sessionClient.ts:64](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L64)

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

Defined in: [src/lib/deploy/sessionClient.ts:24](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/deploy/sessionClient.ts#L24)

#### Parameters

##### message

`string`

#### Returns

`boolean`

## References

### ApiEnvelope

Re-exports [ApiEnvelope](../apiEnvelope.md#apienvelope)
