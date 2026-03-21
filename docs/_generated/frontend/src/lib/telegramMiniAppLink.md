[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramMiniAppLink

# src/lib/telegramMiniAppLink

## Type Aliases

### TelegramMiniAppLinkContext

> **TelegramMiniAppLinkContext** = `object`

Defined in: [src/lib/telegramMiniAppLink.ts:16](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L16)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegramMiniAppLink.ts:18](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L18)

##### linkToken

> **linkToken**: `string`

Defined in: [src/lib/telegramMiniAppLink.ts:17](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L17)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegramMiniAppLink.ts:19](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L19)

## Functions

### clearStoredTelegramMiniAppLinkContext()

> **clearStoredTelegramMiniAppLinkContext**(): `void`

Defined in: [src/lib/telegramMiniAppLink.ts:88](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L88)

#### Returns

`void`

***

### persistTelegramMiniAppLinkContext()

> **persistTelegramMiniAppLinkContext**(`context`): `void`

Defined in: [src/lib/telegramMiniAppLink.ts:41](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L41)

#### Parameters

##### context

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) | `null`

#### Returns

`void`

***

### readStoredTelegramMiniAppLinkContext()

> **readStoredTelegramMiniAppLinkContext**(): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegramMiniAppLink.ts:62](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L62)

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### readTelegramMiniAppLinkContext()

> **readTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegramMiniAppLink.ts:26](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L26)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### resolveTelegramMiniAppLinkContext()

> **resolveTelegramMiniAppLinkContext**(`searchParams`): [`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

Defined in: [src/lib/telegramMiniAppLink.ts:97](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L97)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

[`TelegramMiniAppLinkContext`](#telegramminiapplinkcontext) \| `null`

***

### stripTelegramMiniAppLinkParams()

> **stripTelegramMiniAppLinkParams**(`searchParams`): `URLSearchParams`

Defined in: [src/lib/telegramMiniAppLink.ts:106](https://github.com/wenakita/4626/blob/c2a42e6230549df4595e4edc67f4bf4d17f49898/frontend/src/lib/telegramMiniAppLink.ts#L106)

#### Parameters

##### searchParams

`URLSearchParams`

#### Returns

`URLSearchParams`
