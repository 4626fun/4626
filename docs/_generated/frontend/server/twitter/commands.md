[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / server/twitter/commands

# server/twitter/commands

## Type Aliases

### TwitterCommandFailure

> **TwitterCommandFailure** = `object`

Defined in: [server/twitter/commands.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L11)

#### Properties

##### action?

> `optional` **action**: `any`

Defined in: [server/twitter/commands.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L11)

##### ok

> **ok**: `false`

Defined in: [server/twitter/commands.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L11)

##### response

> **response**: `string`

Defined in: [server/twitter/commands.ts:11](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L11)

***

### TwitterCommandResult

> **TwitterCommandResult** = \{ `action?`: `any`; `ok`: `true`; `response`: `string`; \} \| [`TwitterCommandFailure`](#twittercommandfailure)

Defined in: [server/twitter/commands.ts:13](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L13)

***

### TwitterRole

> **TwitterRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/twitter/commands.ts:9](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L9)

## Functions

### handleTwitterCommand()

> **handleTwitterCommand**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:422](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L422)

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
