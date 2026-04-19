[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_lib/dispatchCatchAll

# api/\_lib/dispatchCatchAll

## Functions

### dispatchCatchAllRequest()

> **dispatchCatchAllRequest**(`params`): `Promise`\<`unknown`\>

Defined in: [api/\_lib/dispatchCatchAll.ts:76](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/api/_lib/dispatchCatchAll.ts#L76)

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
