[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/features/waitlist/waitlistAuthState

# src/features/waitlist/waitlistAuthState

## Functions

### clearStoredWaitlistSessionToken()

> **clearStoredWaitlistSessionToken**(): `void`

Defined in: [src/features/waitlist/waitlistAuthState.ts:6](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L6)

#### Returns

`void`

***

### isAlreadyLoggedInAuthError()

> **isAlreadyLoggedInAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:68](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L68)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isEmailAlreadyLinkedAuthError()

> **isEmailAlreadyLinkedAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:56](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L56)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isRecoveryRequiredAuthError()

> **isRecoveryRequiredAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:29](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L29)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### runWaitlistPrivyLogout()

> **runWaitlistPrivyLogout**(`params`): `Promise`\<`void`\>

Defined in: [src/features/waitlist/waitlistAuthState.ts:89](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L89)

#### Parameters

##### params

###### logout

() => `Promise`\<`void`\> \| `null` \| `undefined`

###### shouldLogout?

`boolean`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`void`\>

***

### shouldStopWaitlistAutoAuthRetry()

> **shouldStopWaitlistAutoAuthRetry**(`params`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:82](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/features/waitlist/waitlistAuthState.ts#L82)

#### Parameters

##### params

###### isRecoveryRequired

`boolean`

###### isSessionMismatch

`boolean`

#### Returns

`boolean`
