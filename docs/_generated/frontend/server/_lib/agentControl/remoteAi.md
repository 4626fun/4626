[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/agentControl/remoteAi

# server/\_lib/agentControl/remoteAi

## Functions

### assertRemoteAiEndpoint()

> **assertRemoteAiEndpoint**(`url`): `string`

Defined in: [server/\_lib/agentControl/remoteAi.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/remoteAi.ts#L19)

#### Parameters

##### url

`string`

#### Returns

`string`

***

### fetchRemoteAi()

> **fetchRemoteAi**(`url`, `init?`): `Promise`\<`Response`\>

Defined in: [server/\_lib/agentControl/remoteAi.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/remoteAi.ts#L35)

#### Parameters

##### url

`string`

##### init?

`RequestInit`

#### Returns

`Promise`\<`Response`\>

***

### prepareRemoteAiJsonPayload()

> **prepareRemoteAiJsonPayload**\<`T`\>(`payload`, `options`): `T`

Defined in: [server/\_lib/agentControl/remoteAi.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/remoteAi.ts#L54)

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### payload

`T`

##### options

`RemoteAiPayloadOptions` = `{}`

#### Returns

`T`

***

### prepareRemoteAiJsonString()

> **prepareRemoteAiJsonString**(`payload`, `options`): `string`

Defined in: [server/\_lib/agentControl/remoteAi.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/remoteAi.ts#L64)

#### Parameters

##### payload

`unknown`

##### options

`RemoteAiPayloadOptions` = `{}`

#### Returns

`string`

***

### prepareRemoteAiText()

> **prepareRemoteAiText**(`input`, `options`): `string`

Defined in: [server/\_lib/agentControl/remoteAi.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agentControl/remoteAi.ts#L42)

#### Parameters

##### input

`string`

##### options

`Pick`\<`RemoteAiPayloadOptions`, `"maskAddresses"` \| `"maxStringLength"`\> = `{}`

#### Returns

`string`
