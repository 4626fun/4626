[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / server/\_lib/alfaclub/telegramToAlfaclubRelay

# server/\_lib/alfaclub/telegramToAlfaclubRelay

## Type Aliases

### TelegramToAlfaclubRelayConfig

> **TelegramToAlfaclubRelayConfig** = `object`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:19](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L19)

#### Properties

##### enabled

> **enabled**: `boolean`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:20](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L20)

##### prefix

> **prefix**: `string`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:24](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L24)

##### roomId

> **roomId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:23](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L23)

##### sourceChatId

> **sourceChatId**: `string` \| `null`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:21](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L21)

##### sourceThreadId

> **sourceThreadId**: `number` \| `null`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:22](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L22)

##### textOnly

> **textOnly**: `boolean`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:25](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L25)

***

### TelegramToAlfaclubRelayResult

> **TelegramToAlfaclubRelayResult** = \{ `status`: `"disabled"`; \} \| \{ `reason`: `string`; `status`: `"skipped"`; \} \| \{ `lane`: `string`; `roomId`: `string`; `status`: `"relayed"`; \} \| \{ `error`: `string`; `status`: `"failed"`; \}

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:133](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L133)

## Functions

### formatTelegramToAlfaclubBody()

> **formatTelegramToAlfaclubBody**(`params`): `string`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:106](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L106)

#### Parameters

##### params

###### maxChars?

`number`

###### prefix?

`string`

###### text

`string`

###### userId?

`string` \| `null`

###### username?

`string` \| `null`

#### Returns

`string`

***

### matchesTelegramToAlfaclubSource()

> **matchesTelegramToAlfaclubSource**(`params`): `boolean`

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:71](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L71)

#### Parameters

##### params

###### chatId

`string`

###### config?

[`TelegramToAlfaclubRelayConfig`](#telegramtoalfaclubrelayconfig)

###### messageThreadId?

`number` \| `null`

#### Returns

`boolean`

***

### readTelegramToAlfaclubRelayConfig()

> **readTelegramToAlfaclubRelayConfig**(`env`): [`TelegramToAlfaclubRelayConfig`](#telegramtoalfaclubrelayconfig)

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:52](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L52)

#### Parameters

##### env

`Record`\<`string`, `string` \| `undefined`\> = `process.env`

#### Returns

[`TelegramToAlfaclubRelayConfig`](#telegramtoalfaclubrelayconfig)

***

### relayTelegramMessageToAlfaClub()

> **relayTelegramMessageToAlfaClub**(`params`): `Promise`\<[`TelegramToAlfaclubRelayResult`](#telegramtoalfaclubrelayresult)\>

Defined in: [server/\_lib/alfaclub/telegramToAlfaclubRelay.ts:143](https://github.com/wenakita/4626/blob/main/frontend/server/_lib/alfaclub/telegramToAlfaclubRelay.ts#L143)

When the update matches the configured Telegram source, post into AlfaClub and
return `relayed` so the webhook can skip duplicate local command handling.

#### Parameters

##### params

###### chatId

`string`

###### config?

[`TelegramToAlfaclubRelayConfig`](#telegramtoalfaclubrelayconfig)

###### messageId?

`number`

###### messageThreadId?

`number` \| `null`

###### text

`string`

###### userId?

`string` \| `null`

###### username?

`string` \| `null`

#### Returns

`Promise`\<[`TelegramToAlfaclubRelayResult`](#telegramtoalfaclubrelayresult)\>
