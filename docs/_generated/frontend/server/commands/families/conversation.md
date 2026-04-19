[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / server/commands/families/conversation

# server/commands/families/conversation

## Functions

### executeConversationalCommandFamily()

> **executeConversationalCommandFamily**(`params`): `Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

Defined in: [server/commands/families/conversation.ts:18](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/commands/families/conversation.ts#L18)

#### Parameters

##### params

###### groupId

`string`

###### senderWallet

`` `0x${string}` ``

###### text

`string`

###### vault

[`KeeprVaultRow`](../../_lib/keepr/keeprRegistry.md#keeprvaultrow) \| `null`

#### Returns

`Promise`\<[`KeeprCommandResult`](../types.md#keeprcommandresult)\>

***

### looksLikeConversationalCommand()

> **looksLikeConversationalCommand**(`text`): `boolean`

Defined in: [server/commands/families/conversation.ts:13](https://github.com/wenakita/4626/blob/c357a10b6f5509ab0bdf7d1d5237d52e95f3962e/frontend/server/commands/families/conversation.ts#L13)

#### Parameters

##### text

`string`

#### Returns

`boolean`
