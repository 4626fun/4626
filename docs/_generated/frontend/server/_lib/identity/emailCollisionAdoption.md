[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/identity/emailCollisionAdoption

# server/\_lib/identity/emailCollisionAdoption

## Functions

### runWithOwnedEmailCollisionAdoption()

> **runWithOwnedEmailCollisionAdoption**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/\_lib/identity/emailCollisionAdoption.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/identity/emailCollisionAdoption.ts#L152)

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
