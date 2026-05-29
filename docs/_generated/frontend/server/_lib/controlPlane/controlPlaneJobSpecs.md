[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/controlPlaneJobSpecs

# server/\_lib/controlPlane/controlPlaneJobSpecs

## Type Aliases

### AsyncVerbKind

> **AsyncVerbKind** = `"vault.provision"` \| `"vault.maintenance"` \| `"vault.settle"` \| `"operator.action"`

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L4)

***

### ControlPlaneJobSpec

> **ControlPlaneJobSpec** = `object`

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L6)

#### Properties

##### body

> **body**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L8)

##### path

> **path**: `string`

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L7)

##### stageKind

> **stageKind**: `string`

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L9)

## Functions

### buildControlPlaneJobSpec()

> **buildControlPlaneJobSpec**(`input`): [`ControlPlaneJobSpec`](#controlplanejobspec)

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L17)

#### Parameters

##### input

###### operationId

`string`

###### operationKind

[`AsyncVerbKind`](#asyncverbkind)

###### payload

`Record`\<`string`, `unknown`\>

###### stageId

`string`

###### vaultAddress

`` `0x${string}` ``

#### Returns

[`ControlPlaneJobSpec`](#controlplanejobspec)

***

### isAllowedControlPlaneInternalPath()

> **isAllowedControlPlaneInternalPath**(`path`): `boolean`

Defined in: [server/\_lib/controlPlane/controlPlaneJobSpecs.ts:90](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/controlPlaneJobSpecs.ts#L90)

#### Parameters

##### path

`string`

#### Returns

`boolean`
