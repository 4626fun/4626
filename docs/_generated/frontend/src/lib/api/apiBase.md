[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/api/apiBase

# src/lib/api/apiBase

## Type Aliases

### ApiFetchInit

> **ApiFetchInit** = `RequestInit` & `object`

Defined in: [src/lib/api/apiBase.ts:9](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/apiBase.ts#L9)

#### Type Declaration

##### withCredentials?

> `optional` **withCredentials**: `boolean`

## Functions

### apiAliasPath()

> **apiAliasPath**(`path`): `string`

Defined in: [src/lib/api/apiBase.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/apiBase.ts#L16)

#### Parameters

##### path

`string`

#### Returns

`string`

***

### apiFetch()

> **apiFetch**(`path`, `init`, `bases?`): `Promise`\<`Response`\>

Defined in: [src/lib/api/apiBase.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/api/apiBase.ts#L61)

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
