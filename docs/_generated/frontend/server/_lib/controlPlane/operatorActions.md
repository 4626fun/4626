[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/controlPlane/operatorActions

# server/\_lib/controlPlane/operatorActions

## Type Aliases

### OperatorAction

> **OperatorAction** = [`VaultSweepAction`](#vaultsweepaction) \| [`VaultTendAction`](#vaulttendaction) \| [`VaultReportAction`](#vaultreportaction) \| [`StrategyAjnaRebucketAction`](#strategyajnarebucketaction) \| [`StrategyCharmRebalanceAction`](#strategycharmrebalanceaction) \| [`SolanaReconcileAction`](#solanareconcileaction)

Defined in: [server/\_lib/controlPlane/operatorActions.ts:38](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L38)

***

### SolanaReconcileAction

> **SolanaReconcileAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L31)

#### Properties

##### action

> **action**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:34](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L34)

##### checkpointKey

> **checkpointKey**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L35)

##### type

> **type**: `"solana.reconcile"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:32](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L32)

##### workflow

> **workflow**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:33](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L33)

***

### StrategyAjnaRebucketAction

> **StrategyAjnaRebucketAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L17)

#### Properties

##### authAddress?

> `optional` **authAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L21)

##### strategyAddress?

> `optional` **strategyAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L22)

##### targetBucket

> **targetBucket**: `number`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L20)

##### type

> **type**: `"strategy.ajna.rebucket"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L18)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L19)

***

### StrategyCharmRebalanceAction

> **StrategyCharmRebalanceAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L25)

#### Properties

##### charmVaultAddress

> **charmVaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:28](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L28)

##### type

> **type**: `"strategy.charm.rebalance"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:26](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L26)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:27](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L27)

***

### VaultReportAction

> **VaultReportAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L12)

#### Properties

##### type

> **type**: `"vault.report"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L13)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L14)

***

### VaultSweepAction

> **VaultSweepAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L1)

#### Properties

##### ccaStrategyAddress

> **ccaStrategyAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L4)

##### type

> **type**: `"vault.sweep"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L2)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L3)

***

### VaultTendAction

> **VaultTendAction** = `object`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L7)

#### Properties

##### type

> **type**: `"vault.tend"`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L8)

##### vaultAddress

> **vaultAddress**: `string`

Defined in: [server/\_lib/controlPlane/operatorActions.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L9)

## Functions

### parseOperatorAction()

> **parseOperatorAction**(`payload`): [`OperatorAction`](#operatoraction)

Defined in: [server/\_lib/controlPlane/operatorActions.ts:68](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/operatorActions.ts#L68)

#### Parameters

##### payload

`unknown`

#### Returns

[`OperatorAction`](#operatoraction)
