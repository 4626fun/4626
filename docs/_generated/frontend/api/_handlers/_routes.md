[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_routes

# api/\_handlers/\_routes

## Type Aliases

### ApiHandler()

> **ApiHandler** = (`req`, `res`) => `unknown` \| `Promise`\<`unknown`\>

Defined in: [api/\_handlers/\_routes.ts:15](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L15)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`unknown` \| `Promise`\<`unknown`\>

## Variables

### apiRouteLoaders

> `const` **apiRouteLoaders**: `Record`\<`string`, () => `Promise`\<`ApiHandlerModule`\>\>

Defined in: [api/\_handlers/\_routes.ts:29](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L29)

## Functions

### getApiHandler()

> **getApiHandler**(`subpath`): `Promise`\<[`ApiHandler`](#apihandler) \| `null`\>

Defined in: [api/\_handlers/\_routes.ts:133](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_routes.ts#L133)

#### Parameters

##### subpath

`string`

#### Returns

`Promise`\<[`ApiHandler`](#apihandler) \| `null`\>
