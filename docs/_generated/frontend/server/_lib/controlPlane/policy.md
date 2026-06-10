[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/policy

# server/\_lib/controlPlane/policy

## Type Aliases

### ControlPlanePolicy

> **ControlPlanePolicy** = `object`

Defined in: [server/\_lib/controlPlane/policy.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L27)

#### Properties

##### degradation

> **degradation**: `Record`\<[`ControlPlaneVerb`](#controlplaneverb), [`DegradationMode`](#degradationmode)\>

Defined in: [server/\_lib/controlPlane/policy.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L34)

##### exceptions

> **exceptions**: [`ExceptionPolicy`](#exceptionpolicy)[]

Defined in: [server/\_lib/controlPlane/policy.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L35)

##### lifecycle

> **lifecycle**: `object`

Defined in: [server/\_lib/controlPlane/policy.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L28)

###### operationStatus

> **operationStatus**: `object`

###### operationStatus.nonTerminal

> **nonTerminal**: `string`[]

###### operationStatus.terminal

> **terminal**: `string`[]

***

### ControlPlaneVerb

> **ControlPlaneVerb** = `"provisionVaultEconomy"` \| `"getVaultLifecycleStatus"` \| `"runMaintenanceCycle"` \| `"queueOperatorAction"` \| `"settleVault"`

Defined in: [server/\_lib/controlPlane/policy.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L10)

***

### DegradationMode

> **DegradationMode** = `"fail_closed"` \| `"allow_stale_read"` \| `"queue_for_retry"` \| `"block_until_operator"` \| `"manual_repair_only"`

Defined in: [server/\_lib/controlPlane/policy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L3)

***

### ExceptionPolicy

> **ExceptionPolicy** = `object`

Defined in: [server/\_lib/controlPlane/policy.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L17)

#### Properties

##### expiresAt

> **expiresAt**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L22)

##### id

> **id**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L18)

##### owner

> **owner**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L19)

##### reason

> **reason**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L20)

##### removalCondition

> **removalCondition**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L21)

##### scopeId?

> `optional` **scopeId**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L24)

##### scopeType?

> `optional` **scopeType**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L23)

***

### LoadedControlPlanePolicy

> **LoadedControlPlanePolicy** = `object`

Defined in: [server/\_lib/controlPlane/policy.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L38)

#### Properties

##### criticalWarnings

> **criticalWarnings**: `string`[]

Defined in: [server/\_lib/controlPlane/policy.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L41)

##### policy

> **policy**: [`ControlPlanePolicy`](#controlplanepolicy)

Defined in: [server/\_lib/controlPlane/policy.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L39)

##### policyVersion

> **policyVersion**: `string`

Defined in: [server/\_lib/controlPlane/policy.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L40)

## Functions

### loadControlPlanePolicy()

> **loadControlPlanePolicy**(): [`LoadedControlPlanePolicy`](#loadedcontrolplanepolicy)

Defined in: [server/\_lib/controlPlane/policy.ts:115](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/policy.ts#L115)

#### Returns

[`LoadedControlPlanePolicy`](#loadedcontrolplanepolicy)
