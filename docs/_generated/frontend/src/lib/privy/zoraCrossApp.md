[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/zoraCrossApp

# src/lib/privy/zoraCrossApp

## Functions

### isUnauthorizedCrossAppLinkError()

> **isUnauthorizedCrossAppLinkError**(`error`): `boolean`

Defined in: [src/lib/privy/zoraCrossApp.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/privy/zoraCrossApp.ts#L16)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### performZoraCrossAppAuth()

> **performZoraCrossAppAuth**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/privy/zoraCrossApp.ts:39](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/privy/zoraCrossApp.ts#L39)

#### Parameters

##### params

###### appId

`string`

###### isRedirectUrlNotAllowedError?

(`error`) => `boolean`

###### linkCrossAppAccount

`CrossAppFn`

###### loginWithCrossAppAccount

`CrossAppFn`

###### privyAuthed

`boolean`

###### sanitizeRedirect?

() => () => `void` \| `null`

#### Returns

`Promise`\<`void`\>
