[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/features/waitlist/waitlistAuthState

# src/features/waitlist/waitlistAuthState

## Functions

### clearStoredWaitlistSessionToken()

> **clearStoredWaitlistSessionToken**(): `void`

Defined in: [src/features/waitlist/waitlistAuthState.ts:7](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistAuthState.ts#L7)

#### Returns

`void`

***

### isAlreadyLoggedInAuthError()

> **isAlreadyLoggedInAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistAuthState.ts#L69)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isEmailAlreadyLinkedAuthError()

> **isEmailAlreadyLinkedAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistAuthState.ts#L57)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### isRecoveryRequiredAuthError()

> **isRecoveryRequiredAuthError**(`error`): `boolean`

Defined in: [src/features/waitlist/waitlistAuthState.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistAuthState.ts#L30)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### runWaitlistPrivyLogout()

> **runWaitlistPrivyLogout**(`params`): `Promise`\<`void`\>

Defined in: [src/features/waitlist/waitlistAuthState.ts:83](https://github.com/wenakita/4626/blob/main/frontend/src/features/waitlist/waitlistAuthState.ts#L83)

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
