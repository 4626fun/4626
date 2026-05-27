[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/commands/families/conversation

# server/commands/families/conversation

## Functions

### executeConversationalCommandFamily()

> **executeConversationalCommandFamily**(`params`): `Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

Defined in: [server/commands/families/conversation.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/commands/families/conversation.ts#L18)

#### Parameters

##### params

###### groupId

`string`

###### senderWallet

`string`

###### text

`string`

###### vault

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

***

### looksLikeConversationalCommand()

> **looksLikeConversationalCommand**(`text`): `boolean`

Defined in: [server/commands/families/conversation.ts:13](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/commands/families/conversation.ts#L13)

#### Parameters

##### text

`string`

#### Returns

`boolean`
