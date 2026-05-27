[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / api/\_handlers/\_routeLoader

# api/\_handlers/\_routeLoader

## Type Aliases

### ApiHandler()

> **ApiHandler** = (`req`, `res`) => `unknown` \| `Promise`\<`unknown`\>

Defined in: [api/\_handlers/\_routeLoader.ts:3](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/_routeLoader.ts#L3)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`unknown` \| `Promise`\<`unknown`\>

***

### ApiHandlerModule

> **ApiHandlerModule** = `object`

Defined in: [api/\_handlers/\_routeLoader.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/_routeLoader.ts#L5)

#### Properties

##### default?

> `optional` **default**: [`ApiHandler`](#apihandler)

Defined in: [api/\_handlers/\_routeLoader.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/_routeLoader.ts#L5)

***

### ApiRouteLoaders

> **ApiRouteLoaders** = `Record`\<`string`, () => `Promise`\<[`ApiHandlerModule`](#apihandlermodule)\>\>

Defined in: [api/\_handlers/\_routeLoader.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/_routeLoader.ts#L7)

## Functions

### loadHandlerFromMap()

> **loadHandlerFromMap**(`subpath`, `loaders`): `Promise`\<[`ApiHandler`](#apihandler) \| `null`\>

Defined in: [api/\_handlers/\_routeLoader.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/_routeLoader.ts#L9)

#### Parameters

##### subpath

`string`

##### loaders

[`ApiRouteLoaders`](#apirouteloaders)

#### Returns

`Promise`\<[`ApiHandler`](#apihandler) \| `null`\>
