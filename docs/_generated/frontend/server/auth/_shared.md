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

Defined in: [server/auth/\_shared.ts:575](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L575)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:577](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L577)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:579](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L579)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:576](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L576)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:581](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L581)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:580](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L580)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:578](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L578)

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

Defined in: [server/auth/\_shared.ts:381](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L381)

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

Defined in: [server/auth/\_shared.ts:271](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L271)

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

Defined in: [server/auth/\_shared.ts:312](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L312)

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

Defined in: [server/auth/\_shared.ts:614](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L614)

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

Defined in: [server/auth/\_shared.ts:429](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L429)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:524](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L524)

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

Defined in: [server/auth/\_shared.ts:465](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L465)

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

Defined in: [server/auth/\_shared.ts:321](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L321)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:584](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L584)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readBoundedJsonObjectBody()

> **readBoundedJsonObjectBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:407](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L407)

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

Defined in: [server/auth/\_shared.ts:385](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L385)

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

Defined in: [server/auth/\_shared.ts:537](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L537)

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

Defined in: [server/auth/\_shared.ts:251](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L251)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:477](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L477)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:364](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L364)

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

Defined in: [server/auth/\_shared.ts:623](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L623)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
