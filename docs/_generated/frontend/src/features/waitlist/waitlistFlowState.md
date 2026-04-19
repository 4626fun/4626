[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistFlowState

# src/features/waitlist/waitlistFlowState

## Type Aliases

### WaitlistStep

> **WaitlistStep** = `"auth"` \| `"done"`

Defined in: [src/features/waitlist/waitlistFlowState.ts:1](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/waitlistFlowState.ts#L1)

## Functions

### mergeCanonicalWaitlistAccount()

> **mergeCanonicalWaitlistAccount**\<`T`\>(`account`, `canonicalBootstrap`): `T`

Defined in: [src/features/waitlist/waitlistFlowState.ts:34](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/waitlistFlowState.ts#L34)

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

### resolveWaitlistStep()

> **resolveWaitlistStep**(`params`): [`WaitlistStep`](#waitliststep)

Defined in: [src/features/waitlist/waitlistFlowState.ts:13](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/waitlistFlowState.ts#L13)

#### Parameters

##### params

###### account

\{ `appAccessStatus`: `string` \| `null`; `emailVerified`: `boolean`; \}

###### account.appAccessStatus

`string` \| `null`

###### account.emailVerified

`boolean`

#### Returns

[`WaitlistStep`](#waitliststep)

***

### shouldAutoBootstrapWaitlistSession()

> **shouldAutoBootstrapWaitlistSession**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistFlowState.ts:23](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/features/waitlist/waitlistFlowState.ts#L23)

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
