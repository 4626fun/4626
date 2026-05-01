[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/hermit/policy

# server/\_lib/hermit/policy

## Functions

### \_resetHermitRoomOwnerCacheForTests()

> **\_resetHermitRoomOwnerCacheForTests**(): `void`

Defined in: [server/\_lib/hermit/policy.ts:107](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L107)

#### Returns

`void`

***

### getHermitOwnerAddress()

> **getHermitOwnerAddress**(): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/hermit/policy.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L13)

#### Returns

`` `0x${string}` `` \| `null`

***

### isHermitOwner()

> **isHermitOwner**(`address`): `boolean`

Defined in: [server/\_lib/hermit/policy.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L18)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### isHermitRoomAllowed()

> **isHermitRoomAllowed**(`roomId`): `boolean`

Defined in: [server/\_lib/hermit/policy.ts:53](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L53)

#### Parameters

##### roomId

`string`

#### Returns

`boolean`

***

### isHermitRoomAllowedForOwner()

> **isHermitRoomAllowedForOwner**(`params`): `Promise`\<`boolean`\>

Defined in: [server/\_lib/hermit/policy.ts:88](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L88)

#### Parameters

##### params

###### ownerAddress

`string`

###### roomId

`string`

#### Returns

`Promise`\<`boolean`\>

***

### isHermitUserAllowed()

> **isHermitUserAllowed**(`address`): `boolean`

Defined in: [server/\_lib/hermit/policy.ts:35](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L35)

#### Parameters

##### address

`string`

#### Returns

`boolean`

***

### readHermitAllowedRoomIds()

> **readHermitAllowedRoomIds**(): `Set`\<`string`\>

Defined in: [server/\_lib/hermit/policy.ts:42](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L42)

#### Returns

`Set`\<`string`\>

***

### readHermitAllowedUsers()

> **readHermitAllowedUsers**(): `Set`\<`string`\>

Defined in: [server/\_lib/hermit/policy.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L24)

#### Returns

`Set`\<`string`\>

***

### resolveHermitGatewayUrl()

> **resolveHermitGatewayUrl**(`cid`): `string` \| `null`

Defined in: [server/\_lib/hermit/policy.ts:111](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/hermit/policy.ts#L111)

#### Parameters

##### cid

`string`

#### Returns

`string` \| `null`
