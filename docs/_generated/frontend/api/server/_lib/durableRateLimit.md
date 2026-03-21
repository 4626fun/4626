[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/server/\_lib/durableRateLimit

# api/server/\_lib/durableRateLimit

## Type Aliases

### DurableRateLimitResult

> **DurableRateLimitResult** = [`RateLimitResult`](rateLimit.md#ratelimitresult) & `object`

Defined in: [server/\_lib/durableRateLimit.ts:38](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/durableRateLimit.ts#L38)

#### Type Declaration

##### source

> **source**: `"db"` \| `"memory"`

## Functions

### checkDurableRateLimit()

> **checkDurableRateLimit**(`key`, `config`): `Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>

Defined in: [server/\_lib/durableRateLimit.ts:44](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/server/_lib/durableRateLimit.ts#L44)

Durable rate limit using Postgres when configured.
Falls back to in-memory limiter if DB is unavailable.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](rateLimit.md#ratelimitconfig)

#### Returns

`Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>
