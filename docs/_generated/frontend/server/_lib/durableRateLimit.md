[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/durableRateLimit

# server/\_lib/durableRateLimit

## Type Aliases

### DurableRateLimitResult

> **DurableRateLimitResult** = [`RateLimitResult`](rateLimit.md#ratelimitresult) & `object`

Defined in: [server/\_lib/durableRateLimit.ts:54](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/durableRateLimit.ts#L54)

#### Type Declaration

##### source

> **source**: `"db"` \| `"memory"`

## Functions

### checkDurableRateLimit()

> **checkDurableRateLimit**(`key`, `config`): `Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>

Defined in: [server/\_lib/durableRateLimit.ts:60](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/durableRateLimit.ts#L60)

Durable rate limit using Postgres when configured.
Falls back to in-memory limiter if DB is unavailable.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](rateLimit.md#ratelimitconfig)

#### Returns

`Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>
