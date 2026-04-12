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

Defined in: [server/auth/\_shared.ts:556](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L556)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:558](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L558)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:560](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L560)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:557](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L557)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:562](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L562)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:561](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L561)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:559](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L559)

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

Defined in: [server/auth/\_shared.ts:375](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L375)

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

Defined in: [server/auth/\_shared.ts:308](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L308)

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

Defined in: [server/auth/\_shared.ts:595](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L595)

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

Defined in: [server/auth/\_shared.ts:423](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L423)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:511](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L511)

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

Defined in: [server/auth/\_shared.ts:455](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L455)

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

Defined in: [server/auth/\_shared.ts:317](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L317)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:565](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L565)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readBoundedJsonObjectBody()

> **readBoundedJsonObjectBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:401](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L401)

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

Defined in: [server/auth/\_shared.ts:379](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L379)

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

> **readNonceToken**(`token`): \{ `nonce`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:523](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L523)

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

Defined in: [server/auth/\_shared.ts:467](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L467)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:360](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L360)

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

Defined in: [server/auth/\_shared.ts:604](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L604)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
