[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/auth/\_shared

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

Defined in: [server/auth/\_shared.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L9)

##### details?

> `optional` **details**: `unknown`

Defined in: [server/auth/\_shared.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L13)

##### error?

> `optional` **error**: `string`

Defined in: [server/auth/\_shared.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L10)

##### message?

> `optional` **message**: `string`

Defined in: [server/auth/\_shared.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L12)

##### reason?

> `optional` **reason**: `string`

Defined in: [server/auth/\_shared.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L11)

##### success

> **success**: `boolean`

Defined in: [server/auth/\_shared.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L8)

***

### ParsedSiwe

> **ParsedSiwe** = `object`

Defined in: [server/auth/\_shared.ts:649](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L649)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:651](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L651)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:653](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L653)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:650](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L650)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:655](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L655)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:654](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L654)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:652](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L652)

## Variables

### COOKIE\_NONCE

> `const` **COOKIE\_NONCE**: `"cv_auth_nonce"` = `'cv_auth_nonce'`

Defined in: [server/auth/\_shared.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L16)

***

### COOKIE\_SESSION

> `const` **COOKIE\_SESSION**: `"cv_auth_session"` = `'cv_auth_session'`

Defined in: [server/auth/\_shared.ts:17](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L17)

## Functions

### clearCookie()

> **clearCookie**(`req`, `res`, `name`): `void`

Defined in: [server/auth/\_shared.ts:449](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L449)

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

Defined in: [server/auth/\_shared.ts:58](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L58)

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

Defined in: [server/auth/\_shared.ts:281](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L281)

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

Defined in: [server/auth/\_shared.ts:31](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L31)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:322](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L322)

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

Defined in: [server/auth/\_shared.ts:688](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L688)

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

Defined in: [server/auth/\_shared.ts:503](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L503)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:598](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L598)

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

Defined in: [server/auth/\_shared.ts:539](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L539)

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

Defined in: [server/auth/\_shared.ts:331](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L331)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:658](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L658)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readBoundedJsonObjectBody()

> **readBoundedJsonObjectBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:481](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L481)

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

Defined in: [server/auth/\_shared.ts:459](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L459)

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

Defined in: [server/auth/\_shared.ts:611](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L611)

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

Defined in: [server/auth/\_shared.ts:258](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L258)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:551](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L551)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:434](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L434)

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

Defined in: [server/auth/\_shared.ts:231](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L231)

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

Defined in: [server/auth/\_shared.ts:178](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L178)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`

***

### storeNonce()

> **storeNonce**(`db`, `nonce`, `expiresAt`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:50](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L50)

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

Defined in: [server/auth/\_shared.ts:697](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L697)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
