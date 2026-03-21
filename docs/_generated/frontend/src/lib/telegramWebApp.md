[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramWebApp

# src/lib/telegramWebApp

## Type Aliases

### PrivyTelegramLaunchParams

> **PrivyTelegramLaunchParams** = `object`

Defined in: [src/lib/telegramWebApp.ts:197](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L197)

#### Properties

##### initDataRaw?

> `optional` **initDataRaw**: `string`

Defined in: [src/lib/telegramWebApp.ts:198](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L198)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [src/lib/telegramWebApp.ts:50](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L50)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:56](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L56)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:58](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L58)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:57](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L57)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/lib/telegramWebApp.ts:53](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L53)

##### initData

> **initData**: `string`

Defined in: [src/lib/telegramWebApp.ts:51](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L51)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/lib/telegramWebApp.ts:52](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L52)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/lib/telegramWebApp.ts:54](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L54)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:55](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L55)

## Functions

### ensureTelegramMiniAppSession()

> **ensureTelegramMiniAppSession**(`params?`): `Promise`\<`EnsureTelegramMiniAppSessionResult`\>

Defined in: [src/lib/telegramWebApp.ts:277](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L277)

#### Parameters

##### params?

###### fetcher?

(`path`, `init?`) => `Promise`\<`Response`\>

#### Returns

`Promise`\<`EnsureTelegramMiniAppSessionResult`\>

***

### hasTelegramMiniAppEntrypointContext()

> **hasTelegramMiniAppEntrypointContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:178](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L178)

#### Returns

`boolean`

***

### isTelegramMiniAppContext()

> **isTelegramMiniAppContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:174](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L174)

#### Returns

`boolean`

***

### loadTelegramWebApp()

> **loadTelegramWebApp**(): `Promise`\<`TelegramWebAppLike` \| `null`\>

Defined in: [src/lib/telegramWebApp.ts:207](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L207)

#### Returns

`Promise`\<`TelegramWebAppLike` \| `null`\>

***

### readPrivyTelegramLaunchParams()

> **readPrivyTelegramLaunchParams**(): [`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

Defined in: [src/lib/telegramWebApp.ts:201](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L201)

#### Returns

[`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

***

### readTelegramMiniAppIdentityKey()

> **readTelegramMiniAppIdentityKey**(): `string`

Defined in: [src/lib/telegramWebApp.ts:191](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L191)

#### Returns

`string`

***

### readTelegramMiniAppInitData()

> **readTelegramMiniAppInitData**(): `string`

Defined in: [src/lib/telegramWebApp.ts:170](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L170)

#### Returns

`string`

***

### readTelegramWebApp()

> **readTelegramWebApp**(): `TelegramWebAppLike` \| `null`

Defined in: [src/lib/telegramWebApp.ts:166](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L166)

#### Returns

`TelegramWebAppLike` \| `null`

***

### setupTelegramMiniAppUi()

> **setupTelegramMiniAppUi**(`params?`): () => `void`

Defined in: [src/lib/telegramWebApp.ts:235](https://github.com/wenakita/4626/blob/db3b1a7b64a26903f2935b4e315ac3287b58748d/frontend/src/lib/telegramWebApp.ts#L235)

#### Parameters

##### params?

###### requestExpand?

`boolean`

#### Returns

> (): `void`

##### Returns

`void`
