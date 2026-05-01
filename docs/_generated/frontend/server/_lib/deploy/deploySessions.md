[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/deploy/deploySessions

# server/\_lib/deploy/deploySessions

## Type Aliases

### DeploySessionRecord

> **DeploySessionRecord** = `object`

Defined in: [server/\_lib/deploy/deploySessions.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L33)

#### Properties

##### artifacts

> **artifacts**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L56)

##### attemptCount

> **attemptCount**: `number`

Defined in: [server/\_lib/deploy/deploySessions.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L50)

##### createdAt

> **createdAt**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L43)

##### currentStage

> **currentStage**: [`DeploySessionStep`](#deploysessionstep)

Defined in: [server/\_lib/deploy/deploySessions.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L49)

##### deployToken

> **deployToken**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L39)

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L42)

##### id

> **id**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L34)

##### lastError

> **lastError**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L45)

##### lastFailureCode

> **lastFailureCode**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L54)

##### lastFailureStage

> **lastFailureStage**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L55)

##### lastTxHash

> **lastTxHash**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L47)

##### lastUserOpHash

> **lastUserOpHash**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L46)

##### lockExpiresAt

> **lockExpiresAt**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L53)

##### lockOwner

> **lockOwner**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L52)

##### nextRunAfter

> **nextRunAfter**: `string` \| `null`

Defined in: [server/\_lib/deploy/deploySessions.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L51)

##### payload

> **payload**: `any`

Defined in: [server/\_lib/deploy/deploySessions.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L40)

##### sessionAddress

> **sessionAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/deploy/deploySessions.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L36)

##### sessionSigner

> **sessionSigner**: `` `0x${string}` ``

Defined in: [server/\_lib/deploy/deploySessions.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L38)

##### smartWallet

> **smartWallet**: `` `0x${string}` ``

Defined in: [server/\_lib/deploy/deploySessions.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L37)

##### state

> **state**: [`DeploySessionState`](#deploysessionstate)

Defined in: [server/\_lib/deploy/deploySessions.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L48)

##### step

> **step**: [`DeploySessionStep`](#deploysessionstep)

Defined in: [server/\_lib/deploy/deploySessions.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L41)

##### tokenHash

> **tokenHash**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L35)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L44)

***

### DeploySessionState

> **DeploySessionState** = `"pending"` \| `"running"` \| `"completed"` \| `"failed"` \| `"cancelled"`

Defined in: [server/\_lib/deploy/deploySessions.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L31)

***

### DeploySessionStep

> **DeploySessionStep** = `"created"` \| `"phase1_sent"` \| `"phase1_confirmed"` \| `"phase1_finalize_sent"` \| `"phase1_finalize_confirmed"` \| `"phase2_core_sent"` \| `"phase2_core_confirmed"` \| `"phase2_finalize_sent"` \| `"phase2_finalize_confirmed"` \| `"phase2_sent"` \| `"phase2_confirmed"` \| `"ovault_mesh_sent"` \| `"ovault_mesh_confirmed"` \| `"phase3_sent"` \| `"phase3_confirmed"` \| `"phase4_sent"` \| `"phase4_confirmed"` \| `"cleanup_sent"` \| `"cancelled"` \| `"completed"` \| `"failed"`

Defined in: [server/\_lib/deploy/deploySessions.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L7)

## Functions

### claimDeploySessionLease()

> **claimDeploySessionLease**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:635](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L635)

#### Parameters

##### params

###### expectedStep?

[`DeploySessionStep`](#deploysessionstep)

###### id

`string`

###### leaseMs

`number`

###### now?

`Date`

###### workerId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### ensureDeploySessionsSchema()

> **ensureDeploySessionsSchema**(): `Promise`\<`void`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L71)

#### Returns

`Promise`\<`void`\>

***

### getActiveDeploySessionForSender()

> **getActiveDeploySessionForSender**(`params`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:332](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L332)

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

Defined in: [server/\_lib/deploy/deploySessions.ts:314](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L314)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

***

### getDeploySessionByTokenHash()

> **getDeploySessionByTokenHash**(`tokenHash`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:323](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L323)

#### Parameters

##### tokenHash

`string`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord) \| `null`\>

***

### hashDeployToken()

> **hashDeployToken**(`token`): `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:236](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L236)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### insertDeploySession()

> **insertDeploySession**(`params`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord)\>

Defined in: [server/\_lib/deploy/deploySessions.ts:246](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L246)

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

### isDeploySessionTerminal()

> **isDeploySessionTerminal**(`step`): `boolean`

Defined in: [server/\_lib/deploy/deploySessions.ts:607](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L607)

#### Parameters

##### step

[`DeploySessionStep`](#deploysessionstep)

#### Returns

`boolean`

***

### listRunnableDeploySessions()

> **listRunnableDeploySessions**(`params?`): `Promise`\<[`DeploySessionRecord`](#deploysessionrecord)[]\>

Defined in: [server/\_lib/deploy/deploySessions.ts:611](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L611)

#### Parameters

##### params?

###### limit?

`number`

###### now?

`Date`

#### Returns

`Promise`\<[`DeploySessionRecord`](#deploysessionrecord)[]\>

***

### randomDeployToken()

> **randomDeployToken**(): `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:232](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L232)

#### Returns

`string`

***

### randomId()

> **randomId**(`prefix`): `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L228)

#### Parameters

##### prefix

`string` = `'ds_'`

#### Returns

`string`

***

### releaseDeploySessionLease()

> **releaseDeploySessionLease**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:667](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L667)

#### Parameters

##### params

###### id

`string`

###### workerId

`string`

#### Returns

`Promise`\<`void`\>

***

### signDeployToken()

> **signDeployToken**(`token`): `string`

Defined in: [server/\_lib/deploy/deploySessions.ts:240](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L240)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### transitionDeploySession()

> **transitionDeploySession**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:503](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L503)

#### Parameters

##### params

###### artifactsPatch?

`Record`\<`string`, `unknown`\>

###### attemptCount?

`number` \| `null`

###### currentStage?

[`DeploySessionStep`](#deploysessionstep)

###### fromStep

[`DeploySessionStep`](#deploysessionstep)

###### id

`string`

###### lastError?

`string` \| `null`

###### lastFailureCode?

`string` \| `null`

###### lastFailureStage?

`string` \| `null`

###### lastTxHash?

`string` \| `null`

###### lastUserOpHash?

`string` \| `null`

###### lockExpiresAt?

`Date` \| `null`

###### lockOwner?

`string` \| `null`

###### nextRunAfter?

`Date` \| `null`

###### payloadPatch?

`any`

###### state?

[`DeploySessionState`](#deploysessionstate)

###### toStep

[`DeploySessionStep`](#deploysessionstep)

#### Returns

`Promise`\<`boolean`\>

***

### updateDeploySession()

> **updateDeploySession**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/deploy/deploySessions.ts:397](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/deploy/deploySessions.ts#L397)

#### Parameters

##### params

###### artifactsPatch?

`Record`\<`string`, `unknown`\>

###### attemptCount?

`number` \| `null`

###### currentStage?

[`DeploySessionStep`](#deploysessionstep)

###### id

`string`

###### lastError?

`string` \| `null`

###### lastFailureCode?

`string` \| `null`

###### lastFailureStage?

`string` \| `null`

###### lastTxHash?

`string` \| `null`

###### lastUserOpHash?

`string` \| `null`

###### lockExpiresAt?

`Date` \| `null`

###### lockOwner?

`string` \| `null`

###### nextRunAfter?

`Date` \| `null`

###### payloadPatch?

`any`

###### state?

[`DeploySessionState`](#deploysessionstate)

###### step?

[`DeploySessionStep`](#deploysessionstep)

#### Returns

`Promise`\<`void`\>
