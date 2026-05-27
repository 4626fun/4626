[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/privy/zoraCrossApp

# src/lib/privy/zoraCrossApp

## Functions

### isUnauthorizedCrossAppLinkError()

> **isUnauthorizedCrossAppLinkError**(`error`): `boolean`

Defined in: [src/lib/privy/zoraCrossApp.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/zoraCrossApp.ts#L16)

#### Parameters

##### error

`unknown`

#### Returns

`boolean`

***

### performZoraCrossAppAuth()

> **performZoraCrossAppAuth**(`params`): `Promise`\<`void`\>

Defined in: [src/lib/privy/zoraCrossApp.ts:39](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/privy/zoraCrossApp.ts#L39)

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
