[**4626-app**](../../../index.md)

***

[4626-app](../../../index.md) / src/lib/telegram/telegramMiniAppLink

# src/lib/telegram/telegramMiniAppLink

## Type Aliases

### TelegramMiniAppLinkContext

> **TelegramMiniAppLinkContext** = `object`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:16](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L16)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:18](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L18)

##### linkToken

> **linkToken**: `string`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:17](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L17)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:19](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L19)

## Functions

### clearStoredTelegramMiniAppLinkContext()

> **clearStoredTelegramMiniAppLinkContext**(): `void`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:99](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L99)

#### Returns

`void`

***

### persistTelegramMiniAppLinkContext()

> **persistTelegramMiniAppLinkContext**(`context`): `void`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:50](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L50)

#### Parameters

##### context

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) | `null`

#### Returns

`void`

***

### readStoredTelegramMiniAppLinkContext()

> **readStoredTelegramMiniAppLinkContext**(): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:72](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L72)

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### readTelegramMiniAppLinkContext()

> **readTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:35](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L35)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### resolveTelegramMiniAppLinkContext()

> **resolveTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:109](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L109)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### stripTelegramMiniAppLinkParams()

> **stripTelegramMiniAppLinkParams**(`searchParams`): `URLSearchParams`

Defined in: [src/lib/telegram/telegramMiniAppLink.ts:118](https://github.com/wenakita/4626/blob/0784d648d0f6e26c4308970d2a195bd0b0ff1619/frontend/src/lib/telegram/telegramMiniAppLink.ts#L118)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

`URLSearchParams`
