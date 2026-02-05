[**creatorvault-miniapp**](../../index.md)

***

[creatorvault-miniapp](../../index.md) / src/lib/apiBase

# src/lib/apiBase

## Type Aliases

### ApiFetchInit

> **ApiFetchInit** = `RequestInit` & `object`

Defined in: [lib/apiBase.ts:7](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/apiBase.ts#L7)

#### Type Declaration

##### withCredentials?

> `optional` **withCredentials**: `boolean`

## Functions

### apiAliasPath()

> **apiAliasPath**(`path`): `string`

Defined in: [lib/apiBase.ts:14](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/apiBase.ts#L14)

#### Parameters

##### path

`string`

#### Returns

`string`

***

### apiFetch()

> **apiFetch**(`path`, `init`, `bases?`): `Promise`\<`Response`\>

Defined in: [lib/apiBase.ts:38](https://github.com/wenakita/4626/blob/a4870e3896f63a65e31b8609af0074d6dc90b03a/frontend/src/lib/apiBase.ts#L38)

Fetch an API route with a best-effort alias fallback:
- try `/__api/*` first (to avoid extension blocks on `/api/*`)
- then fall back to `/api/*`

If `bases` is provided, the function will try each base origin in order.

#### Parameters

##### path

`string`

##### init

[`ApiFetchInit`](#apifetchinit) = `{}`

##### bases?

`string`[]

#### Returns

`Promise`\<`Response`\>
