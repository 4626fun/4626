[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/deploy-vault/useDeploySessionV2

# src/features/deploy-vault/useDeploySessionV2

## Functions

### useDeploySessionV2()

> **useDeploySessionV2**(): `object`

Defined in: [src/features/deploy-vault/useDeploySessionV2.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/features/deploy-vault/useDeploySessionV2.ts#L12)

#### Returns

`object`

##### pollSession()

> **pollSession**: (`params`) => `Promise`\<[`DeploySessionStatusData`](../../lib/deploy/sessionClient.md#deploysessionstatusdata)\>

###### Parameters

###### params

###### clearDeploySession

() => `void`

###### ensureDeploySessionSignerInstalled

(`sessionSigner`) => `Promise`\<`void`\>

###### ensurePaymasterSession

() => `Promise`\<`void`\>

###### onCompleted?

(`data`) => `void`

###### onStatus?

(`data`) => `void`

###### postJson

[`PostJsonWithTimeout`](../../lib/deploy/sessionClient.md#postjsonwithtimeout)

###### sessionId

`string`

###### Returns

`Promise`\<[`DeploySessionStatusData`](../../lib/deploy/sessionClient.md#deploysessionstatusdata)\>

##### postSessionRequest()

> **postSessionRequest**: \<`T`\>(`params`) => `Promise`\<[`ApiEnvelope`](../../lib/api/apiEnvelope.md#apienvelope)\<`T`\>\>

###### Type Parameters

###### T

`T`

###### Parameters

###### params

###### body

`unknown`

###### ensurePaymasterSession

() => `Promise`\<`void`\>

###### label

`string`

###### maxAuthRetries?

`number`

###### postJson

[`PostJsonWithTimeout`](../../lib/deploy/sessionClient.md#postjsonwithtimeout)

###### url

`string`

###### Returns

`Promise`\<[`ApiEnvelope`](../../lib/api/apiEnvelope.md#apienvelope)\<`T`\>\>
