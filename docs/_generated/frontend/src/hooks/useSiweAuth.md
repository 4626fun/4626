[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/hooks/useSiweAuth

# src/hooks/useSiweAuth

## Variables

### PRIVY\_INTERACTIVE\_LOGIN\_METHODS

> `const` **PRIVY\_INTERACTIVE\_LOGIN\_METHODS**: readonly \[`"email"`, `"wallet"`\]

Defined in: [src/hooks/useSiweAuth.ts:37](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSiweAuth.ts#L37)

Explicit user-initiated Privy sign-in should prefer identity-first methods.
Wallet-first in this path can accidentally create a new Privy identity and
then collide with an existing email-bound account.

## Functions

### deriveSiweSessionState()

> **deriveSiweSessionState**(`input`): `DerivedSiweSessionState`

Defined in: [src/hooks/useSiweAuth.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSiweAuth.ts#L79)

#### Parameters

##### input

`DerivedSiweSessionStateInput`

#### Returns

`DerivedSiweSessionState`

***

### shouldResetPrivyBridgeState()

> **shouldResetPrivyBridgeState**(`message`): `boolean`

Defined in: [src/hooks/useSiweAuth.ts:68](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSiweAuth.ts#L68)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### useSiweAuth()

> **useSiweAuth**(): `object`

Defined in: [src/hooks/useSiweAuth.ts:191](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSiweAuth.ts#L191)

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

> **signInWithPrivyToken**: (`privyAccessToken`) => `Promise`\<`string` \| `null`\>

###### Parameters

###### privyAccessToken

`string` | `null`

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

Defined in: [src/hooks/useSiweAuth.ts:129](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/hooks/useSiweAuth.ts#L129)

#### Parameters

##### token

`string` | `null`

#### Returns

`void`
