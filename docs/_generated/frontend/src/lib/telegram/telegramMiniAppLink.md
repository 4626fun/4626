[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/telegram/telegramMiniAppLink

# src/lib/telegram/telegramMiniAppLink

## Type Aliases

### TelegramMiniAppLinkContext

> **TelegramMiniAppLinkContext** = `object`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:18](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L18)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:20](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L20)

##### linkToken

> **linkToken**: `string`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:19](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L19)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:21](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L21)

## Functions

### clearStoredTelegramMiniAppLinkContext()

> **clearStoredTelegramMiniAppLinkContext**(): `void`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:101](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L101)

#### Returns

`void`

***

### persistTelegramMiniAppLinkContext()

> **persistTelegramMiniAppLinkContext**(`context`): `void`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:52](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L52)

#### Parameters

##### context

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) | `null`

#### Returns

`void`

***

### readStoredTelegramMiniAppLinkContext()

> **readStoredTelegramMiniAppLinkContext**(): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:74](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L74)

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### readTelegramMiniAppLinkContext()

> **readTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:37](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L37)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### resolveTelegramMiniAppLinkContext()

> **resolveTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:111](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L111)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### stripTelegramMiniAppLinkParams()

> **stripTelegramMiniAppLinkParams**(`searchParams`): `URLSearchParams`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:120](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegram/telegramMiniAppLink.ts#L120)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

`URLSearchParams`
