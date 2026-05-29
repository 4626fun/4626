[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/identity/profileIdForPrivyUser

# server/\_lib/identity/profileIdForPrivyUser

## Functions

### listProfileIdsForPrivyUser()

> **listProfileIdsForPrivyUser**(`db`, `privyUserId`): `Promise`\<`number`[]\>

Defined in: [server/\_lib/identity/profileIdForPrivyUser.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/profileIdForPrivyUser.ts#L12)

Resolve all live profile ids for a Privy user id.
Alias rows win over direct `profiles.privy_user_id`; tombstones are chased.

#### Parameters

##### db

`Db`

##### privyUserId

`string`

#### Returns

`Promise`\<`number`[]\>

***

### resolvePrimaryProfileIdForPrivyUser()

> **resolvePrimaryProfileIdForPrivyUser**(`db`, `privyUserId`): `Promise`\<`number` \| `null`\>

Defined in: [server/\_lib/identity/profileIdForPrivyUser.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/identity/profileIdForPrivyUser.ts#L21)

#### Parameters

##### db

`Db`

##### privyUserId

`string`

#### Returns

`Promise`\<`number` \| `null`\>
