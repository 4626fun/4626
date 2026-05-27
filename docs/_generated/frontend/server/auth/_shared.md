[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/auth/\_shared

# server/auth/\_shared

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L7)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L7)

##### error?

> `optional` **error**: `string`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L7)

##### success

> **success**: `boolean`

Defined in: [server/auth/\_shared.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L7)

***

### ParsedSiwe

> **ParsedSiwe** = `object`

Defined in: [server/auth/\_shared.ts:642](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L642)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:644](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L644)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:646](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L646)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:643](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L643)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:648](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L648)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:647](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L647)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:645](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L645)

## Variables

### COOKIE\_NONCE

> `const` **COOKIE\_NONCE**: `"cv_auth_nonce"` = `'cv_auth_nonce'`

Defined in: [server/auth/\_shared.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L9)

***

### COOKIE\_SESSION

> `const` **COOKIE\_SESSION**: `"cv_auth_session"` = `'cv_auth_session'`

Defined in: [server/auth/\_shared.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L10)

## Functions

### clearCookie()

> **clearCookie**(`req`, `res`, `name`): `void`

Defined in: [server/auth/\_shared.ts:442](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L442)

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

Defined in: [server/auth/\_shared.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L51)

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

Defined in: [server/auth/\_shared.ts:274](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L274)

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

Defined in: [server/auth/\_shared.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L24)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:315](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L315)

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

Defined in: [server/auth/\_shared.ts:681](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L681)

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

Defined in: [server/auth/\_shared.ts:496](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L496)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:591](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L591)

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

Defined in: [server/auth/\_shared.ts:532](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L532)

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

Defined in: [server/auth/\_shared.ts:324](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L324)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:651](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L651)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readBoundedJsonObjectBody()

> **readBoundedJsonObjectBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:474](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L474)

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

Defined in: [server/auth/\_shared.ts:452](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L452)

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

Defined in: [server/auth/\_shared.ts:604](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L604)

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

Defined in: [server/auth/\_shared.ts:251](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L251)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:544](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L544)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:427](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L427)

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

Defined in: [server/auth/\_shared.ts:224](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L224)

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

Defined in: [server/auth/\_shared.ts:171](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L171)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`

***

### storeNonce()

> **storeNonce**(`db`, `nonce`, `expiresAt`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L43)

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

Defined in: [server/auth/\_shared.ts:690](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/auth/_shared.ts#L690)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
