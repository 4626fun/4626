[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/waitlist/waitlistAuthState

# src/components/waitlist/waitlistAuthState

## Functions

### isRecoveryRequiredAuthError()

> **isRecoveryRequiredAuthError**(`error`): `boolean`

Defined in: [src/components/waitlist/waitlistAuthState.ts:18](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistAuthState.ts#L18)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### runWaitlistPrivyLogout()

> **runWaitlistPrivyLogout**(`params`): `Promise`\<`void`\>

Defined in: [src/components/waitlist/waitlistAuthState.ts:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistAuthState.ts#L52)

#### Parameters

##### params

###### logout

() => `Promise`\<`void`\> \| `null` \| `undefined`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`void`\>

***

### shouldAutoStartWaitlistPrivyAuth()

> **shouldAutoStartWaitlistPrivyAuth**(`params`): `boolean`

Defined in: [src/components/waitlist/waitlistAuthState.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistAuthState.ts#L1)

#### Parameters

##### params

###### authAttemptInFlight

`boolean`

###### authAutoAttempted

`boolean`

###### busy

`boolean`

###### privyAuthed

`boolean`

###### privyReady

`boolean`

###### step

`"email"` \| `"auth"` \| `"zora"` \| `"done"`

#### Returns

`boolean`

***

### shouldStopWaitlistAutoAuthRetry()

> **shouldStopWaitlistAutoAuthRetry**(`params`): `boolean`

Defined in: [src/components/waitlist/waitlistAuthState.ts:45](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/waitlist/waitlistAuthState.ts#L45)

#### Parameters

##### params

###### isRecoveryRequired

`boolean`

###### isSessionMismatch

`boolean`

#### Returns

`boolean`
