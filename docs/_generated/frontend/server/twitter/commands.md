[**4626-web**](../../index.md)

***

[4626-web](../../index.md) / server/twitter/commands

# server/twitter/commands

## Type Aliases

### TwitterCommandFailure

> **TwitterCommandFailure** = `object`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L16)

#### Properties

##### action?

> `optional` **action**: `any`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L16)

##### ok

> **ok**: `false`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L16)

##### response

> **response**: `string`

Defined in: [server/twitter/commands.ts:16](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L16)

***

### TwitterCommandResult

> **TwitterCommandResult** = \{ `action?`: `any`; `ok`: `true`; `response`: `string`; \} \| [`TwitterCommandFailure`](#twittercommandfailure)

Defined in: [server/twitter/commands.ts:18](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L18)

***

### TwitterRole

> **TwitterRole** = `"OWNER"` \| `"ADMIN"` \| `"MEMBER"`

Defined in: [server/twitter/commands.ts:14](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L14)

## Functions

### handleTwitterCommand()

> **handleTwitterCommand**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:637](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L637)

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

### isTweetMediaDownloadFailure()

> **isTweetMediaDownloadFailure**(`response`): `boolean`

Defined in: [server/twitter/commands.ts:361](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L361)

#### Parameters

##### response

`string`

#### Returns

`boolean`

***

### postTweetFromSystem()

> **postTweetFromSystem**(`params`): `Promise`\<[`TwitterCommandResult`](#twittercommandresult)\>

Defined in: [server/twitter/commands.ts:607](https://github.com/wenakita/4626/blob/main/frontend/server/twitter/commands.ts#L607)

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
