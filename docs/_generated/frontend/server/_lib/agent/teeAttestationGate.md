[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/agent/teeAttestationGate

# server/\_lib/agent/teeAttestationGate

## Type Aliases

### TeeAttestationStatus

> **TeeAttestationStatus** = `object`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L8)

#### Properties

##### averageResponse

> **averageResponse**: `number`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L17)

##### checkedAtMs

> **checkedAtMs**: `number`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L18)

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L9)

##### passed

> **passed**: `boolean`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L10)

##### reason

> **reason**: `string`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L11)

##### registryAddress

> **registryAddress**: `Address` \| `null`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L14)

##### source

> **source**: `"disabled"` \| `"validation-registry"`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L12)

##### tag

> **tag**: `string`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L13)

##### validationCount

> **validationCount**: `number`

Defined in: [server/\_lib/agent/teeAttestationGate.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L16)

##### validatorAddresses

> **validatorAddresses**: `Address`[]

Defined in: [server/\_lib/agent/teeAttestationGate.ts:15](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L15)

## Functions

### assertTeeAttestationOrThrow()

> **assertTeeAttestationOrThrow**(`context?`): `Promise`\<`void`\>

Defined in: [server/\_lib/agent/teeAttestationGate.ts:252](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L252)

#### Parameters

##### context?

`TeeCheckContext`

#### Returns

`Promise`\<`void`\>

***

### getTeeAttestationStatus()

> **getTeeAttestationStatus**(): `Promise`\<[`TeeAttestationStatus`](#teeattestationstatus)\>

Defined in: [server/\_lib/agent/teeAttestationGate.ts:176](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/agent/teeAttestationGate.ts#L176)

#### Returns

`Promise`\<[`TeeAttestationStatus`](#teeattestationstatus)\>
