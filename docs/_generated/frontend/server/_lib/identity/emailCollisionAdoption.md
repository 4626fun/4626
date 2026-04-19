[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/emailCollisionAdoption

# server/\_lib/identity/emailCollisionAdoption

## Functions

### runWithOwnedEmailCollisionAdoption()

> **runWithOwnedEmailCollisionAdoption**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/\_lib/identity/emailCollisionAdoption.ts:152](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/_lib/identity/emailCollisionAdoption.ts#L152)

#### Type Parameters

##### T

`T`

#### Parameters

##### params

###### action

() => `Promise`\<`T`\>

###### db

`Db`

###### email

`string` \| `null` \| `undefined`

###### privyUser

[`PrivyUserLike`](../wallet/walletMapping.md#privyuserlike)

###### privyUserId

`string`

#### Returns

`Promise`\<`T`\>
