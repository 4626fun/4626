[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_lib/dispatchCatchAll

# api/\_lib/dispatchCatchAll

## Functions

### dispatchCatchAllRequest()

> **dispatchCatchAllRequest**(`params`): `Promise`\<`unknown`\>

Defined in: [api/\_lib/dispatchCatchAll.ts:76](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_lib/dispatchCatchAll.ts#L76)

#### Parameters

##### params

###### jsonRpcCompatSubpath?

`string`

###### prefixes

`string`[]

###### req

`VercelRequest`

###### res

`VercelResponse`

###### resolveHandler

(`subpath`) => `Promise`\<`ApiHandler` \| `null`\>

###### routeLabel?

`string`

#### Returns

`Promise`\<`unknown`\>
