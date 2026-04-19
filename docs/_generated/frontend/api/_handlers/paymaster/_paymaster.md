[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / api/\_handlers/paymaster/\_paymaster

# api/\_handlers/paymaster/\_paymaster

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:3043](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/paymaster/_paymaster.ts#L3043)

#### Parameters

##### req

`VercelRequest`

##### res

`VercelResponse`

#### Returns

`Promise`\<`VercelResponse` \| `undefined`\>

***

### validateSponsoredSmartWalletCalls()

> **validateSponsoredSmartWalletCalls**(`params`): `Promise`\<\{ `expectedCreatorToken`: `` `0x${string}` `` \| `null`; `mode`: `string`; \}\>

Defined in: [api/\_handlers/paymaster/\_paymaster.ts:1253](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/api/_handlers/paymaster/_paymaster.ts#L1253)

#### Parameters

##### params

###### allowCleanupOnlyForInactiveDeploySession?

`boolean`

###### calls

`object`[]

###### canonicalEmbeddedOwner?

`` `0x${string}` `` \| `null`

###### debug?

(`info`) => `void`

###### deploySessionOwner?

`` `0x${string}` `` \| `null`

###### factory?

`` `0x${string}` `` \| `null`

###### factoryData?

`` `0x${string}` `` \| `null`

###### initCode?

`` `0x${string}` `` \| `null`

###### sender

`` `0x${string}` ``

###### sessionAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `expectedCreatorToken`: `` `0x${string}` `` \| `null`; `mode`: `string`; \}\>
