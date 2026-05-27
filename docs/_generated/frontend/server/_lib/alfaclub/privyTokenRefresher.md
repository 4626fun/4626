[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/privyTokenRefresher

# server/\_lib/alfaclub/privyTokenRefresher

## Interfaces

### AlfaClubRefresherDependencies

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:218](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L218)

#### Properties

##### log?

> `optional` **log**: `Pick`\<[`Logger`](../infra/logger.md#logger), `"error"` \| `"warn"` \| `"info"`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:245](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L245)

Override logger — swapped in tests.

##### nearExpiryWindowMs?

> `optional` **nearExpiryWindowMs**: `number`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:249](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L249)

Override the near-expiry window — tests.

##### now()?

> `optional` **now**: () => `number`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:247](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L247)

`Date.now()` override for tests.

###### Returns

`number`

##### readAccessToken()?

> `optional` **readAccessToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:220](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L220)

Getter for current access token — DB first, env fallback.

###### Returns

`Promise`\<`string` \| `null`\>

##### readIdentityToken()?

> `optional` **readIdentityToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:224](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L224)

Getter for current identity token — used only to decide "is it near expiry?"

###### Returns

`Promise`\<`string` \| `null`\>

##### readRefreshToken()?

> `optional` **readRefreshToken**: () => `Promise`\<`string` \| `null`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:222](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L222)

Getter for current refresh token — DB first, env fallback.

###### Returns

`Promise`\<`string` \| `null`\>

##### recordFailure()?

> `optional` **recordFailure**: (`payload`, `writer`) => `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:256](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L256)

###### Parameters

###### payload

[`RefreshFailurePayload`](authHealthStore.md#refreshfailurepayload)

###### writer

`string`

###### Returns

`Promise`\<`boolean`\>

##### recordSuccess()?

> `optional` **recordSuccess**: (`payload`) => `Promise`\<`boolean`\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:255](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L255)

Health-row writers. Default to the live store; tests inject no-ops or
spies. Health writes are best-effort and never throw out of the
refresher — failure to persist health does NOT change refresh outcome.

###### Parameters

###### payload

[`RefreshSuccessPayload`](authHealthStore.md#refreshsuccesspayload)

###### Returns

`Promise`\<`boolean`\>

##### refresh()?

> `optional` **refresh**: (`params`) => `Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:240](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L240)

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

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:234](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L234)

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

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:530](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L530)

#### Properties

##### reason?

> `optional` **reason**: `"disabled"`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:537](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L537)

Populated when `started` is false. Currently `disabled` (env gate off).

##### runNow()

> **runNow**: () => `Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:532](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L532)

###### Returns

`Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

##### started

> **started**: `boolean`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:535](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L535)

True when the in-process loop is actually running. False when an env
 gate left the loop disabled. Always present so callers can log it.

##### stop()

> **stop**: () => `void`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:531](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L531)

###### Returns

`void`

***

### PrivyRefreshBundle

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L106)

#### Properties

##### accessToken

> **accessToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L107)

##### identityToken

> **identityToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L108)

##### refreshToken

> **refreshToken**: `string`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L109)

***

### PrivyRefreshResponse

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L129)

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

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L131)

##### privy\_access\_token?

> `optional` **privy\_access\_token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L130)

##### refresh\_token?

> `optional` **refresh\_token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L132)

##### token?

> `optional` **token**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L133)

## Type Aliases

### AlfaClubRefresherOutcome

> **AlfaClubRefresherOutcome** = \{ `identityTokenExp`: `number` \| `null`; `status`: `"refreshed"`; \} \| \{ `msUntilDue`: `number`; `status`: `"not_due"`; \} \| \{ `missing`: `string`[]; `status`: `"missing_tokens"`; \} \| \{ `error`: `string`; `status`: `"error"`; \}

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:382](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L382)

## Functions

### \_resetImmediatePrivyRefreshForTests()

> **\_resetImmediatePrivyRefreshForTests**(): `void`

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:641](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L641)

#### Returns

`void`

***

### refreshPrivySession()

> **refreshPrivySession**(`params`): `Promise`\<[`PrivyRefreshBundle`](#privyrefreshbundle)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:149](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L149)

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

### requestImmediatePrivyRefresh()

> **requestImmediatePrivyRefresh**(`reason`): `Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome) \| \{ `kind`: `"throttled"`; \}\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:513](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L513)

#### Parameters

##### reason

`"bridge_auth_fail"` | `"manual"`

#### Returns

`Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome) \| \{ `kind`: `"throttled"`; \}\>

***

### runAlfaClubPrivyRefreshOnce()

> **runAlfaClubPrivyRefreshOnce**(`deps`, `opts`): `Promise`\<[`AlfaClubRefresherOutcome`](#alfaclubrefresheroutcome)\>

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:392](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L392)

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

Defined in: [server/\_lib/alfaclub/privyTokenRefresher.ts:569](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/privyTokenRefresher.ts#L569)

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
