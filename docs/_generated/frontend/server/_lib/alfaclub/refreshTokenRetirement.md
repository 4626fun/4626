[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/refreshTokenRetirement

# server/\_lib/alfaclub/refreshTokenRetirement

## Type Aliases

### RefreshTokenSeedRejectReason

> **RefreshTokenSeedRejectReason** = `"stale_refresh_token"`

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L17)

## Functions

### \_clearRetiredRefreshFingerprintsForTests()

> **\_clearRetiredRefreshFingerprintsForTests**(): `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:160](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L160)

Test-only reset.

#### Returns

`Promise`\<`void`\>

***

### assertRefreshTokenSeedAllowed()

> **assertRefreshTokenSeedAllowed**(`candidateRefreshToken`): `Promise`\<\{ `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"stale_refresh_token"`; \}\>

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L133)

#### Parameters

##### candidateRefreshToken

`string`

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"stale_refresh_token"`; \}\>

***

### evaluateRefreshTokenSeed()

> **evaluateRefreshTokenSeed**(`params`): \{ `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"stale_refresh_token"`; \}

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:114](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L114)

Pure seed guard — unit-tested without DB.

#### Parameters

##### params

###### candidateFingerprint

`string`

###### liveRefreshFingerprint

`string` \| `null`

###### retiredFingerprints

`string`[]

#### Returns

\{ `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: `"stale_refresh_token"`; \}

***

### fingerprintRefreshToken()

> **fingerprintRefreshToken**(`token`): `string`

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L19)

#### Parameters

##### token

`string`

#### Returns

`string`

***

### recordRetiredRefreshToken()

> **recordRetiredRefreshToken**(`refreshToken`): `Promise`\<`void`\>

Defined in: [server/\_lib/alfaclub/refreshTokenRetirement.ts:98](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/refreshTokenRetirement.ts#L98)

Record a refresh token that Privy rotated away from. Best-effort — never
blocks the refresher write path.

#### Parameters

##### refreshToken

`string`

#### Returns

`Promise`\<`void`\>
