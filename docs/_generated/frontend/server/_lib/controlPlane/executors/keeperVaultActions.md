[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/keeperVaultActions

# server/\_lib/controlPlane/executors/keeperVaultActions

## Classes

### KeeperVaultActionError

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L19)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new KeeperVaultActionError**(`message`, `params?`): [`KeeperVaultActionError`](#keepervaultactionerror)

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L23)

###### Parameters

###### message

`string`

###### params?

###### code?

`string`

###### retryable?

`boolean`

###### Returns

[`KeeperVaultActionError`](#keepervaultactionerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L20)

##### retryable

> **retryable**: `boolean`

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L21)

## Functions

### executeVaultRebalanceStrategies()

> **executeVaultRebalanceStrategies**(`vaultAddress`, `minDeviationBps`): `Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L100)

#### Parameters

##### vaultAddress

`string`

##### minDeviationBps

`bigint`

#### Returns

`Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

***

### executeVaultReport()

> **executeVaultReport**(`vaultAddress`): `Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L124)

#### Parameters

##### vaultAddress

`string`

#### Returns

`Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

***

### executeVaultSweep()

> **executeVaultSweep**(`params`): `Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L54)

#### Parameters

##### params

###### ccaStrategyAddress

`string`

#### Returns

`Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

***

### executeVaultTend()

> **executeVaultTend**(`vaultAddress`): `Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/executors/keeperVaultActions.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/keeperVaultActions.ts#L73)

#### Parameters

##### vaultAddress

`string`

#### Returns

`Promise`\<\{ `status`: `string`; `txHash`: `string`; \}\>
