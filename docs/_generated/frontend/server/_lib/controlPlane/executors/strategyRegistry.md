[**4626-web**](../../../../index.md)

***

[4626-web](../../../../index.md) / server/\_lib/controlPlane/executors/strategyRegistry

# server/\_lib/controlPlane/executors/strategyRegistry

## Type Aliases

### StrategyProfile

> **StrategyProfile** = `object`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:5](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L5)

#### Properties

##### automationScope

> **automationScope**: `string`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L7)

##### contracts

> **contracts**: [`KeeprConfigV1`](../../keepr/keeprRegistry.md#keeprconfigv1)\[`"contracts"`\]

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L9)

##### profileId

> **profileId**: `number`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L8)

##### variant

> **variant**: `string`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L6)

***

### StrategyVariant

> **StrategyVariant** = `"default_strategy"` \| `"cca"` \| `"ajna"` \| `"charm"` \| `string` & `object`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L3)

## Functions

### mergeStrategyContracts()

> **mergeStrategyContracts**(`profile`, `artifacts`): \{ `ajnaAdapter?`: `` `0x${string}` ``; `ajnaAuth?`: `` `0x${string}` ``; `ajnaInnerVault?`: `` `0x${string}` ``; `ajnaPool?`: `` `0x${string}` ``; `ccaStrategy?`: `` `0x${string}` ``; `oracle?`: `` `0x${string}` ``; `vrfHub?`: `` `0x${string}` ``; \} \| `undefined`

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:44](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L44)

#### Parameters

##### profile

[`StrategyProfile`](#strategyprofile)

##### artifacts

`Record`\<`string`, `unknown`\>

#### Returns

\{ `ajnaAdapter?`: `` `0x${string}` ``; `ajnaAuth?`: `` `0x${string}` ``; `ajnaInnerVault?`: `` `0x${string}` ``; `ajnaPool?`: `` `0x${string}` ``; `ccaStrategy?`: `` `0x${string}` ``; `oracle?`: `` `0x${string}` ``; `vrfHub?`: `` `0x${string}` ``; \} \| `undefined`

***

### resolveStrategyProfile()

> **resolveStrategyProfile**(`strategyVariant`): [`StrategyProfile`](#strategyprofile)

Defined in: [server/\_lib/controlPlane/executors/strategyRegistry.ts:39](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/controlPlane/executors/strategyRegistry.ts#L39)

#### Parameters

##### strategyVariant

`string` | `null` | `undefined`

#### Returns

[`StrategyProfile`](#strategyprofile)
