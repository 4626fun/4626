[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSiweAuth

# src/hooks/useSiweAuth

## Variables

### PRIVY\_INTERACTIVE\_LOGIN\_METHODS

> `const` **PRIVY\_INTERACTIVE\_LOGIN\_METHODS**: readonly \[`"email"`, `"wallet"`\]

Defined in: [src/hooks/useSiweAuth.ts:42](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L42)

Explicit user-initiated Privy sign-in should prefer identity-first methods.
Wallet-first in this path can accidentally create a new Privy identity and
then collide with an existing email-bound account.

## Functions

### deriveSiweSessionState()

> **deriveSiweSessionState**(`input`): `DerivedSiweSessionState`

Defined in: [src/hooks/useSiweAuth.ts:108](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L108)

#### Parameters

##### input

`DerivedSiweSessionStateInput`

#### Returns

`DerivedSiweSessionState`

***

### shouldAutoBridgeConnectedPrivySession()

> **shouldAutoBridgeConnectedPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:138](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L138)

#### Parameters

##### input

`ShouldAutoBridgeConnectedPrivySessionInput`

#### Returns

`boolean`

***

### shouldAutoBridgeRestoredPrivySession()

> **shouldAutoBridgeRestoredPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:163](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L163)

#### Parameters

##### input

`ShouldAutoBridgeRestoredPrivySessionInput`

#### Returns

`boolean`

***

### shouldResetPrivyBridgeState()

> **shouldResetPrivyBridgeState**(`message`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:97](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L97)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### useSiweAuth()

> **useSiweAuth**(): `object`

Defined in: [src/hooks/useSiweAuth.ts:397](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L397)

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

Defined in: [src/hooks/useSiweAuth.ts:333](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/hooks/useSiweAuth.ts#L333)

#### Parameters

##### token

`string` | `null`

#### Returns

`void`
