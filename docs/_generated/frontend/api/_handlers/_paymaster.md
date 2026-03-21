[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / api/\_handlers/\_paymaster

# api/\_handlers/\_paymaster

## Functions

### default()

> **default**(`req`, `res`): `Promise`\<`any`\>

Defined in: [api/\_handlers/\_paymaster.ts:2533](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/_paymaster.ts#L2533)

#### Parameters

##### req

`any`

##### res

`any`

#### Returns

`Promise`\<`any`\>

***

### validateSponsoredSmartWalletCalls()

> **validateSponsoredSmartWalletCalls**(`params`): `Promise`\<\{ `expectedCreatorToken`: `` `0x${string}` `` \| `null`; `mode`: `string`; \}\>

Defined in: [api/\_handlers/\_paymaster.ts:1154](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/api/_handlers/_paymaster.ts#L1154)

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
