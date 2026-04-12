[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/twitter/commands

# server/twitter/commands

## Type Aliases

### TwitterCommandResult

> **TwitterCommandResult** = \{ `action?`: `any`; `ok`: `true`; `response`: `string`; \} \| `TwitterCommandFailure`

Defined in: [server/twitter/commands.ts:13](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/twitter/commands.ts#L13)

***

### TwitterRole

> **TwitterRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/twitter/commands.ts:9](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/twitter/commands.ts#L9)

## Functions

### handleTwitterCommand()

> **handleTwitterCommand**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:422](https://github.com/wenakita/4626/blob/7e6202c0ac5749d4a679198595b6dbea9ce54e9b/frontend/server/twitter/commands.ts#L422)

Handle Twitter/X commands from Keepr chats.

#### Parameters

##### params

###### groupId

`string`

###### role

[`TwitterRole`](#twitterrole)

###### senderWallet

`` `0x${string}` ``

###### text

`string`

#### Returns

`Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>
