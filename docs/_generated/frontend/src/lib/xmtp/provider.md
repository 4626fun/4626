[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/provider

# src/lib/xmtp/provider

## Type Aliases

### ChatConversation

> **ChatConversation** = `object`

Defined in: [src/lib/xmtp/provider.tsx:106](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L106)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:107](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L107)

##### imageUrl?

> `optional` **imageUrl**: `string`

Defined in: [src/lib/xmtp/provider.tsx:110](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L110)

##### lastMessageAt?

> `optional` **lastMessageAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:114](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L114)

##### lastMessageText?

> `optional` **lastMessageText**: `string`

Defined in: [src/lib/xmtp/provider.tsx:113](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L113)

##### name

> **name**: `string`

Defined in: [src/lib/xmtp/provider.tsx:109](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L109)

##### peerAddress?

> `optional` **peerAddress**: `string`

Defined in: [src/lib/xmtp/provider.tsx:112](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L112)

##### peerInboxId?

> `optional` **peerInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:111](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L111)

##### type

> **type**: `"dm"` \| `"group"`

Defined in: [src/lib/xmtp/provider.tsx:108](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L108)

##### unreadCount

> **unreadCount**: `number`

Defined in: [src/lib/xmtp/provider.tsx:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L115)

***

### ChatMessage

> **ChatMessage** = `object`

Defined in: [src/lib/xmtp/provider.tsx:130](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L130)

#### Properties

##### actions?

> `optional` **actions**: [`ChatMessageActions`](#chatmessageactions-1) \| `null`

Defined in: [src/lib/xmtp/provider.tsx:138](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L138)

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/provider.tsx:134](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L134)

##### contentType

> **contentType**: [`ChatMessageContentType`](#chatmessagecontenttype-1)

Defined in: [src/lib/xmtp/provider.tsx:135](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L135)

##### conversationId

> **conversationId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:132](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L132)

##### error

> **error**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:141](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L141)

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L131)

##### isSelf

> **isSelf**: `boolean`

Defined in: [src/lib/xmtp/provider.tsx:143](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L143)

##### reactionEmoji?

> `optional` **reactionEmoji**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:139](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L139)

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L137)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/provider.tsx:136](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L136)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:133](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L133)

##### sentAt

> **sentAt**: `Date`

Defined in: [src/lib/xmtp/provider.tsx:142](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L142)

##### status

> **status**: [`ChatMessageStatus`](#chatmessagestatus-1)

Defined in: [src/lib/xmtp/provider.tsx:140](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L140)

***

### ChatMessageActionButton

> **ChatMessageActionButton** = `object`

Defined in: [src/lib/xmtp/provider.tsx:118](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L118)

#### Properties

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/provider.tsx:119](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L119)

##### label

> **label**: `string`

Defined in: [src/lib/xmtp/provider.tsx:120](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L120)

##### style?

> `optional` **style**: `"primary"` \| `"secondary"` \| `"danger"`

Defined in: [src/lib/xmtp/provider.tsx:121](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L121)

***

### ChatMessageActions

> **ChatMessageActions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:124](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L124)

#### Properties

##### buttons

> **buttons**: [`ChatMessageActionButton`](#chatmessageactionbutton)[]

Defined in: [src/lib/xmtp/provider.tsx:127](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L127)

##### description

> **description**: `string`

Defined in: [src/lib/xmtp/provider.tsx:126](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L126)

##### promptId

> **promptId**: `string`

Defined in: [src/lib/xmtp/provider.tsx:125](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L125)

***

### ChatMessageContentType

> **ChatMessageContentType** = `"text"` \| `"json"` \| `"code"`

Defined in: [src/lib/xmtp/provider.tsx:104](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L104)

***

### ChatMessageStatus

> **ChatMessageStatus** = `"sending"` \| `"sent"` \| `"failed"`

Defined in: [src/lib/xmtp/provider.tsx:103](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L103)

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:146](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L146)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:147](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L147)

##### replyToSenderInboxId?

> `optional` **replyToSenderInboxId**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:148](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L148)

***

### StartDmFailureReason

> **StartDmFailureReason** = `"not_connected"` \| `"self_recipient"` \| `"recipient_not_registered"` \| `"canonical_recipient_not_registered"` \| `"environment_mismatch"` \| `"create_failed"`

Defined in: [src/lib/xmtp/provider.tsx:158](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L158)

***

### StartDmOptions

> **StartDmOptions** = `object`

Defined in: [src/lib/xmtp/provider.tsx:151](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L151)

#### Properties

##### imageUrl?

> `optional` **imageUrl**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:153](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L153)

##### inputAddress?

> `optional` **inputAddress**: `` `0x${string}` `` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:155](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L155)

Address resolved from user input before canonical remapping.

##### nameHint?

> `optional` **nameHint**: `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:152](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L152)

***

### StartDmResult

> **StartDmResult** = \{ `conversationId`: `string`; `ok`: `true`; `peerAddress`: `` `0x${string}` ``; `usedOriginalAddressFallback`: `boolean`; \} \| \{ `message`: `string`; `ok`: `false`; `reason`: [`StartDmFailureReason`](#startdmfailurereason); \}

Defined in: [src/lib/xmtp/provider.tsx:166](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L166)

***

### XmtpStatus

> **XmtpStatus** = `"idle"` \| `"signing"` \| `"connecting"` \| `"connected"` \| `"error"`

Defined in: [src/lib/xmtp/provider.tsx:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L100)

## Functions

### canMessageAddressOnCurrentEnv()

> **canMessageAddressOnCurrentEnv**(`address`): `Promise`\<`boolean` \| `null`\>

Defined in: [src/lib/xmtp/provider.tsx:765](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L765)

#### Parameters

##### address

`` `0x${string}` ``

#### Returns

`Promise`\<`boolean` \| `null`\>

***

### readStoredEncKeyHex()

> **readStoredEncKeyHex**(`address`): `string` \| `null`

Defined in: [src/lib/xmtp/provider.tsx:536](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L536)

#### Parameters

##### address

`string`

#### Returns

`string` \| `null`

***

### requestXmtpAutoConnect()

> **requestXmtpAutoConnect**(): `void`

Defined in: [src/lib/xmtp/provider.tsx:688](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L688)

Signal the XMTP provider to auto-connect after auth completes.
Dispatches a custom event that the provider listens for.

#### Returns

`void`

***

### setAutoConnectEnabled()

> **setAutoConnectEnabled**(`address`): `void`

Defined in: [src/lib/xmtp/provider.tsx:666](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L666)

#### Parameters

##### address

`string`

#### Returns

`void`

***

### useXmtp()

> **useXmtp**(): `XmtpContextValue`

Defined in: [src/lib/xmtp/provider.tsx:358](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L358)

#### Returns

`XmtpContextValue`

***

### writeStoredEncKeyHex()

> **writeStoredEncKeyHex**(`address`, `encKeyHex`): `void`

Defined in: [src/lib/xmtp/provider.tsx:540](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L540)

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

Defined in: [src/lib/xmtp/provider.tsx:957](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/provider.tsx#L957)

#### Parameters

##### \_\_namedParameters

###### children

`ReactNode`

###### identityHintAddress?

`string` \| `null` = `null`

#### Returns

`Element`
