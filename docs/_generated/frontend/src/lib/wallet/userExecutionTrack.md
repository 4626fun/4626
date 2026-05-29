[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/wallet/userExecutionTrack

# src/lib/wallet/userExecutionTrack

## Type Aliases

### AccountChromeExecution

> **AccountChromeExecution** = `object`

Defined in: [src/lib/wallet/userExecutionTrack.ts:123](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L123)

#### Properties

##### effectiveExecutionTrack

> **effectiveExecutionTrack**: [`UserFrontendExecutionTrack`](#userfrontendexecutiontrack)

Defined in: [src/lib/wallet/userExecutionTrack.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L125)

##### executionLaneDescription

> **executionLaneDescription**: `string`

Defined in: [src/lib/wallet/userExecutionTrack.ts:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L131)

##### executionLaneTitle

> **executionLaneTitle**: `string`

Defined in: [src/lib/wallet/userExecutionTrack.ts:130](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L130)

##### mode

> **mode**: [`AccountChromeExecutionMode`](#accountchromeexecutionmode-1)

Defined in: [src/lib/wallet/userExecutionTrack.ts:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L124)

##### showSubAccountInAccounts

> **showSubAccountInAccounts**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:127](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L127)

##### showSubAccountInTray

> **showSubAccountInTray**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:126](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L126)

##### subAccountAddress

> **subAccountAddress**: `string` \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:129](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L129)

##### swapSenderLabel

> **swapSenderLabel**: `string` \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:128](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L128)

***

### AccountChromeExecutionMode

> **AccountChromeExecutionMode** = `"parent-csw"` \| `"sub-account"` \| `"none"`

Defined in: [src/lib/wallet/userExecutionTrack.ts:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L121)

***

### UserExecutionAccountSignals

> **UserExecutionAccountSignals** = `object`

Defined in: [src/lib/wallet/userExecutionTrack.ts:14](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L14)

#### Properties

##### baseSubAccount?

> `optional` **baseSubAccount**: `object`

Defined in: [src/lib/wallet/userExecutionTrack.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L21)

###### address?

> `optional` **address**: `string` \| `null`

###### isDistinctFromCsw?

> `optional` **isDistinctFromCsw**: `boolean`

###### registered?

> `optional` **registered**: `boolean`

##### canonicalCswAddress?

> `optional` **canonicalCswAddress**: `string` \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L18)

##### creatorCoin?

> `optional` **creatorCoin**: \{ `address?`: `string` \| `null`; \} \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:17](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L17)

##### executionTrack?

> `optional` **executionTrack**: [`UserFrontendExecutionTrack`](#userfrontendexecutiontrack)

Defined in: [src/lib/wallet/userExecutionTrack.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L19)

##### linked?

> `optional` **linked**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:15](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L15)

##### privyEmbeddedEoaIsOwnerOfCanonicalCsw?

> `optional` **privyEmbeddedEoaIsOwnerOfCanonicalCsw**: `boolean` \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L20)

##### zoraHandle?

> `optional` **zoraHandle**: `string` \| `null`

Defined in: [src/lib/wallet/userExecutionTrack.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L16)

***

### UserFrontendExecutionTrack

> **UserFrontendExecutionTrack** = `"sub-account"` \| `"legacy-owner-install"` \| `"migration-pending"` \| `"none-yet"`

Defined in: [src/lib/wallet/userExecutionTrack.ts:8](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L8)

Client-side user-initiated frontend execution track resolution.

Parent CSW embedded-owner (population c) must win over stale sub-account DB
state (population b). Shared by waitlist, swap, and deploy surfaces.

***

### WaitlistStepRoutingContext

> **WaitlistStepRoutingContext** = `object`

Defined in: [src/lib/wallet/userExecutionTrack.ts:112](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L112)

#### Properties

##### embeddedEoaAvailable

> **embeddedEoaAvailable**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:114](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L114)

##### onchainEoaOwnerCount?

> `optional` **onchainEoaOwnerCount**: `number`

Defined in: [src/lib/wallet/userExecutionTrack.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L118)

##### parentEmbeddedOwnerOnChain?

> `optional` **parentEmbeddedOwnerOnChain**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L116)

##### subAccountFlowEnabled

> **subAccountFlowEnabled**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:113](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L113)

##### subAccountStepCompleted?

> `optional` **subAccountStepCompleted**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L115)

##### zoraLinked?

> `optional` **zoraLinked**: `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L117)

## Functions

### buildWaitlistStepRoutingParams()

> **buildWaitlistStepRoutingParams**\<`TAccount`\>(`account`, `context`): `object`

Defined in: [src/lib/wallet/userExecutionTrack.ts:237](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L237)

#### Type Parameters

##### TAccount

`TAccount` *extends* `object`

#### Parameters

##### account

`TAccount`

##### context

[`WaitlistStepRoutingContext`](#waitliststeproutingcontext)

#### Returns

`object`

##### account

> **account**: `TAccount`

##### embeddedEoaAvailable

> **embeddedEoaAvailable**: `boolean` = `context.embeddedEoaAvailable`

##### onchainEoaOwnerCount

> **onchainEoaOwnerCount**: `number`

##### parentEmbeddedOwnerOnChain

> **parentEmbeddedOwnerOnChain**: `boolean` \| `undefined` = `context.parentEmbeddedOwnerOnChain`

##### subAccountFlowEnabled

> **subAccountFlowEnabled**: `boolean` = `context.subAccountFlowEnabled`

##### subAccountStepCompleted

> **subAccountStepCompleted**: `boolean` \| `undefined` = `context.subAccountStepCompleted`

##### zoraLinked

> **zoraLinked**: `boolean`

***

### deriveAccountChromeExecution()

> **deriveAccountChromeExecution**(`params`): [`AccountChromeExecution`](#accountchromeexecution)

Defined in: [src/lib/wallet/userExecutionTrack.ts:168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L168)

Account chrome (tray, /accounts, swap sender hint) must follow the effective
execution track — parent CSW owner (population c) hides stale sub-account UI.

#### Parameters

##### params

###### baseSubAccount?

\{ `address?`: `string` \| `null`; `isDistinctFromCsw?`: `boolean`; `registered?`: `boolean`; \} \| `null`

###### canonicalCswAddress?

`string` \| `null`

###### executionTrack?

[`UserFrontendExecutionTrack`](#userfrontendexecutiontrack) \| `null`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### privyEmbeddedEoaIsOwnerOfCanonicalCsw?

`boolean` \| `null`

###### subAccountFlowEnabled?

`boolean`

#### Returns

[`AccountChromeExecution`](#accountchromeexecution)

***

### inferWaitlistEoaOwnerRoutingHint()

> **inferWaitlistEoaOwnerRoutingHint**(`params`): `number`

Defined in: [src/lib/wallet/userExecutionTrack.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L57)

Best-effort EOA-owner hint for routing when a full CSW owner index is unavailable.

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](#userexecutionaccountsignals)

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

#### Returns

`number`

***

### isParentCswEmbeddedOwnerReady()

> **isParentCswEmbeddedOwnerReady**(`params`): `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:38](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L38)

Population (c): embedded EOA is a direct owner on the parent CSW — not Base App sub-account.

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](#userexecutionaccountsignals)

###### parentEmbeddedOwnerOnChain?

`boolean`

#### Returns

`boolean`

***

### isZoraLinkedFromAccountSignals()

> **isZoraLinkedFromAccountSignals**(`accountSignals`): `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L46)

#### Parameters

##### accountSignals

[`UserExecutionAccountSignals`](#userexecutionaccountsignals) | `undefined`

#### Returns

`boolean`

***

### resolveEffectiveExecutionTrack()

> **resolveEffectiveExecutionTrack**(`params`): [`UserFrontendExecutionTrack`](#userfrontendexecutiontrack)

Defined in: [src/lib/wallet/userExecutionTrack.ts:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L97)

#### Parameters

##### params

###### executionTrack?

[`UserFrontendExecutionTrack`](#userfrontendexecutiontrack) \| `null`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### privyEmbeddedEoaIsOwnerOfCanonicalCsw?

`boolean` \| `null`

#### Returns

[`UserFrontendExecutionTrack`](#userfrontendexecutiontrack)

***

### shouldUseBaseAppSubAccountPath()

> **shouldUseBaseAppSubAccountPath**(`params`): `boolean`

Defined in: [src/lib/wallet/userExecutionTrack.ts:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/wallet/userExecutionTrack.ts#L70)

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](#userexecutionaccountsignals)

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### subAccountFlowEnabled

`boolean`

###### zoraLinked?

`boolean`

#### Returns

`boolean`
