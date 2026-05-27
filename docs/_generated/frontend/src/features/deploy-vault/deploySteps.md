[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/deploy-vault/deploySteps

# src/features/deploy-vault/deploySteps

## Type Aliases

### DeployTimelineStage

> **DeployTimelineStage** = `object`

Defined in: [src/features/deploy-vault/deploySteps.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L12)

#### Properties

##### description

> **description**: `string`

Defined in: [src/features/deploy-vault/deploySteps.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L15)

##### id

> **id**: [`DeployTimelineStageId`](#deploytimelinestageid-1)

Defined in: [src/features/deploy-vault/deploySteps.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L13)

##### label

> **label**: `string`

Defined in: [src/features/deploy-vault/deploySteps.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L14)

***

### DeployTimelineStageId

> **DeployTimelineStageId** = `"setupOwnerApproval"` \| `"phase1Core"` \| `"phase1Finalize"` \| `"phase2Core"` \| `"phase2Finalize"` \| `"phase2bOvaultMesh"` \| `"phase3Strategies"` \| `"phase4Launch"` \| `"cleanup"`

Defined in: [src/features/deploy-vault/deploySteps.ts:1](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L1)

## Variables

### DEPLOY\_TIMELINE\_STAGE\_INDEX

> `const` **DEPLOY\_TIMELINE\_STAGE\_INDEX**: `Record`\<[`DeployTimelineStageId`](#deploytimelinestageid-1), `number`\>

Defined in: [src/features/deploy-vault/deploySteps.ts:66](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L66)

***

### DEPLOY\_TIMELINE\_STAGES

> `const` **DEPLOY\_TIMELINE\_STAGES**: `ReadonlyArray`\<[`DeployTimelineStage`](#deploytimelinestage)\>

Defined in: [src/features/deploy-vault/deploySteps.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L18)

## Functions

### legacyPhaseFromTimelineStage()

> **legacyPhaseFromTimelineStage**(`stage`): `"phase1"` \| `"phase2"` \| `"phase3"` \| `"phase4"`

Defined in: [src/features/deploy-vault/deploySteps.ts:94](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L94)

#### Parameters

##### stage

[`DeployTimelineStageId`](#deploytimelinestageid-1)

#### Returns

`"phase1"` \| `"phase2"` \| `"phase3"` \| `"phase4"`

***

### timelineStageFromDeployStep()

> **timelineStageFromDeployStep**(`stepRaw`): [`DeployTimelineStageId`](#deploytimelinestageid-1) \| `null`

Defined in: [src/features/deploy-vault/deploySteps.ts:72](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L72)

#### Parameters

##### stepRaw

`string`

#### Returns

[`DeployTimelineStageId`](#deploytimelinestageid-1) \| `null`

***

### txSlotFromTimelineStage()

> **txSlotFromTimelineStage**(`stage`): `"tx1"` \| `"tx2"` \| `"tx3"` \| `"tx4"` \| `null`

Defined in: [src/features/deploy-vault/deploySteps.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/deploy-vault/deploySteps.ts#L108)

#### Parameters

##### stage

[`DeployTimelineStageId`](#deploytimelinestageid-1)

#### Returns

`"tx1"` \| `"tx2"` \| `"tx3"` \| `"tx4"` \| `null`
