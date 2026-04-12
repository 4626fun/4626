[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/deploySessions

# server/\_lib/deploySessions

## Type Aliases

### DeploySessionRecord

> **DeploySessionRecord** = `object`

Defined in: [server/\_lib/deploySessions.ts:28](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L28)

#### Properties

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/deploySessions.ts:38](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L38)

##### deployToken

> **deployToken**: `string`

Defined in: [server/\_lib/deploySessions.ts:34](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L34)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/deploySessions.ts:37](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L37)

##### id

> **id**: `string`

Defined in: [server/\_lib/deploySessions.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L29)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/deploySessions.ts:40](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L40)

##### lastTxHash

> **lastTxHash**: `string` \| `null`

Defined in: [server/\_lib/deploySessions.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L42)

##### lastUserOpHash

> **lastUserOpHash**: `string` \| `null`

Defined in: [server/\_lib/deploySessions.ts:41](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L41)

##### payload

> **payload**: `any`

Defined in: [server/\_lib/deploySessions.ts:35](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L35)

##### sessionAddress

> **sessionAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/deploySessions.ts:31](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L31)

##### sessionSigner

> **sessionSigner**: `` `0x${string}` ``

Defined in: [server/\_lib/deploySessions.ts:33](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L33)

##### smartWallet

> **smartWallet**: `` `0x${string}` ``

Defined in: [server/\_lib/deploySessions.ts:32](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L32)

##### step

> **step**: [`DeploySessionStep`](#deploysessionstep)

Defined in: [server/\_lib/deploySessions.ts:36](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L36)

##### tokenHash

> **tokenHash**: `string`

Defined in: [server/\_lib/deploySessions.ts:30](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L30)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/deploySessions.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L39)

***

### DeploySessionStep

> **DeploySessionStep** = `"created"` \| `"phase1_sent"` \| `"phase1_confirmed"` \| `"phase1_finalize_sent"` \| `"phase1_finalize_confirmed"` \| `"phase2_core_sent"` \| `"phase2_core_confirmed"` \| `"phase2_sent"` \| `"phase2_confirmed"` \| `"ovault_mesh_sent"` \| `"ovault_mesh_confirmed"` \| `"phase3_sent"` \| `"phase3_confirmed"` \| `"phase4_sent"` \| `"phase4_confirmed"` \| `"cleanup_sent"` \| `"cancelled"` \| `"completed"` \| `"failed"`

Defined in: [server/\_lib/deploySessions.ts:7](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L7)

## Functions

### ensureDeploySessionsSchema()

> **ensureDeploySessionsSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/deploySessions.ts:47](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L47)

#### Returns

`Promise`\<`void`\>

***

### getActiveDeploySessionForSender()

> **getActiveDeploySessionForSender**(`params`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/deploySessions.ts:214](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L214)

#### Parameters

##### params

###### includeExpired?

`boolean`

Allow selecting a session even if it is expired.
Intended for cleanup-only flows (removing the temporary owner).

###### includeFailed?

`boolean`

Allow selecting a session even if it is in the `failed` step.
Intended for cleanup-only flows (removing the temporary owner).

###### sessionAddress

`string`

###### smartWallet

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

***

### getDeploySessionById()

> **getDeploySessionById**(`id`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/deploySessions.ts:196](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L196)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

***

### getDeploySessionByTokenHash()

> **getDeploySessionByTokenHash**(`tokenHash`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/deploySessions.ts:205](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L205)

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

***

### hashDeployToken()

> **hashDeployToken**(`token`): `string`

Defined in: [server/\_lib/deploySessions.ts:127](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L127)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### insertDeploySession()

> **insertDeploySession**(`params`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord)\>

Defined in: [server/\_lib/deploySessions.ts:137](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L137)

#### Parameters

##### params

###### deployToken

`string`

###### expiresAt

`Date`

###### id

`string`

###### payload

`any`

###### sessionAddress

`string`

###### sessionSigner

`string`

###### smartWallet

`string`

###### tokenHash

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord)\>

***

### randomDeployToken()

> **randomDeployToken**(): `string`

Defined in: [server/\_lib/deploySessions.ts:123](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L123)

#### Returns

`string`

***

### randomId()

> **randomId**(`prefix`): `string`

Defined in: [server/\_lib/deploySessions.ts:119](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L119)

#### Parameters

##### prefix

`string` = `'ds_'`

#### Returns

`string`

***

### signDeployToken()

> **signDeployToken**(`token`): `string`

Defined in: [server/\_lib/deploySessions.ts:131](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L131)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### transitionDeploySession()

> **transitionDeploySession**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploySessions.ts:324](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L324)

#### Parameters

##### params

###### fromStep

[`DeploySessionStep`](#deploysessionstep)

###### id

`string`

###### lastError?

`string` \| `null`

###### lastTxHash?

`string` \| `null`

###### lastUserOpHash?

`string` \| `null`

###### payloadPatch?

`any`

###### toStep

[`DeploySessionStep`](#deploysessionstep)

#### Returns

`Promise`\<`boolean`\>

***

### updateDeploySession()

> **updateDeploySession**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/deploySessions.ts:279](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/deploySessions.ts#L279)

#### Parameters

##### params

###### id

`string`

###### lastError?

`string` \| `null`

###### lastTxHash?

`string` \| `null`

###### lastUserOpHash?

`string` \| `null`

###### payloadPatch?

`any`

###### step?

[`DeploySessionStep`](#deploysessionstep)

#### Returns

`Promise`\<`void`\>
