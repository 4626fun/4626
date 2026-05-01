[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/\_lib/chat/presence

# server/\_lib/chat/presence

## Type Aliases

### ChatAvailabilityUser

> **ChatAvailabilityUser** = `object`

Defined in: [server/\_lib/chat/presence.ts:7](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L7)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/presence.ts:8](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L8)

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:10](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L10)

##### displayName

> **displayName**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L9)

##### ethosLevel

> **ethosLevel**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:12](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L12)

##### ethosScore

> **ethosScore**: `number` \| `null`

Defined in: [server/\_lib/chat/presence.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L11)

##### lastSeenAt

> **lastSeenAt**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L14)

##### status

> **status**: `"available"` \| `"recent"`

Defined in: [server/\_lib/chat/presence.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L13)

## Functions

### listAvailableChatUsers()

> **listAvailableChatUsers**(`params`): `Promise`\<[`ChatAvailabilityUser`](#chatavailabilityuser)[]\>

Defined in: [server/\_lib/chat/presence.ts:109](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L109)

#### Parameters

##### params

###### limit?

`number`

###### viewerAddress?

`` `0x${string}` `` \| `null`

#### Returns

`Promise`\<[`ChatAvailabilityUser`](#chatavailabilityuser)[]\>

***

### normalizeChatAddress()

> **normalizeChatAddress**(`value`): `` `0x${string}` `` \| `null`

Defined in: [server/\_lib/chat/presence.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L25)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### recordPresenceHeartbeat()

> **recordPresenceHeartbeat**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/chat/presence.ts:30](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/chat/presence.ts#L30)

#### Parameters

##### params

###### address

`` `0x${string}` ``

###### ip?

`string` \| `null`

###### status?

`string` \| `null`

###### userAgent?

`string` \| `null`

#### Returns

`Promise`\<`void`\>
