[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/identity/emailCollisionAdoption

# server/\_lib/identity/emailCollisionAdoption

## Functions

### runWithOwnedEmailCollisionAdoption()

> **runWithOwnedEmailCollisionAdoption**\<`T`\>(`params`): `Promise`\<`T`\>

Defined in: [server/\_lib/identity/emailCollisionAdoption.ts:145](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/server/_lib/identity/emailCollisionAdoption.ts#L145)

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
