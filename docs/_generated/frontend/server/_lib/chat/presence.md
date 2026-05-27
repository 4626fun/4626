[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/chat/presence

# server/\_lib/chat/presence

## Type Aliases

### ChatAvailabilityUser

> **ChatAvailabilityUser** = `object`

Defined in: [server/\_lib/chat/presence.ts:11](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L11)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/presence.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L12)

##### avatarUrl

> **avatarUrl**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L14)

##### displayName

> **displayName**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L13)

##### ethosLevel

> **ethosLevel**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L16)

##### ethosScore

> **ethosScore**: `number` \| `null`

Defined in: [server/\_lib/chat/presence.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L15)

##### lastSeenAt

> **lastSeenAt**: `string` \| `null`

Defined in: [server/\_lib/chat/presence.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L18)

##### status

> **status**: `"available"` \| `"recent"`

Defined in: [server/\_lib/chat/presence.ts:17](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L17)

## Functions

### listAvailableChatUsers()

> **listAvailableChatUsers**(`params`): `Promise`\<[`ChatAvailabilityUser`](#chatavailabilityuser)[]\>

Defined in: [server/\_lib/chat/presence.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L125)

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

Defined in: [server/\_lib/chat/presence.ts:29](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L29)

#### Parameters

##### value

`unknown`

#### Returns

`` `0x${string}` `` \| `null`

***

### recordPresenceHeartbeat()

> **recordPresenceHeartbeat**(`params`): `Promise`\<`void`\>

Defined in: [server/\_lib/chat/presence.ts:34](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/presence.ts#L34)

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
