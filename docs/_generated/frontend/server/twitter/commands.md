[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/twitter/commands

# server/twitter/commands

## Type Aliases

### TwitterCommandFailure

> **TwitterCommandFailure** = `object`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L16)

#### Properties

##### action?

> `optional` **action**: `any`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L16)

##### ok

> **ok**: `false`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L16)

##### response

> **response**: `string`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L16)

***

### TwitterCommandResult

> **TwitterCommandResult** = \{ `action?`: `any`; `ok`: `true`; `response`: `string`; \} \| [`TwitterCommandFailure`](#twittercommandfailure)

Defined in: [server/twitter/commands.ts:18](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L18)

***

### TwitterRole

> **TwitterRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/twitter/commands.ts:14](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L14)

## Functions

### handleTwitterCommand()

> **handleTwitterCommand**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:616](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L616)

Handle Twitter/X commands from Keepr chats.

#### Parameters

##### params

###### groupId

`string`

###### role

[`TwitterRole`](#twitterrole)

###### senderWallet

`string`

###### text

`string`

#### Returns

`Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

***

### postTweetFromSystem()

> **postTweetFromSystem**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:586](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/twitter/commands.ts#L586)

#### Parameters

##### params

###### groupId

`string`

###### media?

`TweetMediaInput` \| `null`

###### senderWallet

`string`

###### text

`string`

#### Returns

`Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>
