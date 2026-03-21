[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/server/\_lib/rateLimit

# api/server/\_lib/rateLimit

## Type Aliases

### RateLimitConfig

> **RateLimitConfig** = `object`

Defined in: [server/\_lib/rateLimit.ts:30](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L30)

#### Properties

##### maxRequests

> **maxRequests**: `number`

Defined in: [server/\_lib/rateLimit.ts:32](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L32)

##### windowMs

> **windowMs**: `number`

Defined in: [server/\_lib/rateLimit.ts:31](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L31)

***

### RateLimitResult

> **RateLimitResult** = `object`

Defined in: [server/\_lib/rateLimit.ts:35](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L35)

#### Properties

##### allowed

> **allowed**: `boolean`

Defined in: [server/\_lib/rateLimit.ts:36](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L36)

##### remaining

> **remaining**: `number`

Defined in: [server/\_lib/rateLimit.ts:37](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L37)

##### resetAt

> **resetAt**: `number`

Defined in: [server/\_lib/rateLimit.ts:38](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L38)

## Variables

### RATE\_LIMITS

> `const` **RATE\_LIMITS**: `object`

Defined in: [server/\_lib/rateLimit.ts:79](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L79)

#### Type Declaration

##### adminAction

> `readonly` **adminAction**: `object`

###### adminAction.maxRequests

> `readonly` **maxRequests**: `30` = `30`

###### adminAction.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### cswLink

> `readonly` **cswLink**: `object`

###### cswLink.maxRequests

> `readonly` **maxRequests**: `10` = `10`

###### cswLink.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### deployCreate

> `readonly` **deployCreate**: `object`

###### deployCreate.maxRequests

> `readonly` **maxRequests**: `3` = `3`

###### deployCreate.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### general

> `readonly` **general**: `object`

###### general.maxRequests

> `readonly` **maxRequests**: `60` = `60`

###### general.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

##### waitlistSignup

> `readonly` **waitlistSignup**: `object`

###### waitlistSignup.maxRequests

> `readonly` **maxRequests**: `5` = `5`

###### waitlistSignup.windowMs

> `readonly` **windowMs**: `60000` = `60_000`

## Functions

### checkRateLimit()

> **checkRateLimit**(`key`, `config`): [`RateLimitResult`](#ratelimitresult)

Defined in: [server/\_lib/rateLimit.ts:45](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L45)

Check if a key is rate limited.
Returns whether the request is allowed and remaining quota.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](#ratelimitconfig)

#### Returns

[`RateLimitResult`](#ratelimitresult)

***

### getClientIp()

> **getClientIp**(`req`): `string`

Defined in: [server/\_lib/rateLimit.ts:95](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L95)

Helper to get client IP from request headers.

#### Parameters

##### req

###### headers?

`Record`\<`string`, `any`\>

#### Returns

`string`

***

### rateLimitKey()

> **rateLimitKey**(...`parts`): `string`

Defined in: [server/\_lib/rateLimit.ts:111](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/rateLimit.ts#L111)

Build a rate limit key from components.

#### Parameters

##### parts

...`string`[]

#### Returns

`string`
