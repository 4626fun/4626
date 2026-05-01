[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/chat/openChat

# src/lib/chat/openChat

## Type Aliases

### ChatOpenRequest

> **ChatOpenRequest** = \{ `imageUrl?`: `string` \| `null`; `kind`: `"dm"`; `nameHint?`: `string` \| `null`; `peerAddress`: `` `0x${string}` ``; `seedCommandId?`: `string` \| `null`; \} \| \{ `conversationId`: `string`; `imageUrl?`: `string` \| `null`; `kind`: `"group"`; `name`: `string`; `seedCommandId?`: `string` \| `null`; \}

Defined in: [src/lib/chat/openChat.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L3)

## Variables

### CHAT\_OPEN\_REQUEST\_EVENT

> `const` **CHAT\_OPEN\_REQUEST\_EVENT**: `"4626:chat-open-request"` = `'4626:chat-open-request'`

Defined in: [src/lib/chat/openChat.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L1)

## Functions

### isChatOpenRequest()

> **isChatOpenRequest**(`value`): `value is ChatOpenRequest`

Defined in: [src/lib/chat/openChat.ts:24](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L24)

#### Parameters

##### value

`unknown`

#### Returns

`value is ChatOpenRequest`

***

### requestOpenChat()

> **requestOpenChat**(`request`): `void`

Defined in: [src/lib/chat/openChat.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L19)

#### Parameters

##### request

[`ChatOpenRequest`](#chatopenrequest)

#### Returns

`void`
