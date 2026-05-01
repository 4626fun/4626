[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/alfaclub/privyTokenRefresher

# server/\_lib/alfaclub/privyTokenRefresher

## Interfaces

### AlfaClubRefresherDependencies

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:212](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L212)

#### Properties

##### log?

> `optional` **log**: `Pick`\<[`Logger`](../infra/logger.md#logger), `"error"` \| `"info"` \| `"warn"`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:239](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L239)

Override logger — swapped in tests.

##### nearExpiryWindowMs?

> `optional` **nearExpiryWindowMs**: `number`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:243](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L243)

Override the near-expiry window — tests.

##### now()?

> `optional` **now**: () => `number`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:241](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L241)

`Date.now()` override for tests.

###### Returns

`number`

##### readAccessToken()?

> `optional` **readAccessToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:214](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L214)

Getter for current access token — DB first, env fallback.

###### Returns

`Promise`\<`string` \| `null`\>

##### readIdentityToken()?

> `optional` **readIdentityToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:218](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L218)

Getter for current identity token — used only to decide "is it near expiry?"

###### Returns

`Promise`\<`string` \| `null`\>

##### readRefreshToken()?

> `optional` **readRefreshToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:216](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L216)

Getter for current refresh token — DB first, env fallback.

###### Returns

`Promise`\<`string` \| `null`\>

##### refresh()?

> `optional` **refresh**: (`params`) => `Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:234](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L234)

Override the actual Privy call — swapped in tests.

###### Parameters

###### params

###### accessToken

`string`

###### refreshToken

`string`

###### Returns

`Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

##### writeBundle()?

> `optional` **writeBundle**: (`bundle`, `updatedBy`, `inbound?`) => `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:228](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L228)

Persists the fresh triplet once a refresh succeeds. `inbound` carries the
pre-refresh access/refresh tokens so the writer can skip rows that did not
actually rotate (Privy returns null on those fields when it kept the
existing credential alive — see `refreshPrivySession`). Skipping unchanged
rows avoids unnecessary writes that can fail on roles with SELECT-only
grants on `alfaclub_runtime_secret` while still letting the identity-token
write — which always rotates — surface a real persistence failure.

###### Parameters

###### bundle

[`PrivyRefreshBundle`](#privyrefreshbundle)

###### updatedBy

`string`

###### inbound?

###### accessToken

`string`

###### refreshToken

`string`

###### Returns

`Promise`\<`void`\>

***

### AlfaClubRefresherHandle

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:425](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L425)

#### Properties

##### reason?

> `optional` **reason**: `"disabled"`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:432](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L432)

Populated when `started` is false. Currently `disabled` (env gate off).

##### runNow()

> **runNow**: () => `Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:427](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L427)

###### Returns

`Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:430](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L430)

True when the in-process loop is actually running. False when an env
 gate left the loop disabled. Always present so callers can log it.

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:426](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L426)

###### Returns

`void`

***

### PrivyRefreshBundle

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:100](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L100)

#### Properties

##### accessToken

> **accessToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:101](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L101)

##### identityToken

> **identityToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:102](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L102)

##### refreshToken

> **refreshToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:103](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L103)

***

### PrivyRefreshResponse

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:123](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L123)

Shape of `POST https://auth.privy.io/api/v1/sessions` 2xx response, as
documented by Privy's own `@privy-io/react-auth` SDK type
`ValidSessionResponse`. Notable nullability:

 - `privy_access_token` and `refresh_token` may be `string | null` —
   Privy treats null here as "we did not rotate this credential, keep
   using the previous one." Production has been observed to return
   `privy_access_token: null` while still rotating the identity token.
 - `identity_token` is OPTIONAL (often omitted) — when absent the same
   identity-token JWT is carried by the top-level `token` field.

The refresher accepts either `identity_token` or `token` for the JWT,
and falls back to the inbound access/refresh tokens when Privy returns
null/missing values for them, so it does not misclassify a valid Privy
response as `malformed_response`.

#### Properties

##### identity\_token?

> `optional` **identity\_token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:125](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L125)

##### privy\_access\_token?

> `optional` **privy\_access\_token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:124](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L124)

##### refresh\_token?

> `optional` **refresh\_token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:126](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L126)

##### token?

> `optional` **token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:127](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L127)

## Type Aliases

### AlfaClubRefresherOutcome

> **AlfaClubRefresherOutcome** = \{ `identityTokenExp`: `number` \| `null`; `status`: `"refreshed"`; \} \| \{ `msUntilDue`: `number`; `status`: `"not_due"`; \} \| \{ `missing`: `string`[]; `status`: `"missing_tokens"`; \} \| \{ `error`: `string`; `status`: `"error"`; \}

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:362](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L362)

## Functions

### refreshPrivySession()

> **refreshPrivySession**(`params`): `Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L143)

Hits Privy's session-refresh endpoint and returns the new token bundle.
Throws on non-2xx or malformed response. Callers are responsible for
persisting the returned bundle.

#### Parameters

##### params

###### accessToken

`string`

###### appId?

`string`

###### origin?

`string`

###### refreshToken

`string`

#### Returns

`Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

***

### runAlfaClubPrivyRefreshOnce()

> **runAlfaClubPrivyRefreshOnce**(`deps`, `opts`): `Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:368](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L368)

#### Parameters

##### deps

[`AlfaClubRefresherDependencies`](#alfaclubrefresherdependencies) = `{}`

##### opts

###### force?

`boolean`

#### Returns

`Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

***

### startAlfaClubPrivyTokenRefresher()

> **startAlfaClubPrivyTokenRefresher**(`opts?`): [`AlfaClubRefresherHandle`](#alfaclubrefresherhandle)

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:464](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L464)

Starts the background refresher. Returns a handle with `stop()` and
`runNow()`. Fires once immediately (to bootstrap env → DB on first run
and to self-heal if the agent booted near a token expiry) then on a
fixed interval.

Gated by `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` (default off) so a
Railway-hosted agent does not silently compete with the canonical
Vercel cron writer for the same DB slot. The gate can be bypassed by
passing `opts.force = true` from a test.

#### Parameters

##### opts?

###### deps?

[`AlfaClubRefresherDependencies`](#alfaclubrefresherdependencies)

###### force?

`boolean`

Bypasses the `ALFACLUB_CHAT_PRIVY_REFRESHER_ENABLED` env gate. Tests
 set this so they can exercise tick behavior without depending on the
 process env. Production callers should never set this.

###### intervalMs?

`number`

#### Returns

[`AlfaClubRefresherHandle`](#alfaclubrefresherhandle)
