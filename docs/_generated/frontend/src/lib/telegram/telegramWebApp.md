[**4626-web**](../../../index.md)

***

[4626-web](../../../index.md) / src/lib/telegram/telegramWebApp

# src/lib/telegram/telegramWebApp

## Type Aliases

### PrivyTelegramLaunchParams

> **PrivyTelegramLaunchParams** = `object`

Defined in: [src/lib/telegram/telegramWebApp.ts:313](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L313)

#### Properties

##### initDataRaw?

> `optional` **initDataRaw**: `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:314](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L314)

***

### TelegramInlineQueryChatType

> **TelegramInlineQueryChatType** = `"users"` \| `"bots"` \| `"groups"` \| `"channels"`

Defined in: [src/lib/telegram/telegramWebApp.ts:33](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L33)

***

### TelegramMiniAppSession

> **TelegramMiniAppSession** = `object`

Defined in: [src/lib/telegram/telegramWebApp.ts:85](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L85)

#### Properties

##### chatId

> **chatId**: `string` \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:91](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L91)

##### chatInstance

> **chatInstance**: `string` \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:93](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L93)

##### chatType

> **chatType**: `string` \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:92](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L92)

##### expiresAt

> **expiresAt**: `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:88](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L88)

##### initData

> **initData**: `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:86](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L86)

##### sessionToken

> **sessionToken**: `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:87](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L87)

##### telegramUserId

> **telegramUserId**: `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:89](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L89)

##### telegramUsername

> **telegramUsername**: `string` \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:90](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L90)

## Functions

### clearTelegramMiniAppSession()

> **clearTelegramMiniAppSession**(): `void`

Defined in: [src/lib/telegram/telegramWebApp.ts:177](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L177)

#### Returns

`void`

***

### ensureTelegramMiniAppSession()

> **ensureTelegramMiniAppSession**(`params?`): `Promise`\<`EnsureTelegramMiniAppSessionResult`\>

Defined in: [src/lib/telegram/telegramWebApp.ts:434](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L434)

#### Parameters

##### params?

###### fetcher?

(`path`, `init?`) => `Promise`\<`Response`\>

###### flowId?

`string`

###### timeoutMs?

`number`

#### Returns

`Promise`\<`EnsureTelegramMiniAppSessionResult`\>

***

### hasTelegramMiniAppEntrypointContext()

> **hasTelegramMiniAppEntrypointContext**(): `boolean`

Defined in: [src/lib/telegram/telegramWebApp.ts:287](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L287)

#### Returns

`boolean`

***

### isTelegramMiniAppContext()

> **isTelegramMiniAppContext**(): `boolean`

Defined in: [src/lib/telegram/telegramWebApp.ts:253](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L253)

#### Returns

`boolean`

***

### loadTelegramWebApp()

> **loadTelegramWebApp**(): `Promise`\<`TelegramWebAppLike` \| `null`\>

Defined in: [src/lib/telegram/telegramWebApp.ts:323](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L323)

#### Returns

`Promise`\<`TelegramWebAppLike` \| `null`\>

***

### openTelegramExternalLink()

> **openTelegramExternalLink**(`url`): `boolean`

Defined in: [src/lib/telegram/telegramWebApp.ts:257](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L257)

#### Parameters

##### url

`string`

#### Returns

`boolean`

***

### readPrivyTelegramLaunchParams()

> **readPrivyTelegramLaunchParams**(): [`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:317](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L317)

#### Returns

[`PrivyTelegramLaunchParams`](#privytelegramlaunchparams) \| `null`

***

### readTelegramMiniAppIdentityKey()

> **readTelegramMiniAppIdentityKey**(): `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:307](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L307)

#### Returns

`string`

***

### readTelegramMiniAppInitData()

> **readTelegramMiniAppInitData**(): `string`

Defined in: [src/lib/telegram/telegramWebApp.ts:249](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L249)

#### Returns

`string`

***

### readTelegramWebApp()

> **readTelegramWebApp**(): `TelegramWebAppLike` \| `null`

Defined in: [src/lib/telegram/telegramWebApp.ts:231](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L231)

#### Returns

`TelegramWebAppLike` \| `null`

***

### setupTelegramMiniAppUi()

> **setupTelegramMiniAppUi**(`params?`): () => `void`

Defined in: [src/lib/telegram/telegramWebApp.ts:391](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L391)

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

Defined in: [src/lib/telegram/telegramWebApp.ts:235](https://github.com/wenakita/4626/blob/5b93f3e2a7f660b27b3021bf4884acc058311983/frontend/src/lib/telegram/telegramWebApp.ts#L235)

#### Parameters

##### params?

###### chatTypes?

[`TelegramInlineQueryChatType`](#telegraminlinequerychattype)[]

###### query?

`string`

#### Returns

`boolean`
