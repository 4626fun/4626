[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/chat/openChat

# src/lib/chat/openChat

## Type Aliases

### ChatOpenRequest

> **ChatOpenRequest** = \{ `imageUrl?`: `string` \| `null`; `kind`: `"dm"`; `nameHint?`: `string` \| `null`; `peerAddress`: `` `0x${string}` ``; `seedCommandId?`: `string` \| `null`; \} \| \{ `conversationId`: `string`; `imageUrl?`: `string` \| `null`; `kind`: `"group"`; `name`: `string`; `seedCommandId?`: `string` \| `null`; \}

Defined in: [src/lib/chat/openChat.ts:5](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L5)

## Variables

### CHAT\_NEW\_DM\_REQUEST\_EVENT

> `const` **CHAT\_NEW\_DM\_REQUEST\_EVENT**: `"4626:chat-new-dm-request"` = `'4626:chat-new-dm-request'`

Defined in: [src/lib/chat/openChat.ts:3](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L3)

***

### CHAT\_OPEN\_REQUEST\_EVENT

> `const` **CHAT\_OPEN\_REQUEST\_EVENT**: `"4626:chat-open-request"` = `'4626:chat-open-request'`

Defined in: [src/lib/chat/openChat.ts:1](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L1)

***

### CHAT\_TOGGLE\_REQUEST\_EVENT

> `const` **CHAT\_TOGGLE\_REQUEST\_EVENT**: `"4626:chat-toggle-request"` = `'4626:chat-toggle-request'`

Defined in: [src/lib/chat/openChat.ts:2](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L2)

## Functions

### isChatOpenRequest()

> **isChatOpenRequest**(`value`): `value is ChatOpenRequest`

Defined in: [src/lib/chat/openChat.ts:36](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L36)

#### Parameters

##### value

`unknown`

#### Returns

`value is ChatOpenRequest`

***

### requestNewDm()

> **requestNewDm**(): `void`

Defined in: [src/lib/chat/openChat.ts:31](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L31)

#### Returns

`void`

***

### requestOpenChat()

> **requestOpenChat**(`request`): `void`

Defined in: [src/lib/chat/openChat.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L21)

#### Parameters

##### request

[`ChatOpenRequest`](#chatopenrequest)

#### Returns

`void`

***

### requestToggleChat()

> **requestToggleChat**(): `void`

Defined in: [src/lib/chat/openChat.ts:26](https://github.com/wenakita/4626/blob/main/frontend/src/lib/chat/openChat.ts#L26)

#### Returns

`void`
