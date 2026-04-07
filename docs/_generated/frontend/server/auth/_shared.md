[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_shared

# server/auth/\_shared

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L7)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L7)

##### error?

> `optional` **error**: `string`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L7)

##### success

> **success**: `boolean`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L7)

***

### ParsedSiwe

> **ParsedSiwe** = `object`

Defined in: [server/auth/\_shared.ts:524](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L524)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:526](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L526)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:528](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L528)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:525](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L525)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:530](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L530)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:529](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L529)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:527](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L527)

## Variables

### COOKIE\_NONCE

> `const` **COOKIE\_NONCE**: `"cv_auth_nonce"` = `'cv_auth_nonce'`

Defined in: [server/auth/\_shared.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L9)

***

### COOKIE\_SESSION

> `const` **COOKIE\_SESSION**: `"cv_auth_session"` = `'cv_auth_session'`

Defined in: [server/auth/\_shared.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L10)

## Functions

### clearCookie()

> **clearCookie**(`req`, `res`, `name`): `void`

Defined in: [server/auth/\_shared.ts:365](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L365)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

##### name

`string`

#### Returns

`void`

***

### consumeNonce()

> **consumeNonce**(`db`, `nonce`): `Promise`\<`boolean`\>

Defined in: [server/auth/\_shared.ts:51](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L51)

#### Parameters

##### db

`DbWithSql`

##### nonce

`string`

#### Returns

`Promise`\<`boolean`\>

***

### enforceCookieSessionTrustedOrigin()

> **enforceCookieSessionTrustedOrigin**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:268](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L268)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`

***

### ensureNonceSchema()

> **ensureNonceSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L24)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:298](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L298)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`boolean`

***

### hostMatchesDomain()

> **hostMatchesDomain**(`host`, `domain`): `boolean`

Defined in: [server/auth/\_shared.ts:563](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L563)

#### Parameters

##### host

`string`

##### domain

`string`

#### Returns

`boolean`

***

### makeNonce()

> **makeNonce**(): `string`

Defined in: [server/auth/\_shared.ts:391](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L391)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:479](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L479)

A signed nonce token used when cookies are blocked (embedded contexts).
This mirrors the cookie nonce but is passed back explicitly by the client.

#### Parameters

##### params

###### nonce

`string`

###### now?

`number`

#### Returns

`string`

***

### makeSessionToken()

> **makeSessionToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:423](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L423)

#### Parameters

##### params

###### address

`string`

###### now?

`number`

#### Returns

`string`

***

### parseCookies()

> **parseCookies**(`req`): `Record`\<`string`, `string`\>

Defined in: [server/auth/\_shared.ts:307](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L307)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:533](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L533)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readJsonBody()

> **readJsonBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:369](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L369)

#### Type Parameters

##### T

`T`

#### Parameters

##### req

`VercelRequest`

##### opts

###### maxBytes?

`number`

#### Returns

`Promise`\<`T` \| `null`\>

***

### readNonceToken()

> **readNonceToken**(`token`): \{ `nonce`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:491](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L491)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `nonce`: `string`; \} \| `null`

***

### readSessionFromRequest()

> **readSessionFromRequest**(`req`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:248](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L248)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:435](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L435)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:350](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L350)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

##### name

`string`

##### value

`string`

##### opts

###### httpOnly?

`boolean`

###### maxAgeSeconds?

`number`

#### Returns

`void`

***

### setCors()

> **setCors**(`req`, `res`): `void`

Defined in: [server/auth/\_shared.ts:224](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L224)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`void`

***

### setNoStore()

> **setNoStore**(`res`): `void`

Defined in: [server/auth/\_shared.ts:171](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L171)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`

***

### storeNonce()

> **storeNonce**(`db`, `nonce`, `expiresAt`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:43](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L43)

#### Parameters

##### db

`DbWithSql`

##### nonce

`string`

##### expiresAt

`Date`

#### Returns

`Promise`\<`void`\>

***

### verifySiweSignature()

> **verifySiweSignature**(`params`): `Promise`\<\{ `address`: `string`; \} \| `null`\>

Defined in: [server/auth/\_shared.ts:572](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L572)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
