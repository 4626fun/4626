[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / server/agents/eliza/plugins/xmtp/service

# server/agents/eliza/plugins/xmtp/service

## Classes

### XmtpService

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:314](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L314)

#### Constructors

##### Constructor

> **new XmtpService**(`config`): [`XmtpService`](#xmtpservice)

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:328](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L328)

###### Parameters

###### config

[`XmtpConfig`](#xmtpconfig)

###### Returns

[`XmtpService`](#xmtpservice)

#### Accessors

##### address

###### Get Signature

> **get** **address**(): `string` \| `undefined`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:337](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L337)

###### Returns

`string` \| `undefined`

##### isRunning

###### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:341](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L341)

###### Returns

`boolean`

#### Methods

##### createDm()

> **createDm**(`address`): `Promise`\<`string`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:534](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L534)

Create a DM with an address

###### Parameters

###### address

`string`

###### Returns

`Promise`\<`string`\>

##### deriveConversationArchiveKey()

> **deriveConversationArchiveKey**(`conversationId`): `Promise`\<`string` \| `null`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:556](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L556)

Derive a stable, conversation-scoped archive key from the XMTP signer.
This avoids using app-level env secrets for Grove archive encryption.

###### Parameters

###### conversationId

`string`

###### Returns

`Promise`\<`string` \| `null`\>

##### getHealth()

> **getHealth**(): `object`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:345](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L345)

###### Returns

`object`

###### address

> **address**: `string` \| `null`

###### lastError

> **lastError**: `string` \| `null`

###### lastMessageAtMs

> **lastMessageAtMs**: `number` \| `null`

###### lastStartedAtMs

> **lastStartedAtMs**: `number` \| `null`

###### running

> **running**: `boolean`

###### state

> **state**: `XmtpLifecycleState`

##### resolveInboxAddress()

> **resolveInboxAddress**(`inboxId`): `Promise`\<`string` \| `null`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:541](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L541)

Resolve an inbox ID to an Ethereum address

###### Parameters

###### inboxId

`string`

###### Returns

`Promise`\<`string` \| `null`\>

##### sendToConversation()

> **sendToConversation**(`conversationId`, `text`): `Promise`\<`void`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:526](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L526)

Send a text message to a conversation

###### Parameters

###### conversationId

`string`

###### text

`string`

###### Returns

`Promise`\<`void`\>

##### setMessageHandler()

> **setMessageHandler**(`handler`): `void`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:333](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L333)

Register a callback that receives messages and returns an optional reply

###### Parameters

###### handler

[`OnMessageCallback`](#onmessagecallback)

###### Returns

`void`

##### start()

> **start**(): `Promise`\<`void`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:364](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L364)

Start the XMTP agent and begin streaming messages

###### Returns

`Promise`\<`void`\>

##### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:512](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L512)

Stop the XMTP agent

###### Returns

`Promise`\<`void`\>

## Type Aliases

### OnMessageCallback()

> **OnMessageCallback** = (`msg`) => `Promise`\<[`XmtpAgentReply`](../../../../../src/lib/xmtp/xmtpInteractive.md#xmtpagentreply) \| `string` \| `null`\>

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:249](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L249)

#### Parameters

##### msg

[`XmtpMessage`](#xmtpmessage)

#### Returns

`Promise`\<[`XmtpAgentReply`](../../../../../src/lib/xmtp/xmtpInteractive.md#xmtpagentreply) \| `string` \| `null`\>

***

### XmtpConfig

> **XmtpConfig** = `object`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:197](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L197)

#### Properties

##### dbEncryptionKey?

> `optional` **dbEncryptionKey**: `` `0x${string}` ``

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:220](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L220)

Hex-encoded encryption key for the XMTP local database (0x-prefixed, 32 bytes).
Required by the SDK to encrypt/decrypt the persisted .db3 files.
Must be the same key across restarts so the DB can be reopened.

Generate with: `openssl rand -hex 32` (then prefix with 0x).

##### dbPath?

> `optional` **dbPath**: `string` \| `null` \| (`inboxId`) => `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:212](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L212)

Stable path (or factory) for the XMTP local database.
If provided, the SDK reuses the same installation across restarts
instead of creating a new one each time.

Can be a string (absolute path to the .db3 file), a function
`(inboxId: string) => string`, or `null` for in-memory.

##### env?

> `optional` **env**: `"production"` \| `"dev"` \| `"local"`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:203](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L203)

XMTP network: 'production' | 'dev' | 'local'

##### privateKey?

> `optional` **privateKey**: `` `0x${string}` ``

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:199](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L199)

Hex-encoded private key for the XMTP agent identity (EOA mode)

##### revokeOtherInstallations?

> `optional` **revokeOtherInstallations**: `boolean`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:226](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L226)

If true, revoke all other installations for this inbox after
connecting. Use this to recover from the 10/10 installation limit.
Defaults to false.

##### signer?

> `optional` **signer**: `any`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:201](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L201)

Custom signer (CSW mode — passed directly to Agent.create)

***

### XmtpMessage

> **XmtpMessage** = `object`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:229](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L229)

#### Properties

##### clientHint

> **clientHint**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:245](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L245)

##### codec

> **codec**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:244](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L244)

##### content

> **content**: `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:236](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L236)

##### contentType

> **contentType**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:243](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L243)

##### conversationArchiveKey?

> `optional` **conversationArchiveKey**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:240](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L240)

##### conversationId

> **conversationId**: `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:230](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L230)

##### conversationType

> **conversationType**: `"dm"` \| `"group"`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L231)

##### isSelf

> **isSelf**: `boolean`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:239](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L239)

##### messageId

> **messageId**: `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:235](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L235)

##### parseStatus

> **parseStatus**: `"ok"` \| `"non_text_coerced"`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:246](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L246)

##### recipientAddress

> **recipientAddress**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:232](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L232)

##### senderAddress

> **senderAddress**: `string` \| `null`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:234](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L234)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:233](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L233)

##### sentAt

> **sentAt**: `Date`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:237](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L237)

##### sentAtMs

> **sentAtMs**: `number`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:238](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L238)

##### source

> **source**: `"xmtp"`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:241](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L241)

##### sourceHint

> **sourceHint**: `"unknown"` \| `"zora_likely"` \| `"app_likely"`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:242](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L242)

## Functions

### deriveInboundMessageDedupeKey()

> **deriveInboundMessageDedupeKey**(`input`): `string`

Defined in: [server/agents/eliza/plugins/xmtp/service.ts:68](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/agents/eliza/plugins/xmtp/service.ts#L68)

#### Parameters

##### input

###### content

`string`

###### conversationId

`string`

###### messageId?

`string` \| `null`

###### senderInboxId

`string`

###### sentAtMs?

`number` \| `null`

#### Returns

`string`
