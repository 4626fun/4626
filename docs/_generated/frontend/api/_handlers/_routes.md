[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_routes

# api/\_handlers/\_routes

## Type Aliases

### ApiHandler()

> **ApiHandler** = (`req`, `res`) => `unknown` \| `Promise`\<`unknown`\>

Defined in: [api/\_handlers/\_routes.ts:3](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/_routes.ts#L3)

#### Parameters

##### req

[`VercelRequest`](../../src/types/vercel-node.md#vercelrequest)

##### res

[`VercelResponse`](../../src/types/vercel-node.md#vercelresponse)

#### Returns

`unknown` \| `Promise`\<`unknown`\>

## Variables

### apiRouteLoaders

> `const` **apiRouteLoaders**: `Record`\<`string`, () => `Promise`\<`ApiHandlerModule`\>\>

Defined in: [api/\_handlers/\_routes.ts:14](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/_routes.ts#L14)

## Functions

### getApiHandler()

> **getApiHandler**(`subpath`): `Promise`\<[`ApiHandler`](#apihandler) \| `null`\>

Defined in: [api/\_handlers/\_routes.ts:309](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/api/_handlers/_routes.ts#L309)

#### Parameters

##### subpath

`string`

#### Returns

`Promise`\<[`ApiHandler`](#apihandler) \| `null`\>
