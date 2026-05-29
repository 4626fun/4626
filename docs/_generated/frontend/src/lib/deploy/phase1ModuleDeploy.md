[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/deploy/phase1ModuleDeploy

# src/lib/deploy/phase1ModuleDeploy

## Variables

### PHASE1\_MODULE\_DEPS\_ABI

> `const` **PHASE1\_MODULE\_DEPS\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"create2Deployer"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"bytecodeStore"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"vaultCoreModule"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"vaultStrategiesModule"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}, \{ `inputs`: readonly \[\]; `name`: `"vaultAdminModule"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:13](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L13)

***

### PHASE1\_MODULE\_ON\_BATCHER\_ABI

> `const` **PHASE1\_MODULE\_ON\_BATCHER\_ABI**: readonly \[\{ `inputs`: readonly \[\]; `name`: `"phase1Module"`; `outputs`: readonly \[\{ `type`: `"address"`; \}\]; `stateMutability`: `"view"`; `type`: `"function"`; \}\]

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L3)

## Functions

### readPhase1ModuleAddress()

> **readPhase1ModuleAddress**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L60)

#### Parameters

##### params

###### batcherAddress

`string`

###### publicClient

`ReadClient`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveBytecodeStoreForBatcher()

> **resolveBytecodeStoreForBatcher**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:153](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L153)

#### Parameters

##### params

###### batcherAddress

`string`

###### fallback?

`string` \| `null`

###### publicClient

`ReadClient`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveCreate2DeployerForBatcher()

> **resolveCreate2DeployerForBatcher**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:138](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L138)

#### Parameters

##### params

###### batcherAddress

`string`

###### fallback?

`string` \| `null`

###### publicClient

`ReadClient`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolvePhase1ModuleDeployField()

> **resolvePhase1ModuleDeployField**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L117)

Phase-1 delegatecall uses DeploymentBatcherPhase1Module immutables, not batcher shell getters.

#### Parameters

##### params

###### batcherAddress

`string`

###### functionName

`"create2Deployer"` \| `"bytecodeStore"` \| `"vaultCoreModule"` \| `"vaultStrategiesModule"` \| `"vaultAdminModule"`

###### publicClient

`ReadClient`

#### Returns

`Promise`\<`string` \| `null`\>

***

### resolveWiredCreatorOvaultModules()

> **resolveWiredCreatorOvaultModules**(`params`): `Promise`\<\{ `admin`: `string`; `core`: `string`; `strategies`: `string`; \} \| `null`\>

Defined in: [src/lib/deploy/phase1ModuleDeploy.ts:168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/deploy/phase1ModuleDeploy.ts#L168)

#### Parameters

##### params

###### batcherAddress

`string`

###### publicClient

`ReadClient`

#### Returns

`Promise`\<\{ `admin`: `string`; `core`: `string`; `strategies`: `string`; \} \| `null`\>
