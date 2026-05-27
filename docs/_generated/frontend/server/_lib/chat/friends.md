[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/chat/friends

# server/\_lib/chat/friends

## Type Aliases

### ChatFriendRecord

> **ChatFriendRecord** = `object`

Defined in: [server/\_lib/chat/friends.ts:7](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L7)

#### Properties

##### address

> **address**: `` `0x${string}` ``

Defined in: [server/\_lib/chat/friends.ts:8](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L8)

##### state

> **state**: [`ChatFriendState`](#chatfriendstate)

Defined in: [server/\_lib/chat/friends.ts:9](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L9)

##### updatedAt

> **updatedAt**: `string`

Defined in: [server/\_lib/chat/friends.ts:10](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L10)

***

### ChatFriendsSnapshot

> **ChatFriendsSnapshot** = `object`

Defined in: [server/\_lib/chat/friends.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L13)

#### Properties

##### friends

> **friends**: [`ChatFriendRecord`](#chatfriendrecord)[]

Defined in: [server/\_lib/chat/friends.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L14)

##### incoming

> **incoming**: [`ChatFriendRecord`](#chatfriendrecord)[]

Defined in: [server/\_lib/chat/friends.ts:15](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L15)

##### outgoing

> **outgoing**: [`ChatFriendRecord`](#chatfriendrecord)[]

Defined in: [server/\_lib/chat/friends.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L16)

***

### ChatFriendState

> **ChatFriendState** = `"accepted"` \| `"pending_incoming"` \| `"pending_outgoing"`

Defined in: [server/\_lib/chat/friends.ts:5](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L5)

## Functions

### acceptChatFriendRequest()

> **acceptChatFriendRequest**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

Defined in: [server/\_lib/chat/friends.ts:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L125)

#### Parameters

##### params

###### targetAddress

`` `0x${string}` ``

###### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

***

### cancelOutgoingChatFriendRequest()

> **cancelOutgoingChatFriendRequest**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

Defined in: [server/\_lib/chat/friends.ts:179](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L179)

#### Parameters

##### params

###### targetAddress

`` `0x${string}` ``

###### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

***

### declineChatFriendRequest()

> **declineChatFriendRequest**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

Defined in: [server/\_lib/chat/friends.ts:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L152)

#### Parameters

##### params

###### targetAddress

`` `0x${string}` ``

###### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

***

### listChatFriendSnapshot()

> **listChatFriendSnapshot**(`viewerAddress`): `Promise`\<[`ChatFriendsSnapshot`](#chatfriendssnapshot)\>

Defined in: [server/\_lib/chat/friends.ts:19](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L19)

#### Parameters

##### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<[`ChatFriendsSnapshot`](#chatfriendssnapshot)\>

***

### removeChatFriend()

> **removeChatFriend**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

Defined in: [server/\_lib/chat/friends.ts:196](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L196)

#### Parameters

##### params

###### targetAddress

`` `0x${string}` ``

###### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

***

### sendChatFriendRequest()

> **sendChatFriendRequest**(`params`): `Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>

Defined in: [server/\_lib/chat/friends.ts:67](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/chat/friends.ts#L67)

#### Parameters

##### params

###### targetAddress

`` `0x${string}` ``

###### viewerAddress

`` `0x${string}` ``

#### Returns

`Promise`\<\{ `ok`: `true`; \} \| \{ `ok`: `false`; `reason`: `string`; \}\>
