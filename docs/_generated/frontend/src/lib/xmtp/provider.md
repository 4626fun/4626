[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L56)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L57)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L60)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L64)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L63)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L59)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L62)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L61)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L58)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:65](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L65)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L68)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L72)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L73)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L70)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L77)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L69)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L79)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L75)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L74)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L71)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L78)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L76)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L54)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L53)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L82)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L83)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L93)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L86)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L88)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L90)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L87)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L101)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L51)

## Functions

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:321](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L321)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:371](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L371)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:358](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L358)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:271](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L271)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:327](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L327)

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

Defined in: [src/lib/xmtp/provider.tsx:849](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L849)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
