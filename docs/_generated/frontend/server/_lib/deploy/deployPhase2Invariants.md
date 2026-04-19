[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/deploy/deployPhase2Invariants

# server/\_lib/deploy/deployPhase2Invariants

## Type Aliases

### DeployPhase2InvariantViolation

> **DeployPhase2InvariantViolation** = `object`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:122](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L122)

#### Properties

##### actual?

> `optional` **actual**: `string` \| `number` \| `null`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:126](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L126)

##### code

> **code**: `string`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:123](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L123)

##### expected?

> `optional` **expected**: `string` \| `number` \| `null`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:125](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L125)

##### message

> **message**: `string`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:124](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L124)

***

### VerifyPhase2InvariantsResult

> **VerifyPhase2InvariantsResult** = `object`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:152](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L152)

#### Properties

##### checked

> **checked**: `boolean`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:153](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L153)

##### checksRun

> **checksRun**: `number`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:154](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L154)

##### expectations

> **expectations**: \{ `ccaStrategy`: `Address`; `creatorToken`: `Address`; `expectedPayoutRecipient`: `Address` \| `null`; `expectedTradeFeeCollector`: `Address`; `gaugeController`: `Address`; `payoutRecipientMode`: `"gauge"` \| `"payout_router"`; `shareToken`: `Address`; \} \| `null`

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:156](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L156)

##### violations

> **violations**: [`DeployPhase2InvariantViolation`](#deployphase2invariantviolation)[]

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:155](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L155)

## Functions

### verifyDeployPhase2Invariants()

> **verifyDeployPhase2Invariants**(`params`): `Promise`\<[`VerifyPhase2InvariantsResult`](#verifyphase2invariantsresult)\>

Defined in: [server/\_lib/deploy/deployPhase2Invariants.ts:203](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/deploy/deployPhase2Invariants.ts#L203)

#### Parameters

##### params

`VerifyPhase2InvariantsParams`

#### Returns

`Promise`\<[`VerifyPhase2InvariantsResult`](#verifyphase2invariantsresult)\>
