[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L74)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:75](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L75)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:78](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L78)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:82](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L82)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:81](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L81)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:77](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L77)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:80](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L80)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:79](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L79)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:76](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L76)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:83](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L83)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:86](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L86)

#### Properties

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:90](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L90)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:91](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L91)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:88](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L88)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:95](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L95)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:87](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L87)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:97](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L97)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:93](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L93)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:92](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L92)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:89](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L89)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:96](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L96)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:94](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L94)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:72](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L72)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:71](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L71)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:100](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L100)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L101)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:111](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L111)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:104](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L104)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:106](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L106)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:108](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L108)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:105](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L105)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; `peerAddress`: `` `0x${string}` ``; `usedOriginalAddressFallback`: `boolean`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:119](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L119)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:69](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L69)

## Functions

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:359](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L359)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:413](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L413)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:400](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L400)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:300](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L300)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:365](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L365)

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

Defined in: [src/lib/xmtp/provider.tsx:702](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L702)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

#### Returns

`Element`
