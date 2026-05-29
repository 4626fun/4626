[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpHelpers

# src/lib/xmtp/xmtpHelpers

## Type Aliases

### ConversationLike

> **ConversationLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:329](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L329)

#### Properties

##### consentState()?

> `optional` **consentState**: () => `Promise`\<`ConsentState`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:332](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L332)

###### Returns

`Promise`\<`ConsentState`\>

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:330](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L330)

##### sync()?

> `optional` **sync**: () => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:331](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L331)

###### Returns

`Promise`\<`unknown`\>

##### updateConsentState()?

> `optional` **updateConsentState**: (`state`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:333](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L333)

###### Parameters

###### state

`ConsentState`

###### Returns

`Promise`\<`unknown`\>

***

### ConversationsApiLike

> **ConversationsApiLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:340](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L340)

#### Properties

##### getConversationById()

> **getConversationById**: (`id`) => `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:343](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L343)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

##### list()

> **list**: (`options?`) => `Promise`\<[`ConversationLike`](#conversationlike)[]\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:344](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L344)

###### Parameters

###### options?

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike)[]\>

##### listGroups()?

> `optional` **listGroups**: (`options?`) => `Promise`\<[`ConversationLike`](#conversationlike)[]\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:345](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L345)

###### Parameters

###### options?

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike)[]\>

##### sync()

> **sync**: () => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:341](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L341)

###### Returns

`Promise`\<`unknown`\>

##### syncAll()?

> `optional` **syncAll**: (`consentStates?`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:342](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L342)

###### Parameters

###### consentStates?

`ConsentState`[]

###### Returns

`Promise`\<`unknown`\>

***

### ListConversationsOptionsLike

> **ListConversationsOptionsLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:336](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L336)

#### Properties

##### consentStates?

> `optional` **consentStates**: `ConsentState`[]

Defined in: [src/lib/xmtp/xmtpHelpers.ts:337](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L337)

***

### ParsedWireContent

> **ParsedWireContent** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:41](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L41)

#### Properties

##### actions?

> `optional` **actions**: \{ `buttons`: `object`[]; `description`: `string`; `promptId`: `string`; \} \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:46](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L46)

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:42](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L42)

##### contentType

> **contentType**: `ChatMessageContentType`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:43](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L43)

##### reactionEmoji?

> `optional` **reactionEmoji**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:51](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L51)

##### replyToId

> **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:45](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L45)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:44](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L44)

***

### PreferencesApiLike

> **PreferencesApiLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:348](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L348)

#### Properties

##### setConsentStates()?

> `optional` **setConsentStates**: (`records`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:349](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L349)

###### Parameters

###### records

`object`[]

###### Returns

`Promise`\<`unknown`\>

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:115](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L115)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:116](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L116)

##### replyToSenderInboxId?

> `optional` **replyToSenderInboxId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:118](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L118)

Inbox id of the message being replied to (required for native XMTP replies).

***

### XmtpEnvLabel

> **XmtpEnvLabel** = `"production"` \| `"dev"` \| `"local"`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:129](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L129)

## Variables

### GROUP\_MEMBERSHIP\_CONSENT\_SYNC\_STATES

> `const` **GROUP\_MEMBERSHIP\_CONSENT\_SYNC\_STATES**: readonly \[`Unknown`, `Allowed`\]

Defined in: [src/lib/xmtp/xmtpHelpers.ts:355](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L355)

Consent states included when pulling server-side group memberships into a fresh browser install.

## Functions

### allowConversationIfUnknown()

> **allowConversationIfUnknown**(`convo`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:389](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L389)

#### Parameters

##### convo

[`ConversationLike`](#conversationlike)

#### Returns

`Promise`\<`void`\>

***

### allowGroupConsentById()

> **allowGroupConsentById**(`preferencesApi`, `groupId`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:364](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L364)

#### Parameters

##### preferencesApi

[`PreferencesApiLike`](#preferencesapilike) | `null` | `undefined`

##### groupId

`string`

#### Returns

`Promise`\<`void`\>

***

### buildNotRegisteredDmMessage()

> **buildNotRegisteredDmMessage**(`params`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:306](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L306)

#### Parameters

##### params

###### canonicalizedFromAddress

`` `0x${string}` `` \| `null`

###### env

[`XmtpEnvLabel`](#xmtpenvlabel)

###### peerAddress

`` `0x${string}` ``

#### Returns

`string`

***

### conversationIdsEqual()

> **conversationIdsEqual**(`a`, `b`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:322](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L322)

#### Parameters

##### a

`string` | `null` | `undefined`

##### b

`string` | `null` | `undefined`

#### Returns

`boolean`

***

### encodeWireContent()

> **encodeWireContent**(`text`, `options?`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:122](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L122)

Legacy wire prefix — prefer native XMTP Reply when both clients support it.

#### Parameters

##### text

`string`

##### options?

[`SendChatMessageOptions`](#sendchatmessageoptions)

#### Returns

`string`

***

### extractCanMessageResult()

> **extractCanMessageResult**(`result`, `address`): `boolean` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:239](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L239)

#### Parameters

##### result

`unknown`

##### address

`` `0x${string}` ``

#### Returns

`boolean` \| `null`

***

### extractInstallationLimitInboxId()

> **extractInstallationLimitInboxId**(`message`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:137](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L137)

#### Parameters

##### message

`string`

#### Returns

`string` \| `null`

***

### formatXmtpEnvLabel()

> **formatXmtpEnvLabel**(`env`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L131)

#### Parameters

##### env

[`XmtpEnvLabel`](#xmtpenvlabel)

#### Returns

`string`

***

### groupMembershipListOptions()

> **groupMembershipListOptions**(): [`ListConversationsOptionsLike`](#listconversationsoptionslike)

Defined in: [src/lib/xmtp/xmtpHelpers.ts:360](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L360)

#### Returns

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

***

### hexToBytes()

> **hexToBytes**(`hex`): `Uint8Array`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:16](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L16)

#### Parameters

##### hex

`string`

#### Returns

`Uint8Array`

***

### isInstallationLimitError()

> **isInstallationLimitError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:162](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L162)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isLocalXmtpStateInvalidError()

> **isLocalXmtpStateInvalidError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:191](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L191)

Local OPFS install no longer validates against the XMTP network inbox.

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isOpfsAccessHandleError()

> **isOpfsAccessHandleError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:180](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L180)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isScwSignatureValidationError()

> **isScwSignatureValidationError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:172](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L172)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isTransientXmtpStreamError()

> **isTransientXmtpStreamError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:224](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L224)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isTransientXmtpStreamNetworkError()

> **isTransientXmtpStreamNetworkError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:200](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L200)

Transient XMTP worker/network blips (common during dev HMR or welcome-stream retries).

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isWrongChainIdError()

> **isWrongChainIdError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:167](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L167)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpEnvironmentMismatchError()

> **isXmtpEnvironmentMismatchError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:154](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L154)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpNotRegisteredError()

> **isXmtpNotRegisteredError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:145](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L145)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpRateLimitError()

> **isXmtpRateLimitError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:214](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L214)

XMTP MLS API rate limits (QueryWelcomeMessages / welcome stream).

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### normalizeEvmAddress()

> **normalizeEvmAddress**(`value`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:30](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L30)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### parseWireContent()

> **parseWireContent**(`raw`): [`ParsedWireContent`](#parsedwirecontent)

Defined in: [src/lib/xmtp/xmtpHelpers.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L58)

#### Parameters

##### raw

`string`

#### Returns

[`ParsedWireContent`](#parsedwirecontent)

***

### readCanMessageBoolean()

> **readCanMessageBoolean**(`value`): `boolean` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:232](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L232)

#### Parameters

##### value

`unknown`

#### Returns

`boolean` \| `null`

***

### resolveConversationById()

> **resolveConversationById**(`conversationsApi`, `conversationId`, `options?`): `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:445](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L445)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

##### conversationId

`string`

##### options?

###### forceSync?

`boolean`

###### preferencesApi?

[`PreferencesApiLike`](#preferencesapilike) \| `null`

#### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

***

### resolveConversationByIdWithSyncRetries()

> **resolveConversationByIdWithSyncRetries**(`conversationsApi`, `conversationId`, `options?`): `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:484](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L484)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

##### conversationId

`string`

##### options?

###### delayMs?

`number`

###### forceSync?

`boolean`

###### preferencesApi?

[`PreferencesApiLike`](#preferencesapilike) \| `null`

###### rounds?

`number`

#### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

***

### shouldFallbackToOriginalXmtpRecipient()

> **shouldFallbackToOriginalXmtpRecipient**(`params`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:288](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L288)

#### Parameters

##### params

###### canonicalizedFromAddress

`` `0x${string}` `` \| `null`

###### originalCanMessage

`boolean` \| `null`

###### peerAddress

`` `0x${string}` ``

###### peerCanMessage

`boolean` \| `null`

#### Returns

`boolean`

***

### syncConversationsForGroupDiscovery()

> **syncConversationsForGroupDiscovery**(`conversationsApi`, `options?`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:403](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L403)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

##### options?

###### force?

`boolean`

###### lightweight?

`boolean`

#### Returns

`Promise`\<`void`\>

***

### truncateAddress()

> **truncateAddress**(`addr`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:25](https://github.com/wenakita/4626/blob/main/frontend/src/lib/xmtp/xmtpHelpers.ts#L25)

#### Parameters

##### addr

`string`

#### Returns

`string`
