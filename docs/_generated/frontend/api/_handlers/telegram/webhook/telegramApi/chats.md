[**4626-app**](../../../../../index.md)

***

[4626-app](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/chats

# api/\_handlers/telegram/webhook/telegramApi/chats

## Functions

### createTelegramHolderRoomInviteLink()

> **createTelegramHolderRoomInviteLink**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:3](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L3)

#### Parameters

##### params

###### botToken

`string`

###### roomChatId

`string`

###### ttlSeconds?

`number`

#### Returns

`Promise`\<`string` \| `null`\>

***

### readTelegramChatMemberStatus()

> **readTelegramChatMemberStatus**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:30](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L30)

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### userId

`string`

#### Returns

`Promise`\<`string` \| `null`\>
