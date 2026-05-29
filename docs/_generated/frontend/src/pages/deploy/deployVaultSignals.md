[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/pages/deploy/deployVaultSignals

# src/pages/deploy/deployVaultSignals

## Type Aliases

### DeployTimelineProgressState

> **DeployTimelineProgressState** = `"disabled"` \| `"inProgress"` \| `"done"` \| `"pending"`

Defined in: [src/pages/deploy/deployVaultSignals.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L30)

## Functions

### buildShareVanitySkipLogKey()

> **buildShareVanitySkipLogKey**(`params`): `string`

Defined in: [src/pages/deploy/deployVaultSignals.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L14)

#### Parameters

##### params

###### batcher

`string` \| `null` \| `undefined`

###### reason?

`string`

###### suffix

`string` \| `null` \| `undefined`

#### Returns

`string`

***

### deployTimelineProgressLabel()

> **deployTimelineProgressLabel**(`state`): `string`

Defined in: [src/pages/deploy/deployVaultSignals.ts:47](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L47)

#### Parameters

##### state

[`DeployTimelineProgressState`](#deploytimelineprogressstate)

#### Returns

`string`

***

### deriveDeployTimelineProgressState()

> **deriveDeployTimelineProgressState**(`params`): [`DeployTimelineProgressState`](#deploytimelineprogressstate)

Defined in: [src/pages/deploy/deployVaultSignals.ts:32](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L32)

#### Parameters

##### params

###### isDone

`boolean`

###### isStageEnabled

(`stage`) => `boolean`

###### stage

[`DeployTimelineStageId`](../../features/deploy-vault/deploySteps.md#deploytimelinestageid-1)

###### stageIndexMap

`Record`\<[`DeployTimelineStageId`](../../features/deploy-vault/deploySteps.md#deploytimelinestageid-1), `number`\>

###### timelineCurrentStage

[`DeployTimelineStageId`](../../features/deploy-vault/deploySteps.md#deploytimelinestageid-1) \| `null`

#### Returns

[`DeployTimelineProgressState`](#deploytimelineprogressstate)

***

### isProviderCollisionErrorMessage()

> **isProviderCollisionErrorMessage**(`input`): `boolean`

Defined in: [src/pages/deploy/deployVaultSignals.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L3)

#### Parameters

##### input

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### shouldEmitShareVanitySkipLog()

> **shouldEmitShareVanitySkipLog**(`params`): `boolean`

Defined in: [src/pages/deploy/deployVaultSignals.ts:23](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L23)

#### Parameters

##### params

###### lastKey

`string` \| `null`

###### nextKey

`string`

#### Returns

`boolean`

***

### summarizeDeployTimelineProgress()

> **summarizeDeployTimelineProgress**(`params`): `object`

Defined in: [src/pages/deploy/deployVaultSignals.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/pages/deploy/deployVaultSignals.ts#L54)

#### Parameters

##### params

###### isStageEnabled

(`stage`) => `boolean`

###### stages

readonly [`DeployTimelineStage`](../../features/deploy-vault/deploySteps.md#deploytimelinestage)[]

###### stateForStage

(`stage`) => [`DeployTimelineProgressState`](#deploytimelineprogressstate)

#### Returns

`object`

##### completedEnabledStageCount

> **completedEnabledStageCount**: `number`

##### enabledStageCount

> **enabledStageCount**: `number`

##### pendingStageCount

> **pendingStageCount**: `number`
