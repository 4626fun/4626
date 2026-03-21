[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/components/chat/chatWidgetState

# src/components/chat/chatWidgetState

## Type Aliases

### OpenWindow

> **OpenWindow** = `object`

Defined in: [src/components/chat/chatWidgetState.ts:1](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L1)

#### Properties

##### id

> **id**: `string`

Defined in: [src/components/chat/chatWidgetState.ts:2](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L2)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/components/chat/chatWidgetState.ts:7](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L7)

##### minimized

> **minimized**: `boolean`

Defined in: [src/components/chat/chatWidgetState.ts:8](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L8)

##### name

> **name**: `string`

Defined in: [src/components/chat/chatWidgetState.ts:3](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L3)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/components/chat/chatWidgetState.ts:6](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L6)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/components/chat/chatWidgetState.ts:5](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L5)

##### seedCommandId?

> `optional` **seedCommandId**: `string` \| `null`

Defined in: [src/components/chat/chatWidgetState.ts:9](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L9)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/components/chat/chatWidgetState.ts:4](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L4)

## Functions

### rekeyOpenWindows()

> **rekeyOpenWindows**(`windows`, `oldConversationId`, `newConversationId`): [`OpenWindow`](#openwindow)[]

Defined in: [src/components/chat/chatWidgetState.ts:12](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/components/chat/chatWidgetState.ts#L12)

#### Parameters

##### windows

[`OpenWindow`](#openwindow)[]

##### oldConversationId

`string`

##### newConversationId

`string`

#### Returns

[`OpenWindow`](#openwindow)[]
