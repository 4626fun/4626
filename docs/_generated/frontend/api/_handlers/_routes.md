[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_routes

# api/\_handlers/\_routes

## Type Aliases

### ApiHandler()

> **ApiHandler** = (`req`, `res`) => `unknown` \| `Promise`\<`unknown`\>

Defined in: [api/\_handlers/\_routes.ts:3](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L3)

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

Defined in: [api/\_handlers/\_routes.ts:9](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L9)

## Functions

### getApiHandler()

> **getApiHandler**(`subpath`): `Promise`\<[`ApiHandler`](#apihandler) \| `null`\>

Defined in: [api/\_handlers/\_routes.ts:101](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L101)

#### Parameters

##### subpath

`string`

#### Returns

`Promise`\<[`ApiHandler`](#apihandler) \| `null`\>
