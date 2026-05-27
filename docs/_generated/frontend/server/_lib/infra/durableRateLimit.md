[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/infra/durableRateLimit

# server/\_lib/infra/durableRateLimit

## Type Aliases

### DurableRateLimitOptions

> **DurableRateLimitOptions** = `object`

Defined in: [server/\_lib/infra/durableRateLimit.ts:63](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/durableRateLimit.ts#L63)

#### Properties

##### failClosed?

> `optional` **failClosed**: `boolean`

Defined in: [server/\_lib/infra/durableRateLimit.ts:71](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/durableRateLimit.ts#L71)

When true, do NOT fall back to the in-memory limiter if Postgres is
unavailable or the query fails — instead deny the request. This is
mandatory for security-sensitive gates (auth, deploy-create, agent
writes) where a memory fallback is trivially bypassed across serverless
instances (H-07 / 4626-299).

***

### DurableRateLimitResult

> **DurableRateLimitResult** = [`RateLimitResult`](rateLimit.md#ratelimitresult) & `object`

Defined in: [server/\_lib/infra/durableRateLimit.ts:61](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/durableRateLimit.ts#L61)

#### Type Declaration

##### source

> **source**: `"db"` \| `"memory"` \| `"fail-closed"`

## Functions

### checkDurableRateLimit()

> **checkDurableRateLimit**(`key`, `config`, `options`): `Promise`\<[`DurableRateLimitResult`](#durableratelimitresult)\>

Defined in: [server/\_lib/infra/durableRateLimit.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/infra/durableRateLimit.ts#L88)

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
