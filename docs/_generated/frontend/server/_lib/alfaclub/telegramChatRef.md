[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/telegramChatRef

# server/\_lib/alfaclub/telegramChatRef

## Functions

### extractTelegramRelayCommandText()

> **extractTelegramRelayCommandText**(`rawText`): `string`

Defined in: [server/\_lib/alfaclub/telegramChatRef.ts:60](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/telegramChatRef.ts#L60)

Telegram → AlfaClub relay posts often prefix the payload (`@user: /alfa …`).
The chat bridge only treats lines that start with `/` as slash commands.

#### Parameters

##### rawText

`string`

#### Returns

`string`

***

### normalizeTelegramChatIdForMatch()

> **normalizeTelegramChatIdForMatch**(`chatId`): `string`

Defined in: [server/\_lib/alfaclub/telegramChatRef.ts:52](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/telegramChatRef.ts#L52)

#### Parameters

##### chatId

`string`

#### Returns

`string`

***

### parseTelegramChatRef()

> **parseTelegramChatRef**(`value`): `object`

Defined in: [server/\_lib/alfaclub/telegramChatRef.ts:24](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/server/_lib/alfaclub/telegramChatRef.ts#L24)

#### Parameters

##### value

`string` | `null`

#### Returns

`object`

##### chatId

> **chatId**: `string` \| `null`

##### inferredThreadId

> **inferredThreadId**: `number` \| `null`
