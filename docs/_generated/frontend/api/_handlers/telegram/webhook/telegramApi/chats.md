[**4626-web**](../../../../../index.md)

***

[4626-web](../../../../../index.md) / api/\_handlers/telegram/webhook/telegramApi/chats

# api/\_handlers/telegram/webhook/telegramApi/chats

## Type Aliases

### TelegramChatMemberRole

> **TelegramChatMemberRole** = `"admin"` \| `"member"` \| `"unknown"`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:12](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L12)

Logical Telegram chat-member role used for authorization of setup commands.
Intentionally narrower than the raw Telegram status strings:
  - 'admin'   = Telegram 'creator' or 'administrator'
  - 'member'  = any other known non-admin status ('member', 'restricted', 'left', 'kicked')
  - 'unknown' = getChatMember failed or returned a status we did not recognize

Callers MUST fail closed on 'unknown' (refuse the action, do not allow).

## Variables

### TELEGRAM\_GROUP\_ANONYMOUS\_BOT\_ID

> `const` **TELEGRAM\_GROUP\_ANONYMOUS\_BOT\_ID**: `"1087968824"` = `'1087968824'`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:20](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L20)

Telegram's well-known ID for the GroupAnonymousBot. When a group admin posts
anonymously, `from.id` is this constant instead of a real user id. We treat
any message attributed to this id as coming from an admin.
https://core.telegram.org/bots/api#message

## Functions

### \_\_resetTelegramChatMemberRoleCache()

> **\_\_resetTelegramChatMemberRoleCache**(): `void`

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L85)

Test-only: clears the in-memory role cache.

#### Returns

`void`

***

### createTelegramHolderRoomInviteLink()

> **createTelegramHolderRoomInviteLink**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:22](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L22)

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

### readTelegramChatMemberRole()

> **readTelegramChatMemberRole**(`params`): `Promise`\<[`TelegramChatMemberRole`](#telegramchatmemberrole)\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:100](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L100)

Read the logical admin/member role of a user in a chat, with a 60s TTL cache.

Returns:
  - 'admin' for Telegram status 'creator' or 'administrator'
  - 'admin' if userId === TELEGRAM_GROUP_ANONYMOUS_BOT_ID (anonymous admin)
  - 'member' for any other known status
  - 'unknown' if botToken is missing, inputs are empty, or getChatMember failed

Callers must fail closed on 'unknown'.

#### Parameters

##### params

###### botToken

`string`

###### chatId

`string`

###### fetchStatus?

(`args`) => `Promise`\<`string` \| `null`\>

###### now?

() => `number`

###### userId

`string`

#### Returns

`Promise`\<[`TelegramChatMemberRole`](#telegramchatmemberrole)\>

***

### readTelegramChatMemberStatus()

> **readTelegramChatMemberStatus**(`params`): `Promise`\<`string` \| `null`\>

Defined in: [api/\_handlers/telegram/webhook/telegramApi/chats.ts:49](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/api/_handlers/telegram/webhook/telegramApi/chats.ts#L49)

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
