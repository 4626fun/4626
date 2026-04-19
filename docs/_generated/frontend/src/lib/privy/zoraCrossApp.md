[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/zoraCrossApp

# src/lib/privy/zoraCrossApp

## Functions

### isUnauthorizedCrossAppLinkError()

> **isUnauthorizedCrossAppLinkError**(`error`): `boolean`

Defined in: [src/lib/privy/zoraCrossApp.ts:16](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/zoraCrossApp.ts#L16)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### performZoraCrossAppAuth()

> **performZoraCrossAppAuth**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/privy/zoraCrossApp.ts:39](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/src/lib/privy/zoraCrossApp.ts#L39)

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
