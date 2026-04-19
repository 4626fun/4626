[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/durableRateLimit

# server/\_lib/infra/durableRateLimit

## Type Aliases

### DurableRateLimitResult

> **DurableRateLimitResult** = [`RateLimitResult`](rateLimit.md#ratelimitresult) & `object`

Defined in: [server/\_lib/infra/durableRateLimit.ts:54](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/durableRateLimit.ts#L54)

#### Type Declaration

##### source

> **source**: `"db"` \| `"memory"`

## Functions

### checkDurableRateLimit()

> **checkDurableRateLimit**(`key`, `config`): `Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>

Defined in: [server/\_lib/infra/durableRateLimit.ts:60](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/infra/durableRateLimit.ts#L60)

Durable rate limit using Postgres when configured.
Falls back to in-memory limiter if DB is unavailable.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](rateLimit.md#ratelimitconfig)

#### Returns

`Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>
