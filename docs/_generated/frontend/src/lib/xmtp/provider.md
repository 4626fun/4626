[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:73](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L73)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L74)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L77)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L81)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L80)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L76)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L79)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L78)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L75)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L82)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:85](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L85)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L89)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L90)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L87)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L94)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L86)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L96)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L92)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:91](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L91)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L88)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L95)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L93)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L71)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:70](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L70)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:99](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L99)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:100](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L100)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L110)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:103](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L103)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L105)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:107](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L107)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:104](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L104)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L118)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:68](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L68)

## Functions

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:338](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L338)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:388](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L388)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:375](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L375)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:288](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L288)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:344](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L344)

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

Defined in: [src/lib/xmtp/provider.tsx:652](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L652)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
