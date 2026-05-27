[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistFlowState

# src/features/waitlist/waitlistFlowState

## Type Aliases

### WaitlistStep

> **WaitlistStep** = `"auth"` \| `"connect-base-app"` \| `"done"`

Defined in: [src/features/waitlist/waitlistFlowState.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L12)

***

### WaitlistSubAccountConnectOverlay

> **WaitlistSubAccountConnectOverlay** = `object`

Defined in: [src/features/waitlist/waitlistFlowState.ts:98](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L98)

#### Properties

##### parentAddress

> **parentAddress**: `string`

Defined in: [src/features/waitlist/waitlistFlowState.ts:99](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L99)

##### subAccountAddress

> **subAccountAddress**: `string`

Defined in: [src/features/waitlist/waitlistFlowState.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L100)

## Functions

### applyWaitlistSubAccountConnectOverlay()

> **applyWaitlistSubAccountConnectOverlay**\<`T`\>(`account`, `overlay`, `subAccountStepCompleted`): `T`

Defined in: [src/features/waitlist/waitlistFlowState.ts:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L104)

Keep waitlist UI signing-ready while bootstrap catches up after Base App connect.

#### Type Parameters

##### T

`T` *extends* `WaitlistAccountWithCanonical`

#### Parameters

##### account

`T`

##### overlay

[`WaitlistSubAccountConnectOverlay`](#waitlistsubaccountconnectoverlay) | `null` | `undefined`

##### subAccountStepCompleted

`boolean`

#### Returns

`T`

***

### isSubAccountExecutionReady()

> **isSubAccountExecutionReady**(`accountSignals?`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:50](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L50)

#### Parameters

##### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

#### Returns

`boolean`

***

### isWaitlistSigningReady()

> **isWaitlistSigningReady**(`account`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:80](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L80)

#### Parameters

##### account

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

#### Returns

`boolean`

***

### isWaitlistSigningReadyForUi()

> **isWaitlistSigningReadyForUi**(`account`, `notice?`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L91)

Server signals plus optimistic UI when a success notice landed before `me` refreshes.

#### Parameters

##### account

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

##### notice?

`string` | `null`

#### Returns

`boolean`

***

### isWaitlistStepTwoSigningComplete()

> **isWaitlistStepTwoSigningComplete**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:169](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L169)

Waitlist step 2 completion — parent CSW embedded owner on-chain or sub-account track.

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### ownerInstallRequested

`boolean`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### subAccountFlowEnabled?

`boolean`

#### Returns

`boolean`

***

### mergeCanonicalWaitlistAccount()

> **mergeCanonicalWaitlistAccount**\<`T`\>(`account`, `canonicalBootstrap`): `T`

Defined in: [src/features/waitlist/waitlistFlowState.ts:340](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L340)

#### Type Parameters

##### T

`T` *extends* `WaitlistAccountWithCanonical`

#### Parameters

##### account

`T`

##### canonicalBootstrap

`CanonicalBootstrapResult` | `null` | `undefined`

#### Returns

`T`

***

### resolveSubAccountAddress()

> **resolveSubAccountAddress**(`params`): `string` \| `null`

Defined in: [src/features/waitlist/waitlistFlowState.ts:57](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L57)

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### baseSubAccount?

`string` \| `null`

#### Returns

`string` \| `null`

***

### resolveWaitlistStep()

> **resolveWaitlistStep**(`params`): [`WaitlistStep`](#waitliststep)

Defined in: [src/features/waitlist/waitlistFlowState.ts:249](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L249)

#### Parameters

##### params

###### account

\{ `accountSignals?`: [`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals); `appAccessStatus`: `string` \| `null`; `baseSubAccount?`: `string` \| `null`; `emailVerified`: `boolean`; \}

###### account.accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### account.appAccessStatus

`string` \| `null`

###### account.baseSubAccount?

`string` \| `null`

###### account.emailVerified

`boolean`

###### embeddedEoaAvailable?

`boolean`

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### subAccountFlowEnabled?

`boolean`

###### subAccountStepCompleted?

`boolean`

###### zoraLinked?

`boolean`

#### Returns

[`WaitlistStep`](#waitliststep)

***

### shouldAutoBootstrapWaitlistSession()

> **shouldAutoBootstrapWaitlistSession**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:329](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L329)

#### Parameters

##### params

###### privyAuthed

`boolean`

###### recoveryRequired

`boolean`

###### step

[`WaitlistStep`](#waitliststep)

#### Returns

`boolean`

***

### shouldForceBaseAppConnectStep()

> **shouldForceBaseAppConnectStep**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L135)

#### Parameters

##### params

###### account

\{ `accountSignals?`: [`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals); `emailVerified`: `boolean`; \}

###### account.accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### account.emailVerified

`boolean`

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### setupIntent

`string` \| `null` \| `undefined`

###### subAccountFlowEnabled?

`boolean`

###### zoraLinked?

`boolean`

#### Returns

`boolean`

***

### shouldPromptBaseAccountReconnect()

> **shouldPromptBaseAccountReconnect**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L67)

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### subAccountFlowEnabled

`boolean`

#### Returns

`boolean`

***

### shouldShowBaseAppConnectPanel()

> **shouldShowBaseAppConnectPanel**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:209](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L209)

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### embeddedEoaAvailable

`boolean`

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### signingStepComplete

`boolean`

###### subAccountFlowEnabled

`boolean`

###### zoraLinked?

`boolean`

#### Returns

`boolean`

***

### shouldShowParentCswAddOwnerPanel()

> **shouldShowParentCswAddOwnerPanel**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:183](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/features/waitlist/waitlistFlowState.ts#L183)

#### Parameters

##### params

###### accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### executionTrack?

[`UserFrontendExecutionTrack`](../../lib/wallet/userExecutionTrack.md#userfrontendexecutiontrack)

###### onchainEoaOwnerCount?

`number`

###### ownerInstallRequested

`boolean`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### signingStepComplete

`boolean`

###### subAccountFlowEnabled?

`boolean`

###### zoraLinked?

`boolean`

#### Returns

`boolean`

## References

### buildWaitlistStepRoutingParams

Re-exports [buildWaitlistStepRoutingParams](../../lib/wallet/userExecutionTrack.md#buildwaitliststeproutingparams)

***

### inferWaitlistEoaOwnerRoutingHint

Re-exports [inferWaitlistEoaOwnerRoutingHint](../../lib/wallet/userExecutionTrack.md#inferwaitlisteoaownerroutinghint)

***

### isParentCswEmbeddedOwnerReady

Re-exports [isParentCswEmbeddedOwnerReady](../../lib/wallet/userExecutionTrack.md#isparentcswembeddedownerready)

***

### isZoraLinkedFromAccountSignals

Re-exports [isZoraLinkedFromAccountSignals](../../lib/wallet/userExecutionTrack.md#iszoralinkedfromaccountsignals)

***

### resolveEffectiveExecutionTrack

Re-exports [resolveEffectiveExecutionTrack](../../lib/wallet/userExecutionTrack.md#resolveeffectiveexecutiontrack)

***

### shouldUseBaseAppSubAccountPath

Re-exports [shouldUseBaseAppSubAccountPath](../../lib/wallet/userExecutionTrack.md#shouldusebaseappsubaccountpath)

***

### WaitlistStepRoutingContext

Re-exports [WaitlistStepRoutingContext](../../lib/wallet/userExecutionTrack.md#waitliststeproutingcontext)
