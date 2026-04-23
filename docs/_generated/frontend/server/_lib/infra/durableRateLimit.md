[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/infra/durableRateLimit

# server/\_lib/infra/durableRateLimit

## Type Aliases

### DurableRateLimitOptions

> **DurableRateLimitOptions** = `object`

Defined in: [server/\_lib/infra/durableRateLimit.ts:64](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/durableRateLimit.ts#L64)

#### Properties

##### failClosed?

> `optional` **failClosed**: `boolean`

Defined in: [server/\_lib/infra/durableRateLimit.ts:72](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/durableRateLimit.ts#L72)

When true, do NOT fall back to the in-memory limiter if Postgres is
unavailable or the query fails — instead deny the request. This is
mandatory for security-sensitive gates (auth, deploy-create, agent
writes) where a memory fallback is trivially bypassed across serverless
instances (H-07 / 4626-299).

***

### DurableRateLimitResult

> **DurableRateLimitResult** = [`RateLimitResult`](rateLimit.md#ratelimitresult) & `object`

Defined in: [server/\_lib/infra/durableRateLimit.ts:62](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/durableRateLimit.ts#L62)

#### Type Declaration

##### source

> **source**: `"db"` \| `"memory"` \| `"fail-closed"`

## Functions

### checkDurableRateLimit()

> **checkDurableRateLimit**(`key`, `config`, `options`): `Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>

Defined in: [server/\_lib/infra/durableRateLimit.ts:89](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/infra/durableRateLimit.ts#L89)

Durable rate limit using Postgres when configured.
Falls back to in-memory limiter if DB is unavailable, unless the caller
passes `failClosed: true` — in which case we deny the request.

#### Parameters

##### key

`string`

##### config

[`RateLimitConfig`](rateLimit.md#ratelimitconfig)

##### options

[`DurableRateLimitOptions`](#durableratelimitoptions) = `{}`

#### Returns

`Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>
