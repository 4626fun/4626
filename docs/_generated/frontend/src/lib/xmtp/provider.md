[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:116](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L116)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:117](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L117)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:120](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L120)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:124](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L124)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:123](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L123)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:119](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L119)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L122)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:121](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L121)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L118)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:125](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L125)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:140](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L140)

#### Properties

##### actions?

> `optional` **actions**: [`ChatMessageActions`](#chatmessageactions-1) \| `null`

Defined in: [src/lib/xmtp/provider.tsx:148](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L148)

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:144](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L144)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L145)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:142](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L142)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:151](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L151)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:141](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L141)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:153](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L153)

##### reactionEmoji?

> `optional` **reactionEmoji**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:149](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L149)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:147](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L147)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:146](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L146)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:143](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L143)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:152](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L152)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:150](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L150)

***

### ChatMessageActionButton

> **ChatMessageActionButton** = `object`

Defined in: [src/lib/xmtp/provider.tsx:128](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L128)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:129](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L129)

##### label

> **label**: `string`

Defined in: [src/lib/xmtp/provider.tsx:130](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L130)

##### style?

> `optional` **style**: `"primary"` \| `"secondary"` \| `"danger"`

Defined in: [src/lib/xmtp/provider.tsx:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L131)

***

### ChatMessageActions

> **ChatMessageActions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:134](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L134)

#### Properties

##### buttons

> **buttons**: [`ChatMessageActionButton`](#chatmessageactionbutton)[]

Defined in: [src/lib/xmtp/provider.tsx:137](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L137)

##### description

> **description**: `string`

Defined in: [src/lib/xmtp/provider.tsx:136](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L136)

##### promptId

> **promptId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:135](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L135)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:114](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L114)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:113](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L113)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:156](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L156)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:157](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L157)

##### replyToSenderInboxId?

> `optional` **replyToSenderInboxId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:158](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L158)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:168](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L168)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:161](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L161)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:163](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L163)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:165](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L165)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:162](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L162)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; `peerAddress`: `` `0x${string}` ``; `usedOriginalAddressFallback`: `boolean`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L176)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:110](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L110)

## Functions

### canMessageAddressOnCurrentEnv()

> **canMessageAddressOnCurrentEnv**(`address`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/xmtp/provider.tsx:778](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L778)

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:549](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L549)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:701](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L701)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:679](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L679)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:371](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L371)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:553](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L553)

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

Defined in: [src/lib/xmtp/provider.tsx:970](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/provider.tsx#L970)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

###### identityHintAddress?

`string` \| `null` = `null`

###### manualConnectOnly?

`boolean` = `false`

When true, skip auto-connect and stream-driven reconnect (waitlist embedded chat).

#### Returns

`Element`
