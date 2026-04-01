[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/auth/\_shared

# server/auth/\_shared

## Type Aliases

### ApiEnvelope

> **ApiEnvelope**\<`T`\> = `object`

Defined in: [server/auth/\_shared.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L6)

#### Type Parameters

##### T

`T`

#### Properties

##### data?

> `optional` **data**: `T`

Defined in: [server/auth/\_shared.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L6)

##### error?

> `optional` **error**: `string`

Defined in: [server/auth/\_shared.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L6)

##### success

> **success**: `boolean`

Defined in: [server/auth/\_shared.ts:6](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L6)

***

### ParsedSiwe

> **ParsedSiwe** = `object`

Defined in: [server/auth/\_shared.ts:492](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L492)

#### Properties

##### address

> **address**: `string`

Defined in: [server/auth/\_shared.ts:494](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L494)

##### chainId

> **chainId**: `number`

Defined in: [server/auth/\_shared.ts:496](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L496)

##### domain

> **domain**: `string`

Defined in: [server/auth/\_shared.ts:493](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L493)

##### issuedAt

> **issuedAt**: `string`

Defined in: [server/auth/\_shared.ts:498](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L498)

##### nonce

> **nonce**: `string`

Defined in: [server/auth/\_shared.ts:497](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L497)

##### uri

> **uri**: `string`

Defined in: [server/auth/\_shared.ts:495](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L495)

## Variables

### COOKIE\_NONCE

> `const` **COOKIE\_NONCE**: `"cv_auth_nonce"` = `'cv_auth_nonce'`

Defined in: [server/auth/\_shared.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L8)

***

### COOKIE\_SESSION

> `const` **COOKIE\_SESSION**: `"cv_auth_session"` = `'cv_auth_session'`

Defined in: [server/auth/\_shared.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L9)

## Functions

### clearCookie()

> **clearCookie**(`req`, `res`, `name`): `void`

Defined in: [server/auth/\_shared.ts:333](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L333)

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

Defined in: [server/auth/\_shared.ts:49](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L49)

#### Parameters

##### db

`DbWithSql`

##### nonce

`string`

#### Returns

`Promise`\<`boolean`\>

***

### ensureNonceSchema()

> **ensureNonceSchema**(`db`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L22)

#### Parameters

##### db

`DbWithSql`

#### Returns

`Promise`\<`void`\>

***

### handleOptions()

> **handleOptions**(`req`, `res`): `boolean`

Defined in: [server/auth/\_shared.ts:266](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L266)

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

Defined in: [server/auth/\_shared.ts:531](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L531)

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

Defined in: [server/auth/\_shared.ts:359](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L359)

#### Returns

`string`

***

### makeNonceToken()

> **makeNonceToken**(`params`): `string`

Defined in: [server/auth/\_shared.ts:447](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L447)

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

Defined in: [server/auth/\_shared.ts:391](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L391)

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

Defined in: [server/auth/\_shared.ts:275](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L275)

#### Parameters

##### req

`VercelRequest`

#### Returns

`Record`\<`string`, `string`\>

***

### parseSiweMessage()

> **parseSiweMessage**(`message`): [`ParsedSiwe`](#parsedsiwe) \| `null`

Defined in: [server/auth/\_shared.ts:501](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L501)

#### Parameters

##### message

`string`

#### Returns

[`ParsedSiwe`](#parsedsiwe) \| `null`

***

### readJsonBody()

> **readJsonBody**\<`T`\>(`req`, `opts`): `Promise`\<`T` \| `null`\>

Defined in: [server/auth/\_shared.ts:337](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L337)

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

Defined in: [server/auth/\_shared.ts:459](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L459)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `nonce`: `string`; \} \| `null`

***

### readSessionFromRequest()

> **readSessionFromRequest**(`req`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:246](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L246)

#### Parameters

##### req

`VercelRequest`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### readSessionToken()

> **readSessionToken**(`token`): \{ `address`: `string`; \} \| `null`

Defined in: [server/auth/\_shared.ts:403](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L403)

#### Parameters

##### token

`string` | `null` | `undefined`

#### Returns

\{ `address`: `string`; \} \| `null`

***

### setCookie()

> **setCookie**(`req`, `res`, `name`, `value`, `opts`): `void`

Defined in: [server/auth/\_shared.ts:318](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L318)

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

Defined in: [server/auth/\_shared.ts:222](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L222)

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

Defined in: [server/auth/\_shared.ts:169](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L169)

#### Parameters

##### res

`VercelResponse`

#### Returns

`void`

***

### storeNonce()

> **storeNonce**(`db`, `nonce`, `expiresAt`): `Promise`\<`void`\>

Defined in: [server/auth/\_shared.ts:41](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L41)

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

Defined in: [server/auth/\_shared.ts:540](https://github.com/wenakita/4626/blob/main/frontend/server/auth/_shared.ts#L540)

#### Parameters

##### params

###### message

`string`

###### signature

`string`

#### Returns

`Promise`\<\{ `address`: `string`; \} \| `null`\>
