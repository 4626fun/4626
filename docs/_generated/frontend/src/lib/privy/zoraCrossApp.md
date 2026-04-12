[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/privy/zoraCrossApp

# src/lib/privy/zoraCrossApp

## Functions

### isUnauthorizedCrossAppLinkError()

> **isUnauthorizedCrossAppLinkError**(`error`): `boolean`

Defined in: [src/lib/privy/zoraCrossApp.ts:16](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/privy/zoraCrossApp.ts#L16)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### performZoraCrossAppAuth()

> **performZoraCrossAppAuth**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/privy/zoraCrossApp.ts:39](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/src/lib/privy/zoraCrossApp.ts#L39)

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
