[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:54](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L54)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:55](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L55)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:58](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L58)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:62](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L62)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:61](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L61)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:57](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L57)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:60](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L60)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:59](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L59)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:56](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L56)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:63](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L63)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:66](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L66)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:70](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L70)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:71](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L71)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:68](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L68)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:75](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L75)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:67](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L67)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:77](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L77)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:73](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L73)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:72](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L72)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:69](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L69)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:76](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L76)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:74](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L74)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:52](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L52)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:51](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L51)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:80](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L80)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:81](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L81)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:89](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L89)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:84](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L84)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:86](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L86)

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:85](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L85)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:91](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L91)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:49](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L49)

## Functions

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:312](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L312)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:362](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L362)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:349](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L349)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:262](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L262)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:318](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L318)

#### Parameters

##### address

`string`

##### encKeyHex

`string`

#### Returns

`void`

***

### XmtpChatProvider()

> **XmtpChatProvider**(`__namedParameters`): `Element`

Defined in: [src/lib/xmtp/provider.tsx:734](https://github.com/wenakita/4626/blob/5dd4dafbe9e8135d468ff07a71f95a30fc683580/frontend/src/lib/xmtp/provider.tsx#L734)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
