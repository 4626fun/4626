[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/provisionVaultEconomy

# server/\_lib/controlPlane/executors/provisionVaultEconomy

## Classes

### ProvisionVaultEconomyError

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L27)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new ProvisionVaultEconomyError**(`message`, `params?`): [`ProvisionVaultEconomyError`](#provisionvaulteconomyerror)

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L31)

###### Parameters

###### message

`string`

###### params?

###### code?

`string`

###### retryable?

`boolean`

###### Returns

[`ProvisionVaultEconomyError`](#provisionvaulteconomyerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L28)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:29](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L29)

## Type Aliases

### ProvisionVaultEconomyInput

> **ProvisionVaultEconomyInput** = `object`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L38)

#### Properties

##### chainId?

> `optional` **chainId**: `number` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:40](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L40)

##### creatorAddress?

> `optional` **creatorAddress**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L41)

##### operationId?

> `optional` **operationId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L44)

##### requestedBy?

> `optional` **requestedBy**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L43)

##### strategyVariant?

> `optional` **strategyVariant**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L42)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L39)

***

### ProvisionVaultEconomyResult

> **ProvisionVaultEconomyResult** = `object`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L47)

#### Properties

##### automationEnabled

> **automationEnabled**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L51)

##### configHash

> **configHash**: `string`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L50)

##### deploySessionId?

> `optional` **deploySessionId**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L53)

##### provisioned

> **provisioned**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:48](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L48)

##### vaultAddress

> **vaultAddress**: `` `0x${string}` ``

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L49)

##### warnings

> **warnings**: `string`[]

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L52)

## Functions

### findDeploySessionByVaultAddress()

> **findDeploySessionByVaultAddress**(`vaultAddress`): `Promise`\<[`DeploySessionRecord`](../../deploy/deploySessions.md#deploysessionrecord) \| `null`\>

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L61)

#### Parameters

##### vaultAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`DeploySessionRecord`](../../deploy/deploySessions.md#deploysessionrecord) \| `null`\>

***

### provisionVaultEconomy()

> **provisionVaultEconomy**(`input`): `Promise`\<[`ProvisionVaultEconomyResult`](#provisionvaulteconomyresult)\>

Defined in: [server/\_lib/controlPlane/executors/provisionVaultEconomy.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/provisionVaultEconomy.ts#L127)

#### Parameters

##### input

[`ProvisionVaultEconomyInput`](#provisionvaulteconomyinput)

#### Returns

`Promise`\<[`ProvisionVaultEconomyResult`](#provisionvaulteconomyresult)\>
