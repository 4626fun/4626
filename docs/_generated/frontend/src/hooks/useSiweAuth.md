[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / src/hooks/useSiweAuth

# src/hooks/useSiweAuth

## Variables

### PRIVY\_INTERACTIVE\_LOGIN\_METHODS

> `const` **PRIVY\_INTERACTIVE\_LOGIN\_METHODS**: readonly \[`"email"`, `"wallet"`\]

Defined in: [src/hooks/useSiweAuth.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L46)

Explicit user-initiated Privy sign-in should prefer identity-first methods.
Wallet-first in this path can accidentally create a new Privy identity and
then collide with an existing email-bound account.

## Functions

### deriveInitialAuthSessionState()

> **deriveInitialAuthSessionState**(`input`): `object`

Defined in: [src/hooks/useSiweAuth.ts:69](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L69)

#### Parameters

##### input

###### address

`string` \| `null` \| `undefined`

###### now

`number`

###### resolvedAt

`number`

###### ttlMs?

`number`

#### Returns

`object`

##### authAddress

> **authAddress**: `string` \| `null`

##### sessionHydrated

> **sessionHydrated**: `boolean`

***

### deriveSiweSessionState()

> **deriveSiweSessionState**(`input`): `DerivedSiweSessionState`

Defined in: [src/hooks/useSiweAuth.ts:165](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L165)

#### Parameters

##### input

`DerivedSiweSessionStateInput`

#### Returns

`DerivedSiweSessionState`

***

### shouldAutoBridgeConnectedPrivySession()

> **shouldAutoBridgeConnectedPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:195](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L195)

#### Parameters

##### input

`ShouldAutoBridgeConnectedPrivySessionInput`

#### Returns

`boolean`

***

### shouldAutoBridgeRestoredPrivySession()

> **shouldAutoBridgeRestoredPrivySession**(`input`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:220](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L220)

#### Parameters

##### input

`ShouldAutoBridgeRestoredPrivySessionInput`

#### Returns

`boolean`

***

### shouldResetPrivyBridgeState()

> **shouldResetPrivyBridgeState**(`message`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:154](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L154)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### useSiweAuth()

> **useSiweAuth**(): `object`

Defined in: [src/hooks/useSiweAuth.ts:449](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L449)

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

###### preferBaseAccountWallet?

`boolean`

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

Defined in: [src/hooks/useSiweAuth.ts:385](https://github.com/wenakita/4626/blob/main/frontend/src/hooks/useSiweAuth.ts#L385)

#### Parameters

##### token

`string` | `null`

#### Returns

`void`
