[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / server/agent/eliza/plugins/xmtp/service

# server/agent/eliza/plugins/xmtp/service

## Classes

### XmtpService

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:241](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L241)

#### Constructors

##### Constructor

> **new XmtpService**(`config`): [`XmtpService`](#xmtpservice)

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:255](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L255)

###### Parameters

###### config

[`XmtpConfig`](#xmtpconfig)

###### Returns

[`XmtpService`](#xmtpservice)

#### Accessors

##### address

###### Get Signature

> **get** **address**(): `string` \| `undefined`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:264](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L264)

###### Returns

`string` \| `undefined`

##### isRunning

###### Get Signature

> **get** **isRunning**(): `boolean`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:268](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L268)

###### Returns

`boolean`

#### Methods

##### createDm()

> **createDm**(`address`): `Promise`\<`string`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:459](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L459)

Create a DM with an address

###### Parameters

###### address

`string`

###### Returns

`Promise`\<`string`\>

##### deriveConversationArchiveKey()

> **deriveConversationArchiveKey**(`conversationId`): `Promise`\<`string` \| `null`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:481](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L481)

Derive a stable, conversation-scoped archive key from the XMTP signer.
This avoids using app-level env secrets for Grove archive encryption.

###### Parameters

###### conversationId

`string`

###### Returns

`Promise`\<`string` \| `null`\>

##### getHealth()

> **getHealth**(): `object`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:272](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L272)

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

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:466](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L466)

Resolve an inbox ID to an Ethereum address

###### Parameters

###### inboxId

`string`

###### Returns

`Promise`\<`string` \| `null`\>

##### sendToConversation()

> **sendToConversation**(`conversationId`, `text`): `Promise`\<`void`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:451](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L451)

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

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:260](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L260)

Register a callback that receives messages and returns an optional reply

###### Parameters

###### handler

[`OnMessageCallback`](#onmessagecallback)

###### Returns

`void`

##### start()

> **start**(): `Promise`\<`void`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:291](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L291)

Start the XMTP agent and begin streaming messages

###### Returns

`Promise`\<`void`\>

##### stop()

> **stop**(): `Promise`\<`void`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:437](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L437)

Stop the XMTP agent

###### Returns

`Promise`\<`void`\>

## Type Aliases

### OnMessageCallback()

> **OnMessageCallback** = (`msg`) => `Promise`\<`string` \| `null`\>

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:233](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L233)

#### Parameters

##### msg

[`XmtpMessage`](#xmtpmessage)

#### Returns

`Promise`\<`string` \| `null`\>

***

### XmtpConfig

> **XmtpConfig** = `object`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:188](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L188)

#### Properties

##### dbEncryptionKey?

> `optional` **dbEncryptionKey**: `` `0x${string}` ``

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:211](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L211)

Hex-encoded encryption key for the XMTP local database (0x-prefixed, 32 bytes).
Required by the SDK to encrypt/decrypt the persisted .db3 files.
Must be the same key across restarts so the DB can be reopened.

Generate with: `openssl rand -hex 32` (then prefix with 0x).

##### dbPath?

> `optional` **dbPath**: `string` \| `null` \| (`inboxId`) => `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:203](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L203)

Stable path (or factory) for the XMTP local database.
If provided, the SDK reuses the same installation across restarts
instead of creating a new one each time.

Can be a string (absolute path to the .db3 file), a function
`(inboxId: string) => string`, or `null` for in-memory.

##### env?

> `optional` **env**: `"production"` \| `"dev"` \| `"local"`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:194](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L194)

XMTP network: 'production' | 'dev' | 'local'

##### privateKey?

> `optional` **privateKey**: `` `0x${string}` ``

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:190](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L190)

Hex-encoded private key for the XMTP agent identity (EOA mode)

##### revokeOtherInstallations?

> `optional` **revokeOtherInstallations**: `boolean`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:217](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L217)

If true, revoke all other installations for this inbox after
connecting. Use this to recover from the 10/10 installation limit.
Defaults to false.

##### signer?

> `optional` **signer**: `any`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:192](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L192)

Custom signer (CSW mode — passed directly to Agent.create)

***

### XmtpMessage

> **XmtpMessage** = `object`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:220](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L220)

#### Properties

##### content

> **content**: `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:226](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L226)

##### conversationArchiveKey?

> `optional` **conversationArchiveKey**: `string` \| `null`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:230](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L230)

##### conversationId

> **conversationId**: `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:221](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L221)

##### conversationType

> **conversationType**: `"dm"` \| `"group"`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:222](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L222)

##### isSelf

> **isSelf**: `boolean`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:229](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L229)

##### messageId

> **messageId**: `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:225](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L225)

##### senderAddress

> **senderAddress**: `string` \| `null`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:224](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L224)

##### senderInboxId

> **senderInboxId**: `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:223](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L223)

##### sentAt

> **sentAt**: `Date`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:227](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L227)

##### sentAtMs

> **sentAtMs**: `number`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:228](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L228)

## Functions

### deriveInboundMessageDedupeKey()

> **deriveInboundMessageDedupeKey**(`input`): `string`

Defined in: [server/agent/eliza/plugins/xmtp/service.ts:59](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/agent/eliza/plugins/xmtp/service.ts#L59)

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
