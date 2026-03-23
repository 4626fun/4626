[**4626-app**](../../index.md)

***

[4626-app](../../index.md) / src/lib/telegramWebApp

# src/lib/telegramWebApp

## Type Aliases

### PrivyTelegramLaunchParams

> **PrivyTelegramLaunchParams** = `object`

Defined in: [src/lib/telegramWebApp.ts:228](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L228)

#### Properties

##### initDataRaw?

> `optional` **initDataRaw**: `string`

Defined in: [src/lib/telegramWebApp.ts:229](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L229)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"users"` \| `"bots"` \| `"groups"` \| `"channels"`

Defined in: [src/lib/telegramWebApp.ts:12](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L12)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [src/lib/telegramWebApp.ts:53](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L53)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:59](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L59)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:61](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L61)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:60](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L60)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/lib/telegramWebApp.ts:56](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L56)

##### initData

> **initData**: `string`

Defined in: [src/lib/telegramWebApp.ts:54](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L54)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/lib/telegramWebApp.ts:55](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L55)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/lib/telegramWebApp.ts:57](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L57)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegramWebApp.ts:58](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L58)

## Functions

### clearTelegramMiniAppSession()

> **clearTelegramMiniAppSession**(): `void`

Defined in: [src/lib/telegramWebApp.ts:131](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L131)

#### Returns

`void`

***

### ensureTelegramMiniAppSession()

> **ensureTelegramMiniAppSession**(`params?`): `Promise`\<`EnsureTelegramMiniAppSessionResult`\>

Defined in: [src/lib/telegramWebApp.ts:308](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L308)

#### Parameters

##### params?

###### fetcher?

(`path`, `init?`) => `Promise`\<`Response`\>

###### timeoutMs?

`number`

#### Returns

`Promise`\<`EnsureTelegramMiniAppSessionResult`\>

***

### hasTelegramMiniAppEntrypointContext()

> **hasTelegramMiniAppEntrypointContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:202](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L202)

#### Returns

`boolean`

***

### isTelegramMiniAppContext()

> **isTelegramMiniAppContext**(): `boolean`

Defined in: [src/lib/telegramWebApp.ts:198](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L198)

#### Returns

`boolean`

***

### loadTelegramWebApp()

> **loadTelegramWebApp**(): `Promise`\<`TelegramWebAppLike` \| `null`\>

Defined in: [src/lib/telegramWebApp.ts:238](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L238)

#### Returns

`Promise`\<`TelegramWebAppLike` \| `null`\>

***

### readPrivyTelegramLaunchParams()

> **readPrivyTelegramLaunchParams**(): [`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

Defined in: [src/lib/telegramWebApp.ts:232](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L232)

#### Returns

[`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

***

### readTelegramMiniAppIdentityKey()

> **readTelegramMiniAppIdentityKey**(): `string`

Defined in: [src/lib/telegramWebApp.ts:222](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L222)

#### Returns

`string`

***

### readTelegramMiniAppInitData()

> **readTelegramMiniAppInitData**(): `string`

Defined in: [src/lib/telegramWebApp.ts:194](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L194)

#### Returns

`string`

***

### readTelegramWebApp()

> **readTelegramWebApp**(): `TelegramWebAppLike` \| `null`

Defined in: [src/lib/telegramWebApp.ts:176](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L176)

#### Returns

`TelegramWebAppLike` \| `null`

***

### setupTelegramMiniAppUi()

> **setupTelegramMiniAppUi**(`params?`): () => `void`

Defined in: [src/lib/telegramWebApp.ts:266](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L266)

#### Parameters

##### params?

###### requestExpand?

`boolean`

#### Returns

> (): `void`

##### Returns

`void`

***

### switchTelegramMiniAppInlineQuery()

> **switchTelegramMiniAppInlineQuery**(`params?`): `boolean`

Defined in: [src/lib/telegramWebApp.ts:180](https://github.com/wenakita/4626/blob/main/frontend/src/lib/telegramWebApp.ts#L180)

#### Parameters

##### params?

###### chatTypes?

[`TelegramInlineQueryChatType`](#telegraminlinequerychattype)[]

###### query?

`string`

#### Returns

`boolean`
