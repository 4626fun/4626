[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/apiBase

# src/lib/apiBase

## Type Aliases

### ApiFetchInit

> **ApiFetchInit** = `RequestInit` & `object`

Defined in: [src/lib/apiBase.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/apiBase.ts#L9)

#### Type Declaration

##### withCredentials?

> `optional` **withCredentials**: `boolean`

## Functions

### apiAliasPath()

> **apiAliasPath**(`path`): `string`

Defined in: [src/lib/apiBase.ts:16](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/apiBase.ts#L16)

#### Parameters

##### path

`string`

#### Returns

`string`

***

### apiFetch()

> **apiFetch**(`path`, `init`, `bases?`): `Promise`\<`Response`\>

Defined in: [src/lib/apiBase.ts:40](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/apiBase.ts#L40)

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
