[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/xmtp/xmtpHelpers

# src/lib/xmtp/xmtpHelpers

## Type Aliases

### ConversationLike

> **ConversationLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:300](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L300)

#### Properties

##### consentState()?

> `optional` **consentState**: () => `Promise`\<`ConsentState`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:303](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L303)

###### Returns

`Promise`\<`ConsentState`\>

##### id

> **id**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:301](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L301)

##### sync()?

> `optional` **sync**: () => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:302](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L302)

###### Returns

`Promise`\<`unknown`\>

##### updateConsentState()?

> `optional` **updateConsentState**: (`state`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:304](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L304)

###### Parameters

###### state

`ConsentState`

###### Returns

`Promise`\<`unknown`\>

***

### ConversationsApiLike

> **ConversationsApiLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:311](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L311)

#### Properties

##### getConversationById()

> **getConversationById**: (`id`) => `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:314](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L314)

###### Parameters

###### id

`string`

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

##### list()

> **list**: (`options?`) => `Promise`\<[`ConversationLike`](#conversationlike)[]\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:315](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L315)

###### Parameters

###### options?

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike)[]\>

##### listGroups()?

> `optional` **listGroups**: (`options?`) => `Promise`\<[`ConversationLike`](#conversationlike)[]\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:316](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L316)

###### Parameters

###### options?

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

###### Returns

`Promise`\<[`ConversationLike`](#conversationlike)[]\>

##### sync()

> **sync**: () => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:312](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L312)

###### Returns

`Promise`\<`unknown`\>

##### syncAll()?

> `optional` **syncAll**: (`consentStates?`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L313)

###### Parameters

###### consentStates?

`ConsentState`[]

###### Returns

`Promise`\<`unknown`\>

***

### ListConversationsOptionsLike

> **ListConversationsOptionsLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:307](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L307)

#### Properties

##### consentStates?

> `optional` **consentStates**: `ConsentState`[]

Defined in: [src/lib/xmtp/xmtpHelpers.ts:308](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L308)

***

### ParsedWireContent

> **ParsedWireContent** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:41](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L41)

#### Properties

##### actions?

> `optional` **actions**: \{ `buttons`: `object`[]; `description`: `string`; `promptId`: `string`; \} \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:46](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L46)

##### content

> **content**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:42](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L42)

##### contentType

> **contentType**: `ChatMessageContentType`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:43](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L43)

##### reactionEmoji?

> `optional` **reactionEmoji**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:51](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L51)

##### replyToId

> **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:45](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L45)

##### richPreview?

> `optional` **richPreview**: `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:44](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L44)

***

### PreferencesApiLike

> **PreferencesApiLike** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:319](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L319)

#### Properties

##### setConsentStates()?

> `optional` **setConsentStates**: (`records`) => `Promise`\<`unknown`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:320](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L320)

###### Parameters

###### records

`object`[]

###### Returns

`Promise`\<`unknown`\>

***

### SendChatMessageOptions

> **SendChatMessageOptions** = `object`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:115](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L115)

#### Properties

##### replyToId?

> `optional` **replyToId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:116](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L116)

##### replyToSenderInboxId?

> `optional` **replyToSenderInboxId**: `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:118](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L118)

Inbox id of the message being replied to (required for native XMTP replies).

***

### XmtpEnvLabel

> **XmtpEnvLabel** = `"production"` \| `"dev"` \| `"local"`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:129](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L129)

## Variables

### GROUP\_MEMBERSHIP\_CONSENT\_SYNC\_STATES

> `const` **GROUP\_MEMBERSHIP\_CONSENT\_SYNC\_STATES**: readonly \[`Unknown`, `Allowed`\]

Defined in: [src/lib/xmtp/xmtpHelpers.ts:326](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L326)

Consent states included when pulling server-side group memberships into a fresh browser install.

## Functions

### allowConversationIfUnknown()

> **allowConversationIfUnknown**(`convo`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:360](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L360)

#### Parameters

##### convo

[`ConversationLike`](#conversationlike)

#### Returns

`Promise`\<`void`\>

***

### allowGroupConsentById()

> **allowGroupConsentById**(`preferencesApi`, `groupId`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:335](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L335)

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

Defined in: [src/lib/xmtp/xmtpHelpers.ts:277](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L277)

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

Defined in: [src/lib/xmtp/xmtpHelpers.ts:293](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L293)

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

Defined in: [src/lib/xmtp/xmtpHelpers.ts:122](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L122)

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

Defined in: [src/lib/xmtp/xmtpHelpers.ts:210](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L210)

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

Defined in: [src/lib/xmtp/xmtpHelpers.ts:137](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L137)

#### Parameters

##### message

`string`

#### Returns

`string` \| `null`

***

### formatXmtpEnvLabel()

> **formatXmtpEnvLabel**(`env`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:131](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L131)

#### Parameters

##### env

[`XmtpEnvLabel`](#xmtpenvlabel)

#### Returns

`string`

***

### groupMembershipListOptions()

> **groupMembershipListOptions**(): [`ListConversationsOptionsLike`](#listconversationsoptionslike)

Defined in: [src/lib/xmtp/xmtpHelpers.ts:331](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L331)

#### Returns

[`ListConversationsOptionsLike`](#listconversationsoptionslike)

***

### hexToBytes()

> **hexToBytes**(`hex`): `Uint8Array`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L16)

#### Parameters

##### hex

`string`

#### Returns

`Uint8Array`

***

### isInstallationLimitError()

> **isInstallationLimitError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:162](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L162)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isLocalXmtpStateInvalidError()

> **isLocalXmtpStateInvalidError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:191](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L191)

Local OPFS install no longer validates against the XMTP network inbox.

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isOpfsAccessHandleError()

> **isOpfsAccessHandleError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:180](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L180)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isScwSignatureValidationError()

> **isScwSignatureValidationError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:172](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L172)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isWrongChainIdError()

> **isWrongChainIdError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:167](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L167)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpEnvironmentMismatchError()

> **isXmtpEnvironmentMismatchError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:154](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L154)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### isXmtpNotRegisteredError()

> **isXmtpNotRegisteredError**(`message`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:145](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L145)

#### Parameters

##### message

`string`

#### Returns

`boolean`

***

### normalizeEvmAddress()

> **normalizeEvmAddress**(`value`): `string` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:30](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L30)

#### Parameters

##### value

`unknown`

#### Returns

`string` \| `null`

***

### parseWireContent()

> **parseWireContent**(`raw`): [`ParsedWireContent`](#parsedwirecontent)

Defined in: [src/lib/xmtp/xmtpHelpers.ts:58](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L58)

#### Parameters

##### raw

`string`

#### Returns

[`ParsedWireContent`](#parsedwirecontent)

***

### readCanMessageBoolean()

> **readCanMessageBoolean**(`value`): `boolean` \| `null`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:203](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L203)

#### Parameters

##### value

`unknown`

#### Returns

`boolean` \| `null`

***

### resolveConversationById()

> **resolveConversationById**(`conversationsApi`, `conversationId`, `options?`): `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:423](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L423)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

##### conversationId

`string`

##### options?

###### preferencesApi?

[`PreferencesApiLike`](#preferencesapilike) \| `null`

#### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

***

### resolveConversationByIdWithSyncRetries()

> **resolveConversationByIdWithSyncRetries**(`conversationsApi`, `conversationId`, `options?`): `Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:459](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L459)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

##### conversationId

`string`

##### options?

###### delayMs?

`number`

###### preferencesApi?

[`PreferencesApiLike`](#preferencesapilike) \| `null`

###### rounds?

`number`

#### Returns

`Promise`\<[`ConversationLike`](#conversationlike) \| `null`\>

***

### shouldFallbackToOriginalXmtpRecipient()

> **shouldFallbackToOriginalXmtpRecipient**(`params`): `boolean`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:259](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L259)

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

> **syncConversationsForGroupDiscovery**(`conversationsApi`): `Promise`\<`void`\>

Defined in: [src/lib/xmtp/xmtpHelpers.ts:374](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L374)

#### Parameters

##### conversationsApi

[`ConversationsApiLike`](#conversationsapilike)

#### Returns

`Promise`\<`void`\>

***

### truncateAddress()

> **truncateAddress**(`addr`): `string`

Defined in: [src/lib/xmtp/xmtpHelpers.ts:25](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/xmtp/xmtpHelpers.ts#L25)

#### Parameters

##### addr

`string`

#### Returns

`string`
