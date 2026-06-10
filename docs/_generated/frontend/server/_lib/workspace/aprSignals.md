[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/workspace/aprSignals

# server/\_lib/workspace/aprSignals

## Type Aliases

### StrategyAprSignal

> **StrategyAprSignal** = `object`

Defined in: [server/\_lib/workspace/aprSignals.ts:1](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/aprSignals.ts#L1)

#### Properties

##### confidence

> **confidence**: `"unknown"` \| `"low"` \| `"medium"` \| `"high"`

Defined in: [server/\_lib/workspace/aprSignals.ts:3](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/aprSignals.ts#L3)

##### expectedAprBps

> **expectedAprBps**: `number` \| `null`

Defined in: [server/\_lib/workspace/aprSignals.ts:2](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/aprSignals.ts#L2)

##### source

> **source**: `"keeper_report"` \| `"p0_placeholder"` \| `"none"`

Defined in: [server/\_lib/workspace/aprSignals.ts:4](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/aprSignals.ts#L4)

## Functions

### deriveStrategyAprSignal()

> **deriveStrategyAprSignal**(`params`): [`StrategyAprSignal`](#strategyaprsignal)

Defined in: [server/\_lib/workspace/aprSignals.ts:219](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/workspace/aprSignals.ts#L219)

#### Parameters

##### params

###### activityEvents?

`ActivityEventLike`[]

###### isActive

`boolean` \| `null`

###### kind

`"unknown"` \| `"ajna"` \| `"charm"` \| `"solana"`

###### monitoringSnapshots?

`MonitoringSnapshotLike`[]

###### nowIso?

`string`

###### strategyAddress?

`` `0x${string}` `` \| `null`

#### Returns

[`StrategyAprSignal`](#strategyaprsignal)
