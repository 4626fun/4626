[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L55)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L56)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L59)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:63](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L63)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:62](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L62)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L58)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L61)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L60)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L57)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:64](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L64)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:67](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L67)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L71)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L72)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L69)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L76)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L68)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L78)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L74)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L73)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L70)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L77)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L75)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L53)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L52)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L81)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L82)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L92)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L85)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L87)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L89)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L86)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:100](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L100)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:50](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L50)

## Functions

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:320](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L320)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:370](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L370)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:357](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L357)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:270](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L270)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:326](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L326)

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

Defined in: [src/lib/xmtp/provider.tsx:847](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L847)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
