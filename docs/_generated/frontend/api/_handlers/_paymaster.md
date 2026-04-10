[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_paymaster

# api/\_handlers/\_paymaster

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`VercelResponse` \| `undefined`\>

Defined in: [api/\_handlers/\_paymaster.ts:2941](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_paymaster.ts#L2941)

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

Defined in: [api/\_handlers/\_paymaster.ts:1215](https://github.com/wenakita/4626/blob/main/frontend/api/_handlers/_paymaster.ts#L1215)

#### Parameters

##### params

###### allowCleanupOnlyForInactiveDeploySession?

`boolean`

###### calls

`object`[]

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
