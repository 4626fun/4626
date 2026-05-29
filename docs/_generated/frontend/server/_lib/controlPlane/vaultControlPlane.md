[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/vaultControlPlane

# server/\_lib/controlPlane/vaultControlPlane

## Classes

### VaultControlPlaneError

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L71)

#### Extends

- `Error`

#### Constructors

##### Constructor

> **new VaultControlPlaneError**(`params`): [`VaultControlPlaneError`](#vaultcontrolplaneerror)

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:75](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L75)

###### Parameters

###### params

###### code

`string`

###### message

`string`

###### statusCode

`number`

###### Returns

[`VaultControlPlaneError`](#vaultcontrolplaneerror)

###### Overrides

`Error.constructor`

#### Properties

##### code

> **code**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:73](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L73)

##### statusCode

> **statusCode**: `number`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L72)

## Interfaces

### VaultControlPlane

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L100)

#### Methods

##### getVaultLifecycleStatus()

> **getVaultLifecycleStatus**(`vaultAddress`): `Promise`\<[`VaultLifecycleStatus`](#vaultlifecyclestatus) \| `null`\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L102)

###### Parameters

###### vaultAddress

`string`

###### Returns

`Promise`\<[`VaultLifecycleStatus`](#vaultlifecyclestatus) \| `null`\>

##### provisionVaultEconomy()

> **provisionVaultEconomy**(`request`): `Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L101)

###### Parameters

###### request

[`ProvisionVaultEconomyRequest`](#provisionvaulteconomyrequest)

###### Returns

`Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

##### queueOperatorAction()

> **queueOperatorAction**(`request`): `Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:104](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L104)

###### Parameters

###### request

[`QueueOperatorActionRequest`](#queueoperatoractionrequest)

###### Returns

`Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

##### runMaintenanceCycle()

> **runMaintenanceCycle**(`vaultAddress`): `Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L103)

###### Parameters

###### vaultAddress

`string`

###### Returns

`Promise`\<\{ `accepted`: `boolean`; `operationId`: `string`; `stageId?`: `string`; \}\>

##### settleVault()

> **settleVault**(`request`): `Promise`\<[`SettleVaultResult`](#settlevaultresult)\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:105](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L105)

###### Parameters

###### request

[`SettleVaultRequest`](#settlevaultrequest)

###### Returns

`Promise`\<[`SettleVaultResult`](#settlevaultresult)\>

## Type Aliases

### ProvisionVaultEconomyRequest

> **ProvisionVaultEconomyRequest** = `object`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L34)

#### Properties

##### chainId?

> `optional` **chainId**: `number`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:36](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L36)

##### creatorAddress?

> `optional` **creatorAddress**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:37](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L37)

##### requestedBy?

> `optional` **requestedBy**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L39)

##### strategyVariant?

> `optional` **strategyVariant**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L38)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L35)

***

### QueueOperatorActionRequest

> **QueueOperatorActionRequest** = `object`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L42)

#### Properties

##### actionType

> **actionType**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L44)

##### idempotencyKey?

> `optional` **idempotencyKey**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:46](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L46)

##### payload?

> `optional` **payload**: `Record`\<`string`, `unknown`\>

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:45](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L45)

##### requestedBy?

> `optional` **requestedBy**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:47](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L47)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L43)

***

### SettleVaultRequest

> **SettleVaultRequest** = `object`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L50)

#### Properties

##### graduatedAt?

> `optional` **graduatedAt**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L52)

##### idempotencyKey?

> `optional` **idempotencyKey**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:56](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L56)

##### requestedBy?

> `optional` **requestedBy**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:55](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L55)

##### settledAt?

> `optional` **settledAt**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L53)

##### settlementStage?

> `optional` **settlementStage**: `SettlementStage`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:54](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L54)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L51)

***

### SettleVaultResult

> **SettleVaultResult** = `object`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:82](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L82)

#### Properties

##### accepted

> **accepted**: `boolean`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:83](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L83)

##### operationId

> **operationId**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:84](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L84)

##### stageId?

> `optional` **stageId**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:85](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L85)

***

### VaultLifecycleStatus

> **VaultLifecycleStatus** = `object`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:59](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L59)

#### Properties

##### degradationMode?

> `optional` **degradationMode**: `"allow_stale_read"`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:67](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L67)

##### freshness?

> `optional` **freshness**: `"fresh"` \| `"stale"`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:65](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L65)

##### graduatedAt

> **graduatedAt**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:61](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L61)

##### lastUpdatedAt?

> `optional` **lastUpdatedAt**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:66](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L66)

##### settledAt

> **settledAt**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L62)

##### settlementStage

> **settlementStage**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:63](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L63)

##### settlementStageUpdatedAt

> **settlementStageUpdatedAt**: `string` \| `null`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L64)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:60](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L60)

##### warning?

> `optional` **warning**: `string`

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L68)

## Functions

### createVaultControlPlane()

> **createVaultControlPlane**(): [`VaultControlPlane`](#vaultcontrolplane)

Defined in: [server/\_lib/controlPlane/vaultControlPlane.ts:268](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/vaultControlPlane.ts#L268)

#### Returns

[`VaultControlPlane`](#vaultcontrolplane)
