[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSiweAuth

# src/hooks/useSiweAuth

## Variables

### PRIVY\_INTERACTIVE\_LOGIN\_METHODS

> `const` **PRIVY\_INTERACTIVE\_LOGIN\_METHODS**: readonly \[`"email"`, `"wallet"`\]

Defined in: [src/hooks/useSiweAuth.ts:41](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L41)

Explicit user-initiated Privy sign-in should prefer identity-first methods.
Wallet-first in this path can accidentally create a new Privy identity and
then collide with an existing email-bound account.

## Functions

### deriveSiweSessionState()

> **deriveSiweSessionState**(`input`): `DerivedSiweSessionState`

Defined in: [src/hooks/useSiweAuth.ts:107](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L107)

#### Parameters

##### input

`DerivedSiweSessionStateInput`

#### Returns

`DerivedSiweSessionState`

***

### shouldAutoBridgeConnectedPrivySession()

> **shouldAutoBridgeConnectedPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:137](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L137)

#### Parameters

##### input

`ShouldAutoBridgeConnectedPrivySessionInput`

#### Returns

`boolean`

***

### shouldAutoBridgeRestoredPrivySession()

> **shouldAutoBridgeRestoredPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:162](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L162)

#### Parameters

##### input

`ShouldAutoBridgeRestoredPrivySessionInput`

#### Returns

`boolean`

***

### shouldResetPrivyBridgeState()

> **shouldResetPrivyBridgeState**(`message`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:96](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L96)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### useSiweAuth()

> **useSiweAuth**(): `object`

Defined in: [src/hooks/useSiweAuth.ts:391](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L391)

#### Returns

`object`

##### authAddress

> **authAddress**: `string` \| `null`

##### busy

> **busy**: `boolean`

##### cswOwnership

> **cswOwnership**: `CswOwnershipAttestation` \| `null`

##### error

> **error**: `string` \| `null`

##### hasSession

> **hasSession**: `boolean` = `sessionState.hasSession`

##### isSignedIn

> **isSignedIn**: `boolean`

##### refresh()

> **refresh**: () => `Promise`\<`string` \| `null`\>

###### Returns

`Promise`\<`string` \| `null`\>

##### sessionHydrated

> **sessionHydrated**: `boolean`

##### signIn()

> **signIn**: (`opts?`) => `Promise`\<`string` \| `null`\>

###### Parameters

###### opts?

###### attestCswAddress?

`string` \| `null`

###### method?

`SignInMethod`

###### Returns

`Promise`\<`string` \| `null`\>

##### signInWithPrivyToken()

> **signInWithPrivyToken**: (`privyAccessToken`, `opts?`) => `Promise`\<`string` \| `null`\>

###### Parameters

###### privyAccessToken

`string` | `null`

###### opts?

###### background?

`boolean`

###### Returns

`Promise`\<`string` \| `null`\>

##### signOut()

> **signOut**: () => `Promise`\<`void`\>

###### Returns

`Promise`\<`void`\>

##### walletMatchesSession

> **walletMatchesSession**: `boolean` = `sessionState.walletMatchesSession`

***

### writeStoredSessionToken()

> **writeStoredSessionToken**(`token`): `void`

Defined in: [src/hooks/useSiweAuth.ts:327](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/hooks/useSiweAuth.ts#L327)

#### Parameters

##### token

`string` | `null`

#### Returns

`void`
