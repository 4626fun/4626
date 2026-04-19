[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_shared

# server/auth/\_shared

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L7)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L7)

##### error?

> `optional` **error**: `string`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L7)

##### success

> **success**: `boolean`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L7)

***

### ParsedSiwe

> **ParsedSiwe** = `object`

Defined in: [server/auth/\_shared.ts:572](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L572)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:574](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L574)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:576](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L576)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:573](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L573)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:578](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L578)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:577](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L577)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:575](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L575)

## Variables

### COOKIE\_NONCE

> `const` **COOKIE\_NONCE**: `"cv_auth_nonce"` = `'cv_auth_nonce'`

Defined in: [server/auth/\_shared.ts:9](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L9)

***

### COOKIE\_SESSION

> `const` **COOKIE\_SESSION**: `"cv_auth_session"` = `'cv_auth_session'`

Defined in: [server/auth/\_shared.ts:10](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L10)

## Functions

### clearCookie()

> **clearCookie**(`req`, `res`, `name`): `void`

Defined in: [server/auth/\_shared.ts:378](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L378)

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

Defined in: [server/auth/\_shared.ts:51](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L51)

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

Defined in: [server/auth/\_shared.ts:268](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L268)

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

Defined in: [server/auth/\_shared.ts:24](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L24)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:309](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L309)

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

Defined in: [server/auth/\_shared.ts:611](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L611)

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

Defined in: [server/auth/\_shared.ts:426](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L426)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:521](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L521)

A signed nonce token used when cookies are blocked (embedded contexts).
This mirrors the cookie nonce but is passed back explicitly by the client.

#### Parameters

##### params

###### ip?

`string`

###### nonce

`string`

###### now?

`number`

#### Returns

`string`

***

### makeSessionToken()

> **makeSessionToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:462](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L462)

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

Defined in: [server/auth/\_shared.ts:318](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L318)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:581](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L581)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readBoundedJsonObjectBody()

> **readBoundedJsonObjectBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:404](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L404)

#### Type Parameters

##### T

`T` *extends* `Record`\<`string`, `unknown`\> = `Record`\<`string`, `unknown`\>

#### Parameters

##### req

`VercelRequest`

##### opts

###### maxBytes?

`number`

#### Returns

`Promise`\<`T` \| `null`\>

***

### readJsonBody()

> **readJsonBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:382](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L382)

#### Type Parameters

##### T

`T` = `any`

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

> **readNonceToken**(`token`, `opts?`): \{ `nonce`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:534](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L534)

#### Parameters

##### token

`string` | `null` | `undefined`

##### opts?

###### ip?

`string`

#### Returns

\{ `nonce`: `string`; \} \| `null`

***

### readSessionFromRequest()

> **readSessionFromRequest**(`req`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:248](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L248)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:474](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L474)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:361](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L361)

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

Defined in: [server/auth/\_shared.ts:224](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L224)

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

Defined in: [server/auth/\_shared.ts:171](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L171)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`

***

### storeNonce()

> **storeNonce**(`db`, `nonce`, `expiresAt`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:43](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L43)

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

Defined in: [server/auth/\_shared.ts:620](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/auth/_shared.ts#L620)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
