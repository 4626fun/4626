[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/\_lib/emailCollisionAdoption

# server/\_lib/emailCollisionAdoption

## Functions

### runWithOwnedEmailCollisionAdoption()

> **runWithOwnedEmailCollisionAdoption**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/\_lib/emailCollisionAdoption.ts:145](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/_lib/emailCollisionAdoption.ts#L145)

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

[`PrivyUserLike`](walletMapping.md#privyuserlike)

###### privyUserId

`string`

#### Returns

`Promise`\<`T`\>
