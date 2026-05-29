[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/runMaintenanceCycle

# server/\_lib/controlPlane/executors/runMaintenanceCycle

## Type Aliases

### MaintenanceStepResult

> **MaintenanceStepResult** = `object`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L10)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L11)

##### error?

> `optional` **error**: `string`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L14)

##### result?

> `optional` **result**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L13)

##### status

> **status**: `"succeeded"` \| `"failed"` \| `"skipped"`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L12)

***

### RunMaintenanceCycleResult

> **RunMaintenanceCycleResult** = `object`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L17)

#### Properties

##### mode

> **mode**: `string`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L19)

##### overall

> **overall**: `"succeeded"` \| `"partial"` \| `"failed"`

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L21)

##### steps

> **steps**: [`MaintenanceStepResult`](#maintenancestepresult)[]

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L20)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L18)

## Functions

### runMaintenanceCycle()

> **runMaintenanceCycle**(`input`): `Promise`\<[`RunMaintenanceCycleResult`](#runmaintenancecycleresult)\>

Defined in: [server/\_lib/controlPlane/executors/runMaintenanceCycle.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/runMaintenanceCycle.ts#L82)

#### Parameters

##### input

###### mode?

`string` \| `null`

###### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`RunMaintenanceCycleResult`](#runmaintenancecycleresult)\>
