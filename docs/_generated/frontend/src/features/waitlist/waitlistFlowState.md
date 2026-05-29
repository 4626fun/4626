[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistFlowState

# src/features/waitlist/waitlistFlowState

## Type Aliases

### WaitlistStep

> **WaitlistStep** = `"auth"` \| `"done"`

Defined in: [src/features/waitlist/waitlistFlowState.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L3)

## Functions

### isWaitlistStepTwoSigningComplete()

> **isWaitlistStepTwoSigningComplete**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L111)

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

Defined in: [src/features/waitlist/waitlistFlowState.ts:204](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L204)

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

### resolveWaitlistAccordionOpenStep()

> **resolveWaitlistAccordionOpenStep**(`params`): `1` \| `2`

Defined in: [src/features/waitlist/waitlistFlowState.ts:65](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L65)

#### Parameters

##### params

###### focusBaseAppConnect

`boolean`

###### manualOpenStep

`1` \| `2` \| `null`

###### ownerInstallRequested

`boolean`

###### stepOneComplete

`boolean`

#### Returns

`1` \| `2`

***

### resolveWaitlistStep()

> **resolveWaitlistStep**(`params`): [`WaitlistStep`](#waitliststep)

Defined in: [src/features/waitlist/waitlistFlowState.ts:191](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L191)

#### Parameters

##### params

###### account

\{ `emailVerified`: `boolean`; \}

###### account.emailVerified

`boolean`

#### Returns

[`WaitlistStep`](#waitliststep)

***

### shouldFocusWaitlistBaseAppConnect()

> **shouldFocusWaitlistBaseAppConnect**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:39](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L39)

#### Parameters

##### params

###### account

\{ `accountSignals?`: [`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals); `emailVerified`: `boolean`; \}

###### account.accountSignals?

[`UserExecutionAccountSignals`](../../lib/wallet/userExecutionTrack.md#userexecutionaccountsignals)

###### account.emailVerified

`boolean`

###### inBaseApp

`boolean`

###### onchainEoaOwnerCount?

`number`

###### parentEmbeddedOwnerOnChain?

`boolean`

###### setupIntent?

`string` \| `null`

###### showBaseAppConnectPanel

`boolean`

###### signingStepComplete

`boolean`

###### subAccountFlowEnabled?

`boolean`

###### zoraLinked?

`boolean`

#### Returns

`boolean`

***

### shouldForceBaseAppConnectStep()

> **shouldForceBaseAppConnectStep**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:77](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L77)

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

### shouldShowBaseAppConnectPanel()

> **shouldShowBaseAppConnectPanel**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:151](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L151)

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

Defined in: [src/features/waitlist/waitlistFlowState.ts:125](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistFlowState.ts#L125)

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
